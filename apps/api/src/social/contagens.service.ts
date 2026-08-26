import { Injectable } from '@nestjs/common'
import { EventType, ReactionType } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'

/** Os quatro números que aparecem debaixo de qualquer publicação. */
export interface Contagens {
  views: number
  likes: number
  comments: number
  shares: number
}

const ZERO: Contagens = { views: 0, likes: 0, comments: 0, shares: 0 }

/**
 * Quem conta, e a regra de como se conta.
 *
 * ISTO EXISTE PORQUE A MESMA CONTA ESTAVA ESCRITA EM DOIS SÍTIOS.
 *
 * Havia uma tabela `content_stats` somada a cada comentário e subtraída a cada
 * remoção, e havia a contagem feita na hora. Um contador assim só está certo
 * enquanto nenhum passo falhar, e em 27/08 mostrava MENOS TRÊS comentários na
 * introdução. Um número negativo ao lado de um conteúdo não é um número errado,
 * é um número que denuncia a forma como foi obtido.
 *
 * Pior: eu já tinha corrigido a contagem em 26/08, mas corrigi a que a lista
 * usa, e o ecrã lia a outra. Corrigir uma cópia nunca resolve; o que resolve é
 * não haver segunda cópia. A regra passa a viver aqui, e todos os sítios que
 * mostram estes números perguntam a este serviço.
 *
 * Sem dependências além do Prisma, de propósito: assim tanto a parte pública
 * como o painel a podem importar sem que os módulos se fechem em círculo.
 */
@Injectable()
export class ContagensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * CONTA SÓ O QUE PODE MESMO APARECER.
   *
   * Comentários de topo, mais as respostas cujo comentário-pai ainda está
   * publicado. Uma resposta cujo pai foi apagado fica órfã: o pai já não se
   * desenha, e uma resposta desenha-se DENTRO do pai, por isso ela não tem onde
   * aparecer. Contá-la é prometer à pessoa uma conversa que ela não vai
   * encontrar, que foi a queixa dele em 26/08.
   *
   * `escondidos` são as contas que o leitor bloqueou. Vem de fora porque isso
   * depende de quem está a olhar, e não do conteúdo.
   */
  async comentarios(
    onde: { contentId?: string; blockId?: string; profileUserId?: string },
    escondidos: string[] = [],
  ) {
    const base = {
      ...onde,
      status: 'PUBLISHED' as const,
      ...(escondidos.length ? { userId: { notIn: escondidos } } : {}),
    }
    const [topo, respostas] = await Promise.all([
      this.prisma.comment.count({ where: { ...base, parentId: null } }),
      this.prisma.comment.count({ where: { ...base, parent: { is: { status: 'PUBLISHED' } } } }),
    ])
    return topo + respostas
  }

  /**
   * Comentários de um projecto inteiro, para o painel de métricas.
   *
   * Mesma regra do resto, mais o filtro de contas removidas: o número que ele
   * apresenta a uma empresa não pode incluir comentários de gente que já não
   * existe na plataforma, nem respostas órfãs que ninguém consegue abrir.
   */
  async comentariosDoProjecto(projectId: string) {
    const base = {
      projectId,
      status: 'PUBLISHED' as const,
      user: { is: { status: 'ACTIVE' as const } },
    }
    const [topo, respostas] = await Promise.all([
      this.prisma.comment.count({ where: { ...base, parentId: null } }),
      this.prisma.comment.count({ where: { ...base, parent: { is: { status: 'PUBLISHED' } } } }),
    ])
    return topo + respostas
  }

  /** Os quatro números de um conteúdo, contados agora. */
  async deConteudo(contentId: string, escondidos: string[] = []): Promise<Contagens> {
    const [views, likes, comments, shares] = await Promise.all([
      this.prisma.event.count({ where: { contentId, type: EventType.CONTENT_VIEW } }),
      this.prisma.reaction.count({ where: { contentId, type: ReactionType.LIKE } }),
      this.comentarios({ contentId }, escondidos),
      this.prisma.share.count({ where: { shortLink: { is: { contentId } } } }),
    ])
    return { views, likes, comments, shares }
  }

  /**
   * O mesmo para uma lista, em quatro consultas em vez de quatro por conteúdo.
   *
   * A grade tem 28 conteúdos. Perguntar um a um seriam mais de cem idas à base
   * de dados para desenhar uma página, e é por atalhos assim que se acaba com um
   * contador guardado que depois deriva.
   *
   * As respostas órfãs ficam de fora aqui como ficam lá: conta-se o que tem pai
   * publicado, e os comentários de topo à parte.
   */
  async deConteudos(contentIds: string[]): Promise<Map<string, Contagens>> {
    const mapa = new Map<string, Contagens>()
    if (!contentIds.length) return mapa
    for (const id of contentIds) mapa.set(id, { ...ZERO })

    const somar = (id: string | null, campo: keyof Contagens, quanto: number) => {
      if (!id) return
      const actual = mapa.get(id)
      if (actual) actual[campo] += quanto
    }

    const [views, likes, topo, respostas, shares] = await Promise.all([
      this.prisma.event.groupBy({
        by: ['contentId'],
        where: { contentId: { in: contentIds }, type: EventType.CONTENT_VIEW },
        _count: { _all: true },
      }),
      this.prisma.reaction.groupBy({
        by: ['contentId'],
        where: { contentId: { in: contentIds }, type: ReactionType.LIKE },
        _count: { _all: true },
      }),
      this.prisma.comment.groupBy({
        by: ['contentId'],
        where: { contentId: { in: contentIds }, status: 'PUBLISHED', parentId: null },
        _count: { _all: true },
      }),
      this.prisma.comment.groupBy({
        by: ['contentId'],
        where: {
          contentId: { in: contentIds },
          status: 'PUBLISHED',
          parent: { is: { status: 'PUBLISHED' } },
        },
        _count: { _all: true },
      }),
      this.prisma.share.groupBy({
        by: ['shortLinkId'],
        where: { shortLink: { is: { contentId: { in: contentIds } } } },
        _count: { _all: true },
      }),
    ])

    for (const l of views) somar(l.contentId, 'views', l._count._all)
    for (const l of likes) somar(l.contentId, 'likes', l._count._all)
    for (const l of topo) somar(l.contentId, 'comments', l._count._all)
    for (const l of respostas) somar(l.contentId, 'comments', l._count._all)

    // As partilhas penduram-se no link curto, e não no conteúdo. Traduz-se de
    // uma vez em vez de perguntar por cada link.
    if (shares.length) {
      const links = await this.prisma.shortLink.findMany({
        where: { id: { in: shares.map((s) => s.shortLinkId) } },
        select: { id: true, contentId: true },
      })
      const deQuem = new Map(links.map((l) => [l.id, l.contentId]))
      for (const s of shares) somar(deQuem.get(s.shortLinkId) ?? null, 'shares', s._count._all)
    }

    return mapa
  }
}
