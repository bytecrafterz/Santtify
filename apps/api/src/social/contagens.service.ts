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

  /**
   * Os quatro números de PROJETOS inteiros, para o carrossel do perfil.
   *
   * O cliente descreveu-o no ponto 1: o cartão do projeto mostra o total
   * acumulado de tudo o que está lá dentro — se as letras todas somarem 100.000
   * visualizações, é 100.000 que aparece no cartão do Jesus Alfabeto Saudável.
   *
   * ESTÁ AQUI, E NÃO NO SERVIÇO DO CARROSSEL, pelo motivo que está escrito no
   * topo desta classe: a conta de "quantas partilhas tem isto" já esteve em
   * dois sítios e as duas cópias divergiram. O carrossel é mais um ecrã a
   * mostrar estes números, por isso pergunta a quem já sabe contá-los.
   *
   * Em consultas agrupadas e não uma por projeto: o carrossel desenha todos de
   * uma vez, e perguntar um a um é o atalho que leva a guardar contadores.
   */
  async deProjectos(projectIds: string[]): Promise<Map<string, Contagens>> {
    const mapa = new Map<string, Contagens>()
    if (!projectIds.length) return mapa
    for (const id of projectIds) mapa.set(id, { ...ZERO })

    const somar = (id: string | null, campo: keyof Contagens, quanto: number) => {
      if (!id) return
      const actual = mapa.get(id)
      if (actual) actual[campo] += quanto
    }

    const [
      views,
      likes,
      curtidasDoProjeto,
      curtidasDeFaixas,
      topo,
      respostas,
      partilhasEmLinha,
      partilhasEmEvento,
    ] = await Promise.all([
      /*
        AS VISUALIZAÇÕES DO PROJETO SÃO A SOMA DO QUE ELE CONSEGUE CONFERIR.

        Duas correcções, ambas apanhadas por ele em 21/09.

        A primeira: contavam-se só as aberturas de CONTEÚDO, e o "Minha
        Identidade" aparecia com zero visualizações apesar de quinze pessoas
        terem aberto a página do projeto. As páginas dele ainda não estão
        publicadas, portanto conteúdo nenhum podia ser aberto — e mesmo assim
        houve gente lá. A página do projeto conta.

        A segunda: a soma incluía as visualizações de CARTÃO (os eventos com
        `blockId`), que o número de cada letra deixa de fora. O total do projeto
        ficava maior do que a soma das letras, e ele não tinha como o explicar.
        Agora a regra é a mesma nos dois sítios.
      */
      this.prisma.$queryRaw<Array<{ projectId: string; total: number }>>`
        SELECT "projectId", count(*)::int AS total
        FROM events
        WHERE "projectId" = ANY(${projectIds}::uuid[])
          AND (
            (type = 'CONTENT_VIEW' AND (props -> 'blockId') IS NULL)
            OR type = 'PAGE_VIEW'
          )
        GROUP BY "projectId"`,
      this.prisma.reaction.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, type: ReactionType.LIKE },
        _count: { _all: true },
      }),
      /*
        AS CURTIDAS NO PRÓPRIO PROJETO, desde 19/09.

        O coração do card passou a curtir o projeto inteiro, e essas curtidas
        somam-se às das publicações lá dentro. É o mesmo número que ele já via
        crescer — "o total de tudo o que está dentro do projeto" — com mais uma
        forma de crescer.

        Os comentários não precisam de linha nova: já se contam por projeto, e
        um comentário no projeto tem `projectId` como qualquer outro.
      */
      this.prisma.projectReaction.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, type: ReactionType.LIKE },
        _count: { _all: true },
      }),
      /*
        E AS CURTIDAS DAS FAIXAS, que é onde as pessoas curtem.

        O coração que a criança toca está debaixo de cada música, e essas
        curtidas vivem em `block_reactions` — uma tabela que não tem `projectId`
        e que esta soma nunca abria. Em 21/09 o projeto mostrava 5 curtidas
        enquanto as faixas dele tinham 74. Ele contou três publicações à mão e
        viu que não batia certo; tinha razão, e por muito mais do que pensava.
      */
      this.prisma.$queryRaw<Array<{ projectId: string; total: number }>>`
        SELECT c."projectId", count(*)::int AS total
        FROM block_reactions br
        JOIN content_blocks b ON b.id = br."blockId"
        JOIN contents c ON c.id = b."contentId"
        WHERE c."projectId" = ANY(${projectIds}::uuid[])
          AND br.type = 'LIKE'
        GROUP BY c."projectId"`,
      this.prisma.comment.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          status: 'PUBLISHED',
          parentId: null,
          user: { is: { status: 'ACTIVE' } },
        },
        _count: { _all: true },
      }),
      this.prisma.comment.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          status: 'PUBLISHED',
          parent: { is: { status: 'PUBLISHED' } },
          user: { is: { status: 'ACTIVE' } },
        },
        _count: { _all: true },
      }),
      this.prisma.share.groupBy({
        by: ['shortLinkId'],
        where: { shortLink: { is: { projectId: { in: projectIds } } } },
        _count: { _all: true },
      }),
      this.prisma.event.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          type: EventType.CUSTOM,
          OR: this.accoesDePartilha.map((acao) => ({
            props: { path: ['acao'], equals: acao },
          })),
        },
        _count: { _all: true },
      }),
    ])

    for (const l of views) somar(l.projectId, 'views', l.total)
    for (const l of likes) somar(l.projectId, 'likes', l._count._all)
    for (const l of curtidasDoProjeto) somar(l.projectId, 'likes', l._count._all)
    for (const l of curtidasDeFaixas) somar(l.projectId, 'likes', l.total)
    for (const l of topo) somar(l.projectId, 'comments', l._count._all)
    for (const l of respostas) somar(l.projectId, 'comments', l._count._all)
    for (const l of partilhasEmEvento) somar(l.projectId, 'shares', l._count._all)

    // As partilhas antigas penduram-se no link curto. Mesma tradução que em
    // `deConteudos`, e pelo mesmo motivo: uma consulta em vez de uma por link.
    if (partilhasEmLinha.length) {
      const links = await this.prisma.shortLink.findMany({
        where: { id: { in: partilhasEmLinha.map((s) => s.shortLinkId) } },
        select: { id: true, projectId: true },
      })
      const deQuem = new Map(links.map((l) => [l.id, l.projectId]))
      for (const s of partilhasEmLinha) {
        somar(deQuem.get(s.shortLinkId) ?? null, 'shares', s._count._all)
      }
    }

    return mapa
  }

  /** Os quatro números de um conteúdo, contados agora. */
  /**
   * UMA VISITA AO CONTEÚDO É UM EVENTO SEM BLOCO.
   *
   * O olho de cada publicação conta eventos `CONTENT_VIEW` que trazem o
   * `blockId`; o olho do CONTEÚDO conta as aberturas do conteúdo. São dois
   * números diferentes e estavam a sair da mesma contagem: qualquer evento com
   * `contentId` entrava aqui, incluindo um por cada cartão desenhado.
   *
   * Media-se na base dele: a Letra A dizia 3458 visualizações, que são 603
   * aberturas mais 2855 eventos de cartão. O número não era grande por ser
   * popular, era grande por ter sete cartões.
   *
   * Isto ficou à vista em 08/09, quando passei a emitir os eventos de cartão
   * também no Produto Vivo e na Introdução: sem esta linha, o número do
   * conteúdo deles quadruplicava de um dia para o outro sem ninguém ter
   * chegado. Corrigir um contador não pode ser estragar o do lado.
   */
  private async viewsDoConteudo(contentId: string): Promise<number> {
    const [linha] = await this.prisma.$queryRaw<Array<{ total: number }>>`
      SELECT count(*)::int AS total
      FROM events
      WHERE "contentId" = ${contentId}::uuid
        AND type = 'CONTENT_VIEW'
        -- A chave ausente devolve NULL: é assim que se distingue a abertura do
        -- conteúdo de uma visualização de cartão. Escrito em SQL e não pelo
        -- filtro de JSON do Prisma porque ali a negação de um caminho ausente
        -- não é fiável, e um contador que falha calado é o pior dos dois mundos.
        AND (props -> 'blockId') IS NULL`
    return linha?.total ?? 0
  }

  private async viewsDosConteudos(contentIds: string[]): Promise<Map<string, number>> {
    const linhas = await this.prisma.$queryRaw<Array<{ contentId: string; total: number }>>`
      SELECT "contentId", count(*)::int AS total
      FROM events
      WHERE "contentId" = ANY(${contentIds}::uuid[])
        AND type = 'CONTENT_VIEW'
        AND (props -> 'blockId') IS NULL
      GROUP BY "contentId"`
    return new Map(linhas.map((l) => [l.contentId, l.total]))
  }

  async deConteudo(contentId: string, escondidos: string[] = []): Promise<Contagens> {
    const [views, likes, comments, shares] = await Promise.all([
      this.viewsDoConteudo(contentId),
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
      this.viewsDosConteudos(contentIds),
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

    for (const [id, total] of views) somar(id, 'views', total)
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
