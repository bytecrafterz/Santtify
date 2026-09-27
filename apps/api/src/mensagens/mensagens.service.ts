import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { TipoDeAnexo, type MensagemPrivada } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'

/** O maior ficheiro que se pode enviar numa conversa. */
export const TAMANHO_MAXIMO_ANEXO = 25 * 1024 * 1024

/**
 * Os tipos que se podem MOSTRAR no navegador. Tudo o resto é entregue como
 * descarga, e nunca aberto: um HTML ou um SVG aberto a partir do nosso domínio
 * correria com a sessão de quem o abrisse.
 */
const IMAGENS_SEGURAS = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const AUDIOS_SEGUROS = /^audio\/(mpeg|mp4|aac|x-m4a|m4a|ogg|webm|wav|x-wav)$/

/** O tamanho de uma mensagem. Chega para um parágrafo longo; não para um livro. */
export const MAXIMO_DE_CARACTERES = 4000
/** Quantas mensagens vêm de cada vez, das mais recentes para trás. */
const PAGINA = 200

const PESSOA = { id: true, displayName: true, username: true, avatarUrl: true } as const

/**
 * MENSAGENS PRIVADAS ENTRE DUAS CONTAS.
 *
 * Pedidas em 27/09 para o desenvolvedor e o Rossandro falarem dentro da
 * plataforma. Duas regras, todas aqui e nenhuma só no ecrã:
 *
 *   1. Só um ADMINISTRADOR abre uma conversa. É uma plataforma de crianças, e
 *      mensagens privadas abertas a qualquer pessoa eram um risco que ninguém
 *      pediu. Aberta, os dois respondem.
 *   2. Só os dois participantes vêem a conversa. Quem não é um deles recebe
 *      "não encontrada", e não "proibida": nem a existência dela se confirma.
 *
 * O bloqueio entre contas NÃO se aplica aqui, a pedido do desenvolvedor em 27/09: a
 * conversa só existe porque um administrador a abriu, e bloquear o canal com o
 * administrador não era algo que ele quisesse. O bloqueio continua a valer no
 * resto da plataforma (comentários e perfis).
 */
@Injectable()
export class MensagensService {
  private readonly pasta: string

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.pasta = resolve(
      config.get<string>('MENSAGENS_DIR') ?? join(process.cwd(), '..', '..', 'mensagens-privadas'),
    )
  }

  /** O que o ecrã precisa de saber de uma mensagem, sem o caminho no disco. */
  private paraEcra(m: MensagemPrivada, userId: string, lidaPelaOutraEm: Date | null) {
    return {
      id: m.id,
      texto: m.texto,
      minha: m.autorId === userId,
      em: m.criadaEm,
      // O "visto" das minhas: a outra pessoa já abriu a conversa depois dela.
      vista: m.autorId === userId && !!lidaPelaOutraEm && lidaPelaOutraEm >= m.criadaEm,
      anexo: m.anexoTipo
        ? {
            tipo: m.anexoTipo,
            nome: m.anexoNome ?? 'arquivo',
            mime: m.anexoMime ?? 'application/octet-stream',
            bytes: m.anexoBytes ?? 0,
            duracaoSeg: m.duracaoSeg,
          }
        : null,
    }
  }

  /** O par ordenado: a mesma dupla dá sempre a mesma linha. */
  private par(a: string, b: string) {
    return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a }
  }

  /** A conversa, se quem pergunta for um dos dois; senão, como se não existisse. */
  private async daPessoa(conversaId: string, userId: string) {
    const c = await this.prisma.conversaPrivada.findUnique({
      where: { id: conversaId },
      include: { userA: { select: PESSOA }, userB: { select: PESSOA } },
    })
    if (!c || (c.userAId !== userId && c.userBId !== userId)) {
      throw new NotFoundException('Conversa não encontrada.')
    }
    const souA = c.userAId === userId
    return { c, souA, outra: souA ? c.userB : c.userA }
  }

  /** As minhas conversas, a mais recente primeiro, com as não lidas de cada. */
  async listar(userId: string) {
    const conversas = await this.prisma.conversaPrivada.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { ultimaEm: 'desc' },
      include: {
        userA: { select: PESSOA },
        userB: { select: PESSOA },
        mensagens: { orderBy: { criadaEm: 'desc' }, take: 1 },
      },
    })

    return Promise.all(
      conversas.map(async (c) => {
        const souA = c.userAId === userId
        const lidaEm = souA ? c.lidaPorAEm : c.lidaPorBEm
        const naoLidas = await this.prisma.mensagemPrivada.count({
          where: {
            conversaId: c.id,
            autorId: { not: userId },
            ...(lidaEm ? { criadaEm: { gt: lidaEm } } : {}),
          },
        })
        const ultima = c.mensagens[0]
        const resumo = !ultima
          ? ''
          : ultima.texto
            ? ultima.texto.slice(0, 140)
            : ultima.anexoTipo === TipoDeAnexo.AUDIO
              ? '🎤 Mensagem de voz'
              : ultima.anexoTipo === TipoDeAnexo.IMAGEM
                ? '📷 Foto'
                : `📎 ${ultima.anexoNome ?? 'Arquivo'}`
        return {
          id: c.id,
          outra: souA ? c.userB : c.userA,
          ultima: ultima ? { texto: resumo, minha: ultima.autorId === userId, em: ultima.criadaEm } : null,
          naoLidas,
          ultimaEm: c.ultimaEm,
        }
      }),
    )
  }

  /** Quantas mensagens por ler, em todas as conversas. Para o número no perfil. */
  async naoLidas(userId: string) {
    const lista = await this.listar(userId)
    return { naoLidas: lista.reduce((t, c) => t + c.naoLidas, 0) }
  }

  /**
   * Abre a conversa com alguém, ou devolve a que já existe.
   *
   * Criar exige administrador; reabrir uma que já existe, não — é a mesma
   * porta pela qual o outro lado entra para responder.
   */
  async abrir(userId: string, papel: string | undefined, comUserId: string) {
    if (comUserId === userId) throw new BadRequestException('Não é possível conversar consigo mesmo.')

    const par = this.par(userId, comUserId)
    const existente = await this.prisma.conversaPrivada.findUnique({
      where: { userAId_userBId: par },
    })
    if (existente) return { id: existente.id }

    if (papel !== 'ADMIN') {
      throw new ForbiddenException('Só um administrador pode iniciar uma conversa privada.')
    }
    const outra = await this.prisma.user.findUnique({ where: { id: comUserId }, select: { id: true, status: true } })
    if (!outra || outra.status !== 'ACTIVE') throw new NotFoundException('Pessoa não encontrada.')

    const nova = await this.prisma.conversaPrivada.upsert({
      where: { userAId_userBId: par },
      create: par,
      update: {},
    })
    return { id: nova.id }
  }

  /** As mensagens da conversa, e marca-as como lidas por quem as abriu. */
  async mensagens(userId: string, conversaId: string) {
    const { c, souA, outra } = await this.daPessoa(conversaId, userId)
    const recentes = await this.prisma.mensagemPrivada.findMany({
      where: { conversaId },
      orderBy: { criadaEm: 'desc' },
      take: PAGINA,
    })
    await this.prisma.conversaPrivada.update({
      where: { id: c.id },
      data: souA ? { lidaPorAEm: new Date() } : { lidaPorBEm: new Date() },
    })
    const lidaPelaOutraEm = souA ? c.lidaPorBEm : c.lidaPorAEm
    return {
      id: c.id,
      outra,
      mensagens: recentes.reverse().map((m) => this.paraEcra(m, userId, lidaPelaOutraEm)),
    }
  }

  async enviar(userId: string, conversaId: string, texto: string) {
    const { c, souA } = await this.daPessoa(conversaId, userId)
    const limpo = (texto ?? '').replace(/\r\n/g, '\n').trim()
    if (!limpo) throw new BadRequestException('Escreva uma mensagem.')
    if (limpo.length > MAXIMO_DE_CARACTERES) {
      throw new BadRequestException(`A mensagem passa de ${MAXIMO_DE_CARACTERES} caracteres.`)
    }

    return this.gravar(c.id, souA, userId, { texto: limpo })
  }

  /** Grava a mensagem e move a conversa para o topo, na mesma transacção. */
  private async gravar(
    conversaId: string,
    souA: boolean,
    userId: string,
    dados: {
      texto: string
      anexoTipo?: TipoDeAnexo
      anexoCaminho?: string
      anexoNome?: string
      anexoMime?: string
      anexoBytes?: number
      duracaoSeg?: number | null
    },
  ) {
    const agora = new Date()
    const [m] = await this.prisma.$transaction([
      this.prisma.mensagemPrivada.create({
        data: { ...dados, conversaId, autorId: userId, criadaEm: agora },
      }),
      this.prisma.conversaPrivada.update({
        where: { id: conversaId },
        data: { ultimaEm: agora, ...(souA ? { lidaPorAEm: agora } : { lidaPorBEm: agora }) },
      }),
    ])
    return this.paraEcra(m, userId, null)
  }

  /**
   * UM FICHEIRO OU UMA MENSAGEM DE VOZ.
   *
   * Pedidos em 27/09. Vão para uma pasta que nenhum servidor web entrega: o
   * único caminho até eles é `anexo()`, que confirma primeiro que quem pede é
   * um dos dois da conversa.
   */
  async enviarAnexo(
    userId: string,
    conversaId: string,
    ficheiro: Express.Multer.File | undefined,
    opcoes: { texto?: string; voz?: boolean; duracaoSeg?: number },
  ) {
    const { c, souA } = await this.daPessoa(conversaId, userId)
    if (!ficheiro?.buffer?.length) throw new BadRequestException('Escolha um arquivo.')
    if (ficheiro.size > TAMANHO_MAXIMO_ANEXO) {
      throw new BadRequestException('O arquivo passa de 25 MB.')
    }
    const texto = (opcoes.texto ?? '').replace(/\r\n/g, '\n').trim()
    if (texto.length > MAXIMO_DE_CARACTERES) {
      throw new BadRequestException(`A mensagem passa de ${MAXIMO_DE_CARACTERES} caracteres.`)
    }

    // O tipo que o navegador declarou, sem parâmetros ("audio/webm;codecs=opus").
    const mime = (ficheiro.mimetype || 'application/octet-stream').split(';')[0].trim().toLowerCase()
    const tipo =
      opcoes.voz || mime.startsWith('audio/')
        ? TipoDeAnexo.AUDIO
        : IMAGENS_SEGURAS.has(mime)
          ? TipoDeAnexo.IMAGEM
          : TipoDeAnexo.ARQUIVO
    if (tipo === TipoDeAnexo.AUDIO && !mime.startsWith('audio/') && mime !== 'video/webm' && mime !== 'video/mp4') {
      throw new BadRequestException('A gravação chegou num formato que não é áudio.')
    }

    // O multer lê o nome do multipart como latin1, e "relatório" chegava como
    // "relatÃ³rio". Volta-se a UTF-8 — a não ser que o resultado estrague o
    // nome, sinal de que já vinha certo.
    const bruto = ficheiro.originalname || 'arquivo'
    const emUtf8 = Buffer.from(bruto, 'latin1').toString('utf8')
    const original = emUtf8.includes('�') ? bruto : emUtf8

    // O nome que se mostra: sem pastas, sem caracteres de controlo, curto.
    const nome =
      original
        .split(/[\\/]/)
        .pop()!
        .replace(/[\u0000-\u001f\u007f"]/g, '')
        .slice(-120) || 'arquivo'

    const relativo = join(conversaId, randomUUID())
    await mkdir(join(this.pasta, conversaId), { recursive: true })
    await writeFile(join(this.pasta, relativo), ficheiro.buffer)

    return this.gravar(c.id, souA, userId, {
      texto,
      anexoTipo: tipo,
      anexoCaminho: relativo,
      anexoNome: nome,
      // O Chrome grava voz como "video/webm" quando só há faixa de áudio.
      anexoMime: tipo === TipoDeAnexo.AUDIO ? mime.replace(/^video\//, 'audio/') : mime,
      anexoBytes: ficheiro.size,
      duracaoSeg:
        tipo === TipoDeAnexo.AUDIO && Number.isFinite(opcoes.duracaoSeg)
          ? Math.max(0, Math.min(3600, opcoes.duracaoSeg!))
          : null,
    })
  }

  /** O ficheiro de uma mensagem, só para os dois da conversa. */
  async anexo(userId: string, conversaId: string, mensagemId: string) {
    await this.daPessoa(conversaId, userId)
    const m = await this.prisma.mensagemPrivada.findFirst({
      where: { id: mensagemId, conversaId },
    })
    if (!m?.anexoCaminho) throw new NotFoundException('Arquivo não encontrado.')
    const caminho = resolve(this.pasta, m.anexoCaminho)
    // Nunca fora da pasta, mesmo que um caminho na base estivesse adulterado.
    if (!caminho.startsWith(this.pasta)) throw new NotFoundException('Arquivo não encontrado.')
    const mime = m.anexoMime ?? 'application/octet-stream'
    const mostravel =
      (m.anexoTipo === TipoDeAnexo.IMAGEM && IMAGENS_SEGURAS.has(mime)) ||
      (m.anexoTipo === TipoDeAnexo.AUDIO && AUDIOS_SEGUROS.test(mime))
    return {
      caminho,
      nome: m.anexoNome ?? 'arquivo',
      tipoDeConteudo: mostravel ? mime : 'application/octet-stream',
      mostravel,
    }
  }
}
