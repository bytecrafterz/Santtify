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
   * Quantos comentários é que a TELA vai conseguir desenhar desta lista.
   *
   * ESTE É O ÚNICO NÚMERO QUE PODE APARECER AO LADO DE UMA PUBLICAÇÃO.
   *
   * Contar na base de dados e desenhar no ecrã são duas perguntas diferentes, e
   * enquanto foram duas perguntas deram respostas diferentes. Em 26/08 o perfil
   * dele dizia 8 e ao abrir apareciam 2: os outros seis eram respostas cujo
   * comentário-pai não vinha na lista, e uma resposta desenha-se DENTRO do pai.
   * Sem pai, não há onde a pôr.
   *
   * Eu já tinha dito que estava corrigido, e tinha comparado o contador com a
   * lista que o servidor manda em vez de com o que a página desenha. Bateu, e
   * estava errado à mesma. A régua é a tela.
   *
   * Por isso este número não faz consulta nenhuma: recebe a MESMA lista que vai
   * ser enviada e conta o que dela é desenhável, com o mesmo percurso que o
   * PainelDeComentarios faz. Divergirem deixa de ser possível, porque passam a
   * ser a mesma coisa contada uma vez.
   */
  desenhaveis(lista: Array<{ id: string; parentId?: string | null }>): number {
    const porId = new Map(lista.map((c) => [c.id, c]))

    /** Sobe pelos pais que existem na lista até um comentário de topo. */
    const temRaizVisivel = (c: { id: string; parentId?: string | null }) => {
      let actual = c
      const vistos = new Set<string>()
      while (actual.parentId) {
        // Dados em ciclo não podem pendurar isto, como não penduram a tela.
        if (vistos.has(actual.id)) return false
        vistos.add(actual.id)
        const pai = porId.get(actual.parentId)
        if (!pai) return false
        actual = pai
      }
      return true
    }

    return lista.filter(temRaizVisivel).length
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

  /**
   * As três formas de partilhar que existem, somadas uma vez só.
   *
   * O painel dizia DUAS partilhas num projecto onde tinham sido feitas 55, e ele
   * apanhou-o em 26/08 porque tinha partilhado mais de dez vezes só ele. A conta
   * antiga olhava apenas para as linhas de `Share`, que nascem do fluxo antigo
   * do link rastreado. Partilhar uma faixa ou um perfil, que é o que se faz hoje
   * na plataforma, grava um evento e não uma linha, e ficava de fora.
   *
   * Nenhuma partilha grava as duas coisas, por isso somar não conta ninguém
   * duas vezes. Todas contam só depois da acção concluída: cancelar a folha de
   * partilha do telemóvel não conta, que é regra dele desde 20/08.
   */
  private get accoesDePartilha() {
    return ['partilhar_conteudo', 'partilhar_faixa', 'partilhar_perfil']
  }

  async partilhasDoProjecto(projectId: string) {
    const [linhas, eventos] = await Promise.all([
      this.prisma.share.count({ where: { shortLink: { is: { projectId } } } }),
      this.prisma.event.count({
        where: {
          projectId,
          type: EventType.CUSTOM,
          OR: this.accoesDePartilha.map((acao) => ({
            props: { path: ['acao'], equals: acao },
          })),
        },
      }),
    ])
    return linhas + eventos
  }

  /** Os quatro números de um conteúdo, contados agora. */
  async deConteudo(contentId: string, escondidos: string[] = []): Promise<Contagens> {
    const [views, likes, comments, shares] = await Promise.all([
      this.prisma.event.count({ where: { contentId, type: EventType.CONTENT_VIEW } }),
      this.prisma.reaction.count({ where: { contentId, type: ReactionType.LIKE } }),
      this.comentarios({ contentId }, escondidos),
      Promise.all([
        this.prisma.share.count({ where: { shortLink: { is: { contentId } } } }),
        this.prisma.event.count({
          where: {
            contentId,
            type: EventType.CUSTOM,
            props: { path: ['acao'], equals: 'partilhar_conteudo' },
          },
        }),
      ]).then(([linhas, eventos]) => linhas + eventos),
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
