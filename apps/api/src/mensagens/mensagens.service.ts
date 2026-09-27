import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/** O tamanho de uma mensagem. Chega para um parágrafo longo; não para um livro. */
export const MAXIMO_DE_CARACTERES = 4000
/** Quantas mensagens vêm de cada vez, das mais recentes para trás. */
const PAGINA = 200

const PESSOA = { id: true, displayName: true, username: true, avatarUrl: true } as const

/**
 * MENSAGENS PRIVADAS ENTRE DUAS CONTAS.
 *
 * Pedidas em 27/09 para o desenvolvedor e o Rossandro falarem dentro da
 * plataforma. Três regras, todas aqui e nenhuma só no ecrã:
 *
 *   1. Só um ADMINISTRADOR abre uma conversa. É uma plataforma de crianças, e
 *      mensagens privadas abertas a qualquer pessoa eram um risco que ninguém
 *      pediu. Aberta, os dois respondem.
 *   2. Só os dois participantes vêem a conversa. Quem não é um deles recebe
 *      "não encontrada", e não "proibida": nem a existência dela se confirma.
 *   3. Um bloqueio entre os dois, em qualquer sentido, pára o envio.
 */
@Injectable()
export class MensagensService {
  constructor(private readonly prisma: PrismaService) {}

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
        return {
          id: c.id,
          outra: souA ? c.userB : c.userA,
          ultima: ultima
            ? { texto: ultima.texto.slice(0, 140), minha: ultima.autorId === userId, em: ultima.criadaEm }
            : null,
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
      mensagens: recentes.reverse().map((m) => ({
        id: m.id,
        texto: m.texto,
        minha: m.autorId === userId,
        em: m.criadaEm,
        // O "visto" das minhas: a outra pessoa já abriu a conversa depois dela.
        vista: m.autorId === userId && !!lidaPelaOutraEm && lidaPelaOutraEm >= m.criadaEm,
      })),
    }
  }

  async enviar(userId: string, conversaId: string, texto: string) {
    const { c, souA, outra } = await this.daPessoa(conversaId, userId)
    const limpo = (texto ?? '').replace(/\r\n/g, '\n').trim()
    if (!limpo) throw new BadRequestException('Escreva uma mensagem.')
    if (limpo.length > MAXIMO_DE_CARACTERES) {
      throw new BadRequestException(`A mensagem passa de ${MAXIMO_DE_CARACTERES} caracteres.`)
    }

    const bloqueio = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: outra.id },
          { blockerId: outra.id, blockedId: userId },
        ],
      },
      select: { id: true },
    })
    if (bloqueio) throw new ForbiddenException('Não é possível enviar mensagens a esta pessoa.')

    const agora = new Date()
    const [m] = await this.prisma.$transaction([
      this.prisma.mensagemPrivada.create({ data: { conversaId: c.id, autorId: userId, texto: limpo, criadaEm: agora } }),
      this.prisma.conversaPrivada.update({
        where: { id: c.id },
        data: { ultimaEm: agora, ...(souA ? { lidaPorAEm: agora } : { lidaPorBEm: agora }) },
      }),
    ])
    return { id: m.id, texto: m.texto, minha: true, em: m.criadaEm, vista: false }
  }
}
