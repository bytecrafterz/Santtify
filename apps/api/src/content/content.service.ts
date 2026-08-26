import { Injectable, NotFoundException } from '@nestjs/common'
import { BlockType, CardEstado, ContentStatus, EventType } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { ShortLinksService } from '../short-links/short-links.service'

/**
 * Leitura de conteúdo para o PWA.
 *
 * Nada aqui sabe o que é uma letra. Recebe slug de projeto e slug de conteúdo,
 * devolve blocos ordenados. É a mesma consulta que vai servir o próximo
 * projeto sem uma linha nova.
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shortLinks: ShortLinksService,
  ) {}

  async projeto(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        branding: true,
        status: true,
        checkoutUrl: true,
      },
    })
    if (!project || project.status === 'ARCHIVED') {
      throw new NotFoundException('Projeto não encontrado')
    }
    return project
  }

  /**
   * Índice do projeto: as 26 letras, publicadas e por publicar.
   *
   * Devolve também as que ainda não têm conteúdo, marcadas como trancadas.
   * Foi decisão do cliente em 19/08 e é a correcta: uma grade com buracos
   * parece defeito do site, uma grade com cadeados parece promessa — e é o
   * cadeado que faz a família voltar na semana seguinte para ver se abriu.
   *
   * Do que está trancado sai só o nome e a posição. Capa, resumo e números
   * ficam de fora: uma letra por publicar é material que ele ainda está a
   * preparar, e a grade não é sítio para o mostrar antes de tempo.
   */
  async listar(projectSlug: string) {
    const project = await this.projeto(projectSlug)
    const projeto = await this.prisma.project.findUnique({
      where: { id: project.id },
      select: { hostUserId: true },
    })

    const todas = await this.prisma.content.findMany({
      where: {
        projectId: project.id,
        status: { in: [ContentStatus.PUBLISHED, ContentStatus.DRAFT] },
      },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        coverUrl: true,
        position: true,
        letra: true,
        status: true,
        stats: { select: { views: true, likes: true, comments: true, shares: true } },
        /**
         * A ARTE DO PRIMEIRO CARTÃO, para servir de capa quando a letra não
         * tiver uma sua.
         *
         * A Letra A tinha capa e a B não, e na grade a B ficava um quadrado
         * escuro com uma letra dentro, entre casas com arte. Ele descreveu-a
         * como "toda preta" e pediu o certo: a primeira foto preenche a capa,
         * automaticamente, em todas as letras.
         *
         * Faz sentido para além do aspecto. Ele já enviou aquela arte uma vez ao
         * publicar o primeiro cartão; obrigá-lo a enviá-la outra vez como capa é
         * trabalho a dobrar em 26 letras, e é trabalho que ele vai esquecer em
         * metade delas.
         */
        blocks: {
          where: { type: BlockType.AUDIO, imageAssetId: { not: null } },
          orderBy: [{ slot: 'asc' }, { position: 'asc' }],
          take: 1,
          select: { imageAsset: { select: { url: true } } },
        },
      },
    })

    const contents = todas.map((c) => {
      const publicado = c.status === ContentStatus.PUBLISHED
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        position: c.position,
        letra: c.letra,
        publicado,
        subtitle: publicado ? c.subtitle : null,
        coverUrl: publicado ? (c.coverUrl ?? c.blocks[0]?.imageAsset?.url ?? null) : null,
        stats: publicado ? c.stats : null,
      }
    })

    // Contadores públicos que o cliente pediu em 19/08: quantas famílias já
    // criaram perfil e quantas vezes o material foi mandado imprimir.
    //
    // Os perfis contam-se pelo elo visitante → utilizador, e não pela tabela de
    // utilizadores: a conta é global à plataforma, o visitante é que pertence a
    // um projeto. Quando existir um segundo produto, este número continua a
    // dizer a verdade sobre este.
    //
    // As impressões saem do log de eventos que já existe. Nenhuma tabela nova
    // foi precisa — é o mesmo retorno da decisão de gravar evento bruto.
    const [perfis, impressoes] = await Promise.all([
      this.prisma.visitor
        .findMany({
          where: { projectId: project.id, userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((v) => v.length),
      this.prisma.event.count({
        where: { projectId: project.id, type: EventType.CUSTOM, props: { path: ['acao'], equals: 'imprimir' } },
      }),
    ])

    // O perfil anfitrião: o rosto do projeto, igual para toda a gente que chega.
    // Sem um escolhido, usa-se o administrador — é quem já é dono disto, e é
    // melhor um rosto por omissão do que uma porta de entrada anónima.
    const anfitriao = await this.prisma.user.findFirst({
      where: projeto?.hostUserId
        ? { id: projeto.hostUserId }
        : { role: 'ADMIN', status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        guardianName: true,
        createdAt: true,
      },
    })

    return {
      project,
      anfitriao,
      contents,
      /**
       * A contagem é das LETRAS, e só delas.
       *
       * Antes contava tudo o que existisse na lista, e por isso a introdução
       * do projeto entrava nas 26 e empurrava o alfabeto uma casa. O que não
       * tem letra existe, aparece, e não conta.
       */
      progresso: {
        liberadas: contents.filter((c) => c.publicado && c.letra).length,
        total: 26,
      },
      comunidade: { perfis, impressoes },
    }
  }

  /**
   * "Reproduzir todas": as faixas do projeto, em ordem, com a categoria de cada
   * uma.
   *
   * Devolve TUDO de uma vez, com as categorias junto, em vez de uma consulta
   * por filtro. São no máximo algumas dezenas de faixas, e assim trocar de
   * "só músicas" para "só explicações" é instantâneo, sem ida ao servidor e sem
   * a música parar no meio da troca.
   *
   * Uma letra pode ter vários áudios (explicação, música, memorização,
   * oração), então a fila é por FAIXA e não por letra. A ordem é a da letra e,
   * dentro dela, a ordem dos blocos que o dono definiu no painel.
   *
   * Só entram letras publicadas com áudio de verdade: uma faixa vazia no meio
   * da fila faria o tocador parar em silêncio, e isso se lê como defeito.
   */
  async playlist(projectSlug: string) {
    const project = await this.projeto(projectSlug)

    const contents = await this.prisma.content.findMany({
      where: {
        projectId: project.id,
        status: ContentStatus.PUBLISHED,
        blocks: { some: { type: BlockType.AUDIO, assetId: { not: null } } },
      },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        coverUrl: true,
        blocks: {
          where: { type: BlockType.AUDIO, assetId: { not: null } },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            label: true,
            category: { select: { slug: true, name: true, position: true } },
            imageAsset: { select: { url: true } },
            asset: { select: { url: true, mimeType: true, durationMs: true } },
          },
        },
      },
    })

    const faixas = contents.flatMap((c) =>
      c.blocks.map((b) => ({
        id: b.id,
        contentId: c.id,
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        // A arte da própria faixa quando existir; a capa da letra como
        // reserva, para o tocador nunca ficar sem imagem no meio da fila.
        coverUrl: b.imageAsset?.url ?? c.coverUrl,
        // O rótulo do bloco descreve a faixa ("Explicação e música"); a
        // categoria é o que agrupa as faixas entre letras diferentes.
        rotulo: b.label,
        categoria: b.category?.slug ?? null,
        categoriaNome: b.category?.name ?? null,
        url: b.asset!.url,
        mimeType: b.asset!.mimeType,
        durationMs: b.asset!.durationMs,
      })),
    )

    // Só as categorias que têm faixa. Oferecer "só orações" numa lista sem
    // nenhuma oração é prometer o que não existe.
    const porCategoria = new Map<string, { slug: string; nome: string; posicao: number; total: number }>()
    for (const c of contents) {
      for (const b of c.blocks) {
        if (!b.category) continue
        const atual = porCategoria.get(b.category.slug)
        if (atual) atual.total++
        else
          porCategoria.set(b.category.slug, {
            slug: b.category.slug,
            nome: b.category.name,
            posicao: b.category.position,
            total: 1,
          })
      }
    }
    const categorias = [...porCategoria.values()].sort(
      (a, b) => a.posicao - b.posicao || a.nome.localeCompare(b.nome),
    )

    return { project, categorias, faixas }
  }

  /** Página de um conteúdo, com os blocos que o admin montou. */
  async porSlug(projectSlug: string, contentSlug: string) {
    const project = await this.projeto(projectSlug)

    const content = await this.prisma.content.findUnique({
      where: { projectId_slug: { projectId: project.id, slug: contentSlug } },
      include: {
        blocks: {
          orderBy: { position: 'asc' },
          include: {
            imageAsset: { select: { url: true, width: true, height: true } },
            // A CATEGORIA VIAJA COM O BLOCO.
            // Sem isto o filtro do tocador não tinha como saber a que grupo
            // cada faixa pertence, e por isso vivia de uma lista escrita à mão
            // no código — que foi o que fez a "Música Alegre" dele não
            // aparecer em lado nenhum depois de criada.
            category: { select: { slug: true, name: true } },
            asset: {
              select: { id: true, kind: true, url: true, mimeType: true, durationMs: true, title: true, altText: true },
            },
          },
        },
        stats: true,
        shortLink: {
          where: { kind: 'CONTENT_QR', active: true },
          select: { code: true },
          take: 1,
        },
      },
    })

    if (!content || content.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException('Conteúdo não encontrado')
    }

    // Vizinhos, para navegar entre letras sem voltar ao índice.
    const [anterior, proximo] = await Promise.all([
      this.prisma.content.findFirst({
        where: { projectId: project.id, status: ContentStatus.PUBLISHED, position: { lt: content.position } },
        orderBy: { position: 'desc' },
        select: { slug: true, title: true },
      }),
      this.prisma.content.findFirst({
        where: { projectId: project.id, status: ContentStatus.PUBLISHED, position: { gt: content.position } },
        orderBy: { position: 'asc' },
        select: { slug: true, title: true },
      }),
    ])

    const code = content.shortLink[0]?.code ?? null

    return {
      project,
      content: {
        id: content.id,
        slug: content.slug,
        /**
         * A LETRA vai junto, e não só o slug.
         *
         * Os slugs desta base ficaram trocados de quando as letras eram
         * identificadas pela posição: a Letra A vive no slug "b". Corrigir
         * slugs partiria os QR Codes já impressos, que não se corrigem depois.
         * A letra é a identidade certa, e é por ela que a página se orienta.
         */
        letra: content.letra,
        title: content.title,
        subtitle: content.subtitle,
        summary: content.summary,
        coverUrl: content.coverUrl,
        shareCardUrl: content.shareCardUrl,
        freeFileUrl: content.freeFileUrl,
        freeFileName: content.freeFileName,
        position: content.position,
        /**
         * SÓ OS CARTÕES INTEIROS CHEGAM À PÁGINA.
         *
         * Um cartão é imagem, áudio, título e descrição — e enquanto faltar
         * qualquer um deles fica em rascunho e não sai daqui. É o que o cliente
         * pediu em 23/08, depois de quatro dias a ver a fotografia aparecer
         * separada do áudio: o servidor deixa de ter como devolver meia peça.
         *
         * Os blocos de texto soltos continuam a passar. São o texto educativo
         * que ele escreveu enquanto a letra era um cartão só, e apagá-los agora
         * seria perder texto dele sem ele o ter pedido.
         */
        /**
         * O CARTÃO CHEGA À PÁGINA ASSIM QUE TIVER ALGUMA COISA DENTRO.
         *
         * Eu tinha escondido daqui tudo o que fosse rascunho, e isso apagou a
         * Letra A do ar — os quatro cartões tinham áudio e título e faltava-lhes
         * a imagem. Foi longe de mais, e a culpa é de eu ter lido só metade do
         * que ele escreveu em 23/08. A outra metade diz o contrário:
         *
         *   "Se eu colocar somente o áudio, o espaço da imagem continuará
         *    visível. Se ainda não houver título ou texto, os lugares deles
         *    permanecerão em branco dentro da mesma estrutura."
         *
         * Ou seja: o que tem de ser indivisível é a ESTRUTURA, não o momento em
         * que ela aparece. Um cartão a que falte a foto continua a ser um
         * cartão, com o lugar da foto lá dentro — e isso é exactamente o
         * oposto de uma fotografia solta noutro sítio da página.
         *
         * "Rascunho" continua a existir e continua a impedir o botão de
         * publicar no painel. O que não faz é apagar do ar o que já lá estava.
         */
        blocks: content.blocks
          .filter((b) => b.type !== 'AUDIO' || Boolean(b.assetId) || Boolean(b.imageAssetId))
          .map((b) => ({
            id: b.id,
            type: b.type,
            slot: b.slot,
            papel: b.papel,
            label: b.label,
            titulo: b.titulo,
            text: b.text,
            url: b.url,
            linkUpgrade: b.linkUpgrade,
            categoria: b.category?.slug ?? null,
            categoriaNome: b.category?.name ?? null,
            asset: b.asset,
            arte: b.imageAsset?.url ?? null,
            meta: b.meta,
          })),
        stats: content.stats ?? { views: 0, likes: 0, comments: 0, shares: 0 },
        qrCode: code,
        qrUrl: code ? this.shortLinks.urlPublica(code) : null,
      },
      navegacao: { anterior, proximo },
    }
  }

  /**
   * As categorias de áudio deste projeto.
   *
   * Ele criou "Música Alegre" no painel e perguntou porque não aparecia no
   * filtro do tocador. A resposta é que o filtro nunca leu daqui: era uma lista
   * de cinco nomes escrita à mão no código. Ele assumiu um comportamento que eu
   * nunca tinha construído, e a pergunta dele ficou sem resposta enquanto eu
   * corria atrás de outras coisas.
   *
   * Passa a ler daqui. Cria uma categoria no painel e ela aparece no filtro.
   */
  async categoriasDoProjeto(projectSlug: string) {
    const project = await this.projeto(projectSlug)
    const categorias = await this.prisma.blockCategory.findMany({
      where: { projectId: project.id },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true },
    })
    return { categorias }
  }

  /**
   * As pessoas registadas neste projeto, para a lista de "perfis criados".
   *
   * Ele pediu-a em 25/08: tocar no número e ver quem são. Faz sentido — um
   * número de perfis sem ninguém por trás não diz nada a quem chega, e é
   * precisamente a confiança que uma comunidade infantil precisa de mostrar.
   *
   * SÓ O QUE É PÚBLICO: nome, fotografia e data de entrada. Nada de e-mail e
   * nada de contagens de actividade. Quem se regista numa plataforma para
   * crianças não está a autorizar que o examinem, e o e-mail de um menor não
   * aparece numa lista aberta por decisão nenhuma que eu possa tomar sozinho.
   *
   * Contam-se pelo elo visitante → utilizador, como a contagem que já existe,
   * para os dois números nunca se contradizerem no mesmo ecrã.
   */
  async pessoasDoProjeto(projectSlug: string) {
    const project = await this.projeto(projectSlug)

    const elos = await this.prisma.visitor.findMany({
      where: { projectId: project.id, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    })
    const ids = elos.map((e) => e.userId!).filter(Boolean)

    const pessoas = await this.prisma.user.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, displayName: true, avatarUrl: true, createdAt: true },
    })

    return { total: pessoas.length, pessoas }
  }

  /** SVG do QR, servido direto para impressão ou download pelo painel. */
  async qrSvg(projectSlug: string, contentSlug: string): Promise<string> {
    const project = await this.projeto(projectSlug)
    const content = await this.prisma.content.findUnique({
      where: { projectId_slug: { projectId: project.id, slug: contentSlug } },
      select: { id: true },
    })
    if (!content) throw new NotFoundException('Conteúdo não encontrado')

    const link = await this.prisma.shortLink.findFirst({
      where: { contentId: content.id, kind: 'CONTENT_QR', active: true },
      select: { code: true, qrSvg: true },
    })
    if (!link) throw new NotFoundException('QR Code não encontrado')

    // Links antigos podem não ter o SVG gravado; gera sob demanda.
    return link.qrSvg ?? (await this.shortLinks.gerarQrSvg(this.shortLinks.urlPublica(link.code)))
  }
}
