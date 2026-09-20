import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { BlockType, ContentStatus, KaraokeAcesso, OrigemDaLetra, Prisma } from '@pv/db'
import {
  estaSincronizada,
  frasesDoTexto,
  normalizarPalavra,
  validarFrases,
  type Frase,
} from '@pv/karaoke'
import { PrismaService } from '../prisma/prisma.service'

/**
 * O Modo Karaokê: a letra sincronizada de cada faixa e as palavras que brilham.
 *
 * Acrescenta-se ao que existe sem lhe tocar. A faixa continua a ser o cartão
 * com áudio, o tocador continua igual; o karaokê é outra maneira de ouvir a
 * mesma faixa, e só aparece quando ele publica a letra sincronizada dela.
 */
@Injectable()
export class KaraokeService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── LEITURA PÚBLICA ────────────────────────────────────────────────

  /**
   * Tudo o que o ecrã do karaokê precisa, numa resposta.
   *
   * As mesmas portas da página da faixa, e nenhuma a menos: conteúdo
   * publicado, cartão no ar, letra publicada. Mais a do próprio karaokê — com
   * `CONTA`, quem não entrou recebe 403 com `precisaDeConta`, para o ecrã
   * convidar a entrar em vez de mostrar um erro.
   */
  async paraTocar(projectSlug: string, blocoId: string, temSessao: boolean) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      include: {
        asset: { select: { url: true, mimeType: true, durationMs: true, title: true } },
        imageAsset: { select: { url: true, width: true, height: true } },
        letraSincronizada: true,
        content: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            project: { select: { id: true, slug: true, name: true, status: true, karaokeAcesso: true } },
          },
        },
      },
    })
    const projeto = bloco?.content.project
    if (
      !bloco ||
      !projeto ||
      projeto.slug !== projectSlug ||
      projeto.status === 'ARCHIVED' ||
      bloco.content.status !== ContentStatus.PUBLISHED ||
      (bloco.meta as Record<string, unknown> | null)?.foraDoAr === true ||
      !bloco.asset?.url ||
      !bloco.letraSincronizada?.publicada ||
      projeto.karaokeAcesso === KaraokeAcesso.DESLIGADO
    ) {
      throw new NotFoundException('Karaokê não encontrado')
    }
    if (projeto.karaokeAcesso === KaraokeAcesso.CONTA && !temSessao) {
      throw new ForbiddenException({ message: 'Entre na sua conta para cantar', precisaDeConta: true })
    }

    return {
      // Os ids vão para a métrica: tocar no karaokê conta como tocar a faixa.
      projeto: { id: projeto.id, slug: projeto.slug, nome: projeto.name },
      conteudo: { id: bloco.content.id, slug: bloco.content.slug, titulo: bloco.content.title },
      faixa: {
        id: bloco.id,
        titulo: bloco.titulo || bloco.asset.title || bloco.content.title,
        audio: bloco.asset.url,
        mimeType: bloco.asset.mimeType,
        duracaoMs: bloco.asset.durationMs,
        arte: bloco.imageAsset?.url ?? null,
      },
      frases: bloco.letraSincronizada.frases as unknown as Frase[],
      destaques: await this.destaquesDoProjeto(projeto.id),
    }
  }

  // ─── PAINEL: A LETRA DE UMA FAIXA ───────────────────────────────────

  async letraDoCartao(blocoId: string) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      include: {
        asset: { select: { url: true, durationMs: true, title: true } },
        imageAsset: { select: { url: true } },
        letraSincronizada: true,
        content: { select: { slug: true, title: true, projectId: true, project: { select: { slug: true } } } },
      },
    })
    if (!bloco) throw new NotFoundException('Cartão não encontrado')
    const letra = bloco.letraSincronizada
    return {
      faixa: {
        id: bloco.id,
        titulo: bloco.titulo || bloco.asset?.title || bloco.content.title,
        audio: bloco.asset?.url ?? null,
        duracaoMs: bloco.asset?.durationMs ?? null,
        arte: bloco.imageAsset?.url ?? null,
        conteudoSlug: bloco.content.slug,
        conteudoTitulo: bloco.content.title,
        projetoSlug: bloco.content.project.slug,
      },
      letra: {
        texto: letra?.texto ?? '',
        frases: (letra?.frases ?? []) as unknown as Frase[],
        publicada: letra?.publicada ?? false,
        atualizadoEm: letra?.atualizadoEm ?? null,
      },
      destaques: await this.destaquesDoProjeto(bloco.content.projectId),
    }
  }

  /**
   * Grava a letra de uma faixa.
   *
   * Três coisas podem vir, cada uma sozinha:
   *   - `texto`: a letra colada. Refaz as frases, e as que ficaram iguais no
   *     mesmo lugar guardam os tempos (ver `frasesDoTexto`).
   *   - `frases`: o resultado da sincronização, com tempos e marcas.
   *   - `publicada`: pôr ou tirar o botão do karaokê da faixa.
   *
   * Publicar exige a música inteira sincronizada. E qualquer gravação que deixe
   * a letra por sincronizar TIRA-A do ar: uma letra que ele mudou e ainda não
   * voltou a marcar não pode ficar à frente do público com o destaque perdido.
   */
  async gravarLetra(
    blocoId: string,
    dados: { texto?: string; frases?: unknown; publicada?: boolean },
  ) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      include: { asset: { select: { durationMs: true } }, letraSincronizada: true },
    })
    if (!bloco) throw new NotFoundException('Cartão não encontrado')
    if (bloco.type !== BlockType.AUDIO || !bloco.assetId) {
      throw new BadRequestException('O karaokê precisa de um cartão com áudio.')
    }

    const atual = bloco.letraSincronizada
    let texto = atual?.texto ?? ''
    let frases = (atual?.frases ?? []) as unknown as Frase[]

    if (dados.texto !== undefined) {
      texto = dados.texto
      frases = frasesDoTexto(texto, frases)
    }
    if (dados.frases !== undefined) {
      const erros = validarFrases(dados.frases, bloco.asset?.durationMs ?? null, false)
      if (erros.length) throw new BadRequestException(erros.join(' '))
      const recebidas = dados.frases as Frase[]
      // As frases têm de ser as do texto gravado. Sem isto, duas abas do painel
      // abertas podiam gravar tempos de uma letra por cima do texto de outra.
      const esperadas = frasesDoTexto(texto, null)
      const iguais =
        recebidas.length === esperadas.length &&
        recebidas.every(
          (f, i) =>
            f.texto === esperadas[i].texto &&
            f.palavras.length === esperadas[i].palavras.length &&
            f.palavras.every((p, j) => p.texto === esperadas[i].palavras[j].texto),
        )
      if (!iguais) {
        throw new ConflictException(
          'A letra mudou entretanto. Recarregue a página antes de gravar a sincronização.',
        )
      }
      frases = recebidas.map((f) => ({
        texto: f.texto,
        inicioMs: f.inicioMs,
        fimMs: f.fimMs,
        palavras: f.palavras.map((p) => ({
          texto: p.texto,
          inicioMs: p.inicioMs,
          fimMs: p.fimMs,
          ...(typeof p.destaque === 'number' ? { destaque: p.destaque } : {}),
          ...(p.marcada === true ? { marcada: true } : {}),
        })),
      }))
    }

    let publicada = dados.publicada ?? atual?.publicada ?? false
    if (dados.publicada === true) {
      const erros = validarFrases(frases, bloco.asset?.durationMs ?? null, true)
      if (erros.length) throw new BadRequestException(erros.slice(0, 3).join(' '))
    }
    if (!estaSincronizada(frases)) publicada = false

    const valores = {
      texto,
      frases: frases as unknown as Prisma.InputJsonValue,
      publicada,
      /*
        GRAVAR À MÃO TORNA A LETRA DELE.

        A transcrição automática recusa-se a passar por cima de uma letra
        MANUAL publicada. Se ele corrigir uma palavra numa letra que o
        computador escreveu, essa letra passa a ser dele — e uma segunda volta
        do transcritor não pode apagar a correcção que ele acabou de fazer.
      */
      origem: OrigemDaLetra.MANUAL,
    }
    await this.prisma.letraSincronizada.upsert({
      where: { blocoId },
      create: { blocoId, ...valores },
      update: valores,
    })
    return this.letraDoCartao(blocoId)
  }

  // ─── PAINEL: O PROJETO ──────────────────────────────────────────────

  /** A página do karaokê no painel: o acesso, as palavras e as faixas. */
  async painel(projectSlug: string) {
    const projeto = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true, slug: true, name: true, karaokeAcesso: true },
    })
    if (!projeto) throw new NotFoundException('Projeto não encontrado')

    const [palavras, blocos] = await Promise.all([
      this.prisma.palavraDeDestaque.findMany({
        where: { projectId: projeto.id },
        orderBy: [{ nivel: 'desc' }, { exibicao: 'asc' }],
        select: { id: true, exibicao: true, palavra: true, nivel: true },
      }),
      this.prisma.contentBlock.findMany({
        where: { type: BlockType.AUDIO, assetId: { not: null }, content: { projectId: projeto.id } },
        orderBy: [{ content: { position: 'asc' } }, { position: 'asc' }],
        select: {
          id: true,
          titulo: true,
          asset: { select: { title: true } },
          category: { select: { name: true } },
          content: { select: { slug: true, title: true } },
          letraSincronizada: { select: { publicada: true, frases: true, atualizadoEm: true } },
        },
      }),
    ])

    return {
      acesso: projeto.karaokeAcesso,
      palavras,
      faixas: blocos.map((b) => {
        const frases = (b.letraSincronizada?.frases ?? []) as unknown as Frase[]
        return {
          id: b.id,
          titulo: b.titulo || b.asset?.title || b.content.title,
          categoria: b.category?.name ?? null,
          conteudoSlug: b.content.slug,
          conteudoTitulo: b.content.title,
          estado: !b.letraSincronizada || frases.length === 0
            ? 'SEM_LETRA'
            : b.letraSincronizada.publicada
              ? 'PUBLICADA'
              : estaSincronizada(frases)
                ? 'SINCRONIZADA'
                : 'A_SINCRONIZAR',
          frases: frases.length,
          sincronizadas: frases.filter((f) => typeof f.inicioMs === 'number').length,
        }
      }),
    }
  }

  async definirAcesso(projectSlug: string, acesso: KaraokeAcesso) {
    await this.prisma.project.update({ where: { slug: projectSlug }, data: { karaokeAcesso: acesso } })
    return this.painel(projectSlug)
  }

  /**
   * Acrescenta uma palavra à lista, ou muda o nível da que já lá está.
   *
   * Pela forma normalizada: "fé" e "Fé" são a mesma palavra, e escrevê-la outra
   * vez é mudar-lhe o nível e não um erro de duplicado.
   */
  async definirPalavra(projectSlug: string, exibicao: string, nivel: number) {
    const projeto = await this.prisma.project.findUnique({ where: { slug: projectSlug } })
    if (!projeto) throw new NotFoundException('Projeto não encontrado')
    const limpa = exibicao.trim().replace(/\s+/g, ' ')
    const palavra = limpa.split(' ').map(normalizarPalavra).filter(Boolean).join(' ')
    if (!palavra) throw new BadRequestException('Escreva uma palavra.')
    if (palavra.split(' ').length > 2) {
      throw new BadRequestException('Use uma palavra, ou duas no máximo (ex.: Espírito Santo).')
    }
    await this.prisma.palavraDeDestaque.upsert({
      where: { projectId_palavra: { projectId: projeto.id, palavra } },
      create: { projectId: projeto.id, palavra, exibicao: limpa, nivel },
      update: { exibicao: limpa, nivel },
    })
    return this.painel(projectSlug)
  }

  async apagarPalavra(id: string) {
    const palavra = await this.prisma.palavraDeDestaque.findUnique({
      where: { id },
      select: { project: { select: { slug: true } } },
    })
    if (!palavra) throw new NotFoundException('Palavra não encontrada')
    await this.prisma.palavraDeDestaque.delete({ where: { id } })
    return this.painel(palavra.project.slug)
  }

  private async destaquesDoProjeto(projectId: string) {
    const palavras = await this.prisma.palavraDeDestaque.findMany({
      where: { projectId },
      select: { palavra: true, nivel: true },
    })
    return palavras.map((p) => ({ palavra: p.palavra, nivel: p.nivel as 1 | 2 | 3 }))
  }
}
