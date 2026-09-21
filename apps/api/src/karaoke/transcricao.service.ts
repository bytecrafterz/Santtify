import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { BlockType, EstadoDaTranscricao, OrigemDaLetra, Prisma } from '@pv/db'
import {
  estaSincronizada,
  frasesDeTranscricao,
  validarFrases,
  type Frase,
  type TiradaOuvida,
} from '@pv/karaoke'
import { PrismaService } from '../prisma/prisma.service'

/** Ao fim destas tentativas a faixa pára e espera por ele. */
const TENTATIVAS = 3

/**
 * Porque é que uma música vai para a fila. Cada razão tem os seus direitos.
 *
 * Isto era um `forcar: boolean` e o booleano escondia um caso: substituir o
 * áudio de uma faixa já ouvida não voltava a pô-la na fila — "já foi ouvida",
 * dizia o sistema — e a música nova ficava com a letra da música antiga. Com
 * três razões escritas por extenso, cada uma diz exactamente o que pode fazer.
 */
export type PorqueOuvir =
  /** Ele carregou no botão. Refaz tudo, mesmo o que ele escreveu à mão. */
  | 'ELE_PEDIU'
  /** Entrou outro áudio neste cartão: a letra antiga já não é desta música. */
  | 'AUDIO_NOVO'
  /** A varredura das que ainda não têm letra. Não toca em nada que já exista. */
  | 'FALTA_LETRA'

/**
 * A fila das músicas à espera de serem ouvidas pelo sistema.
 *
 * O cliente pediu isto em 19/09, depois de perceber o que era escrever a letra
 * de sessenta músicas à mão: "eu envio o áudio e o sistema faz a transcrição
 * automática da voz, sem eu precisar fornecer nenhum texto".
 *
 * A REGRA DE OURO DESTA FILA: ouvir uma música demora minutos de processador, e
 * isso nunca pode acontecer enquanto alguém espera num ecrã. Quem envia um
 * áudio deixa aqui um pedido e segue a vida; o transcritor — um programa à
 * parte, que corre no servidor — tira um pedido de cada vez, ouve a música e
 * devolve as palavras com o tempo de cada uma.
 *
 * O que ele vê no painel é esta tabela: quantas já estão prontas, qual está a
 * ser ouvida agora e em que ponto vai.
 */
@Injectable()
export class TranscricaoService {
  private readonly logger = new Logger(TranscricaoService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ─── PÔR NA FILA ────────────────────────────────────────────────────

  /**
   * Põe uma faixa na fila.
   *
   * Ver `PorqueOuvir`: quem pede diz porquê, e é a razão que decide o que pode
   * passar por cima do quê.
   */
  async enfileirar(blocoId: string, porque: PorqueOuvir = 'FALTA_LETRA') {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      select: {
        id: true,
        type: true,
        assetId: true,
        letraSincronizada: { select: { origem: true, publicada: true, texto: true } },
        transcricao: { select: { id: true, estado: true } },
      },
    })
    if (!bloco) throw new NotFoundException('Cartão não encontrado.')
    if (bloco.type !== BlockType.AUDIO || !bloco.assetId) {
      throw new BadRequestException('Este cartão não tem áudio.')
    }

    /*
      O QUE ELE ESCREVEU À MÃO NÃO SE APAGA SOZINHO.

      Uma letra MANUAL é trabalho dele — colada, corrigida, marcada palavra a
      palavra. A transcrição automática nunca passa por cima dela sem ele pedir.

      E não é só a publicada: uma letra que ele colou e ainda não sincronizou
      está por publicar, e apagá-la seria deitar fora exactamente o trabalho
      que este sistema existe para lhe poupar. Basta haver texto dele.
    */
    const dele =
      bloco.letraSincronizada?.origem === OrigemDaLetra.MANUAL &&
      (bloco.letraSincronizada.publicada || Boolean(bloco.letraSincronizada.texto?.trim()))
    if (porque !== 'ELE_PEDIU' && dele) {
      return { ignorado: true, motivo: 'já tem letra escrita à mão' }
    }
    /*
      UMA MÚSICA JÁ OUVIDA NÃO SE OUVE OUTRA VEZ — salvo se for outra música.

      Trocar o áudio do cartão é trocar a música. A letra que lá está é da
      antiga, e mantê-la seria pior do que não ter nenhuma: o karaokê acenderia
      palavras que ninguém está a cantar.
    */
    if (porque === 'FALTA_LETRA' && bloco.transcricao?.estado === EstadoDaTranscricao.PRONTA) {
      return { ignorado: true, motivo: 'já foi ouvida' }
    }

    const pedido = await this.prisma.transcricaoDeAudio.upsert({
      where: { blocoId },
      create: { blocoId },
      update: {
        estado: EstadoDaTranscricao.PENDENTE,
        progresso: 0,
        erro: null,
        tentativas: 0,
        comecouEm: null,
        terminouEm: null,
      },
      select: { id: true, estado: true },
    })
    return { id: pedido.id, estado: pedido.estado }
  }

  /**
   * Põe na fila TODAS as faixas de um projeto que ainda não têm letra.
   *
   * É o que resolve as sessenta que já estão no ar: ele carrega uma vez e vai
   * fazer outra coisa. As que ele já escreveu à mão ficam como estão.
   */
  async enfileirarProjeto(projectSlug: string, refazer = false) {
    const projeto = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')

    const faixas = await this.prisma.contentBlock.findMany({
      where: {
        type: BlockType.AUDIO,
        assetId: { not: null },
        content: { projectId: projeto.id },
        ...(refazer
          ? {}
          : {
              OR: [
                { letraSincronizada: { is: null } },
                { letraSincronizada: { is: { publicada: false } } },
              ],
            }),
      },
      select: { id: true },
    })

    let postas = 0
    for (const faixa of faixas) {
      const r = await this.enfileirar(faixa.id, refazer ? 'ELE_PEDIU' : 'FALTA_LETRA')
      if (!('ignorado' in r)) postas++
    }
    this.logger.log(`${postas} faixa(s) na fila para ouvir (projeto ${projectSlug})`)
    return { postas, total: faixas.length }
  }

  // ─── O TRANSCRITOR ──────────────────────────────────────────────────

  /**
   * O próximo pedido da fila, já marcado como "a ouvir".
   *
   * Marcar ANTES de responder é o que impede dois transcritores de ouvirem a
   * mesma música: quem chegar a seguir já não a encontra pendente.
   *
   * Uma faixa que ficou presa em "a ouvir" — o processo morreu a meio, o
   * servidor reiniciou — volta à fila passada meia hora. Sem isto, bastava um
   * reinício infeliz para uma música ficar por ouvir para sempre.
   */
  async proxima() {
    const presaDesde = new Date(Date.now() - 30 * 60_000)
    await this.prisma.transcricaoDeAudio.updateMany({
      where: { estado: EstadoDaTranscricao.A_OUVIR, comecouEm: { lt: presaDesde } },
      data: { estado: EstadoDaTranscricao.PENDENTE, progresso: 0 },
    })

    const pedido = await this.prisma.transcricaoDeAudio.findFirst({
      where: { estado: EstadoDaTranscricao.PENDENTE, tentativas: { lt: TENTATIVAS } },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true,
        blocoId: true,
        tentativas: true,
        bloco: {
          select: {
            titulo: true,
            label: true,
            asset: { select: { url: true, durationMs: true } },
            content: { select: { title: true, project: { select: { slug: true } } } },
          },
        },
      },
    })
    if (!pedido?.bloco.asset?.url) return null

    await this.prisma.transcricaoDeAudio.update({
      where: { id: pedido.id },
      data: {
        estado: EstadoDaTranscricao.A_OUVIR,
        comecouEm: new Date(),
        progresso: 0,
        tentativas: { increment: 1 },
      },
    })

    return {
      id: pedido.id,
      audio: pedido.bloco.asset.url,
      duracaoMs: pedido.bloco.asset.durationMs,
      nome: pedido.bloco.titulo || pedido.bloco.label || pedido.bloco.content.title,
      projeto: pedido.bloco.content.project.slug,
    }
  }

  /** O transcritor diz em que ponto vai: 0 a 100. */
  async progresso(id: string, progresso: number) {
    await this.prisma.transcricaoDeAudio.updateMany({
      where: { id, estado: EstadoDaTranscricao.A_OUVIR },
      data: { progresso: Math.max(0, Math.min(100, Math.round(progresso))) },
    })
    return { ok: true }
  }

  /**
   * A música foi ouvida: guarda-se a letra e o karaokê dela passa a existir.
   *
   * Publicada de imediato, e é uma decisão. Uma letra automática com uma
   * palavra trocada é melhor do que nenhuma — a criança canta à mesma — e
   * deixá-la à espera de revisão punha o cliente a fazer, uma a uma, o trabalho
   * de que se queixou. O painel marca-a como AUTOMÁTICA para ele saber o que
   * ainda não leu, e corrigir é um toque.
   */
  async concluir(id: string, tiradas: TiradaOuvida[], segundos?: number) {
    const pedido = await this.prisma.transcricaoDeAudio.findUnique({
      where: { id },
      select: { id: true, blocoId: true, bloco: { select: { asset: { select: { durationMs: true } } } } },
    })
    if (!pedido) throw new NotFoundException('Pedido não encontrado.')

    /*
      A DURAÇÃO VEM DE QUEM OUVIU, e não do ficheiro.

      O `durationMs` do áudio é metadado do envio e muitas vezes nem existe; o
      transcritor sabe exactamente quanto tempo de som ouviu. É esse o tecto
      para a última frase, quando ela precisa de ser esticada (ver a nota sobre
      o fim da música em `frasesDeTranscricao`).
    */
    const duracaoOuvida = typeof segundos === 'number' && segundos > 0 ? Math.round(segundos * 1000) : null
    const duracaoMs = pedido.bloco?.asset?.durationMs ?? null
    const frases = frasesDeTranscricao(tiradas || [], duracaoOuvida ?? duracaoMs)
    if (!estaSincronizada(frases)) {
      return this.falhar(id, 'O sistema não ouviu nenhuma voz nesta faixa.', true)
    }

    /*
      A LETRA AUTOMÁTICA PASSA PELA MESMA PORTA DA ESCRITA À MÃO.

      `validarFrases` é o que o painel exige para publicar: frases por ordem,
      dentro da música, sem tempos impossíveis. Uma letra automática que não
      passasse aqui ficaria no ar sem o painel a conseguir voltar a gravá-la —
      e ele descobria-o na primeira vez que tentasse corrigir uma palavra.

      Falhar não deita fora o que foi ouvido: a letra fica guardada por
      publicar, e o painel marca a faixa para ele ver o que aconteceu.
    */
    const problemas = validarFrases(frases, duracaoMs, true)

    const texto = frases.map((f) => f.texto).join('\n')
    const valores = {
      texto,
      frases: frases as unknown as Prisma.InputJsonValue,
      publicada: problemas.length === 0,
      origem: OrigemDaLetra.AUTOMATICA,
    }
    await this.prisma.letraSincronizada.upsert({
      where: { blocoId: pedido.blocoId },
      create: { blocoId: pedido.blocoId, ...valores },
      update: valores,
    })
    if (problemas.length) {
      // Não vale a pena ouvir outra vez: o áudio é o mesmo e daria o mesmo.
      await this.falhar(id, `A letra saiu, mas não pôde ir ao ar: ${problemas[0]}`, true)
      return { frases: frases.length, publicada: false, problemas: problemas.slice(0, 3) }
    }

    await this.prisma.transcricaoDeAudio.update({
      where: { id },
      data: {
        estado: EstadoDaTranscricao.PRONTA,
        progresso: 100,
        erro: null,
        terminouEm: new Date(),
        segundosAOuvir: segundos ? Math.round(segundos) : null,
      },
    })
    return { frases: frases.length, publicada: true }
  }

  /**
   * Correu mal. Volta à fila, até a terceira vez.
   *
   * `semRepetir` é para as falhas que repetir não resolve — a música não tem
   * voz nenhuma, ou a letra não passa nas regras do painel. Insistir nessas
   * seria ocupar o servidor durante horas para chegar ao mesmo sítio.
   */
  async falhar(id: string, erro: string, semRepetir = false) {
    const pedido = await this.prisma.transcricaoDeAudio.findUnique({
      where: { id },
      select: { tentativas: true },
    })
    if (!pedido) throw new NotFoundException('Pedido não encontrado.')
    const desiste = semRepetir || pedido.tentativas >= TENTATIVAS
    await this.prisma.transcricaoDeAudio.update({
      where: { id },
      data: {
        estado: desiste ? EstadoDaTranscricao.FALHOU : EstadoDaTranscricao.PENDENTE,
        progresso: 0,
        erro: erro.slice(0, 500),
        terminouEm: desiste ? new Date() : null,
      },
    })
    this.logger.warn(`Transcrição ${id} falhou (${pedido.tentativas}/${TENTATIVAS}): ${erro}`)
    return { desistiu: desiste }
  }

  // ─── O PAINEL ───────────────────────────────────────────────────────

  /** O andamento de tudo, para a página do painel. */
  async andamento(projectSlug: string) {
    const projeto = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')

    const faixas = await this.prisma.contentBlock.findMany({
      where: { type: BlockType.AUDIO, assetId: { not: null }, content: { projectId: projeto.id } },
      orderBy: [{ content: { position: 'asc' } }, { position: 'asc' }],
      select: {
        id: true,
        titulo: true,
        label: true,
        content: { select: { title: true, slug: true } },
        asset: { select: { durationMs: true } },
        letraSincronizada: { select: { publicada: true, origem: true, frases: true } },
        transcricao: {
          select: { estado: true, progresso: true, erro: true, segundosAOuvir: true },
        },
      },
    })

    const lista = faixas.map((f) => {
      const frases = (f.letraSincronizada?.frases ?? []) as unknown as Frase[]
      return {
        id: f.id,
        nome: f.titulo || f.label || f.content.title,
        conteudo: f.content.title,
        conteudoSlug: f.content.slug,
        duracaoMs: f.asset?.durationMs ?? null,
        estado: f.transcricao?.estado ?? null,
        progresso: f.transcricao?.progresso ?? 0,
        erro: f.transcricao?.erro ?? null,
        temLetra: Boolean(f.letraSincronizada?.publicada),
        origem: f.letraSincronizada?.origem ?? null,
        frases: frases.length,
      }
    })

    const prontas = lista.filter((f) => f.temLetra).length
    const aOuvir = lista.filter((f) => f.estado === EstadoDaTranscricao.A_OUVIR)
    const naFila = lista.filter((f) => f.estado === EstadoDaTranscricao.PENDENTE).length
    const falhadas = lista.filter((f) => f.estado === EstadoDaTranscricao.FALHOU).length

    return {
      faixas: lista,
      resumo: {
        total: lista.length,
        prontas,
        naFila,
        falhadas,
        aOuvirAgora: aOuvir.length,
        /*
          A PERCENTAGEM QUE ELE VÊ conta a música que está a ser ouvida agora,
          e não só as acabadas. Com sessenta faixas, cada uma leva minutos: uma
          barra que só se mexe de faixa em faixa parece parada, e uma barra
          parada é indistinguível de uma avaria.

          Cada música vale UMA e não mais: a que está a ser ouvida agora conta
          pelo ponto onde vai, mesmo que já tivesse letra antes — senão, mandar
          refazer duas faixas prontas dava 119%, que foi o que apareceu no ecrã
          e não quer dizer nada a ninguém.
        */
        percentagem: lista.length
          ? Math.round(
              ((lista.filter((f) => f.temLetra && f.estado !== EstadoDaTranscricao.A_OUVIR).length +
                aOuvir.reduce((s, f) => s + f.progresso / 100, 0)) /
                lista.length) *
                100,
            )
          : 0,
      },
    }
  }
}
