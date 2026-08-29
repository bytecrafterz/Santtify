import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { EventType, Platform, ReactionType, ReportReason, ReportTarget } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { ShortLinksService } from '../short-links/short-links.service'
import { EventsService } from '../tracking/events.service'
import { AttributionService } from '../tracking/attribution.service'
import { VisitContext } from '../tracking/attribution.types'
import { ContagensService } from './contagens.service'

/**
 * Módulo social — genérico sobre Content, nunca sobre "letra".
 *
 * É este módulo que vira a API white label do Produto Vivo na etapa seguinte:
 * ele recebe `contentId` e não faz ideia se aquilo é uma letra do alfabeto, um
 * Big Mac ou um par de tênis. Por isso nada aqui importa nada específico do
 * projeto do alfabeto.
 */
@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shortLinks: ShortLinksService,
    private readonly events: EventsService,
    private readonly attribution: AttributionService,
    private readonly contagens: ContagensService,
  ) {}

  /**
   * NINGUÉM SOMA NEM SUBTRAI CONTADORES AQUI.
   *
   * Havia cinco lugares neste ficheiro a mexer na tabela `content_stats`: mais
   * um ao curtir, menos um ao descurtir, mais um ao comentar, e por aí. Bastou
   * um desses passos correr sem o seu par para o número ficar errado para
   * sempre, e em 27/08 estava negativo. Os quatro números passam a ser contados
   * quando alguém os pede, pelo ContagensService. A tabela continua a existir
   * porque apagá-la é uma migração, mas já não é lida nem escrita por ninguém.
   */

  // ── Curtir ────────────────────────────────────────────────────────

  /**
   * Curtida é alternada: o mesmo botão dá e tira.
   *
   * O contador em `ContentStats` é atualizado junto, mas ele é só cache de
   * leitura — a verdade continua sendo a tabela `Reaction` e o log de eventos,
   * ambos recalculáveis. Se o contador divergir, recalcula-se.
   */
  async alternarCurtida(contentId: string, userId: string, ctx: VisitContext) {
    const content = await this.conteudoPublicado(contentId)
    const existente = await this.prisma.reaction.findUnique({
      where: {
        contentId_userId_type: { contentId, userId, type: ReactionType.LIKE },
      },
    })

    const visita = await this.attribution.resolveVisit({ ...ctx, userId })
    const atribuicao = { ...visita.attribution, userId }

    if (existente) {
      await this.prisma.reaction.delete({ where: { id: existente.id } })
      await this.events.registrar({ type: EventType.UNLIKE, attribution: atribuicao, contentId })
      return { curtido: false, total: await this.contarCurtidas(contentId) }
    }

    await this.prisma.reaction.create({
      data: { projectId: content.projectId, contentId, userId, type: ReactionType.LIKE },
    })
    await this.events.registrar({ type: EventType.LIKE, attribution: atribuicao, contentId })
    return { curtido: true, total: await this.contarCurtidas(contentId) }
  }

  private contarCurtidas(contentId: string) {
    return this.prisma.reaction.count({ where: { contentId, type: ReactionType.LIKE } })
  }

  // ── Comentar ──────────────────────────────────────────────────────

  /**
   * Comentários da letra, já sem os de quem esta pessoa bloqueou.
   *
   * O filtro é aplicado na leitura e não no momento de bloquear: apagar o que
   * o outro escreveu seria censura global a partir da decisão de uma pessoa.
   * Bloquear é "não me mostres", não "apaga para todos".
   */
  async listarComentarios(contentId: string, limite = 100, leitorId: string | null = null) {
    const escondidos = await this.bloqueadosPor(leitorId)
    const lista = await this.prisma.comment.findMany({
      where: {
        contentId,
        status: 'PUBLISHED',
        ...(escondidos.length ? { userId: { notIn: escondidos } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limite,
      select: {
        id: true,
        body: true,
        createdAt: true,
        parentId: true,
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    })
    return this.comSinalDeCurtida(lista, leitorId)
  }

  async comentar(
    contentId: string,
    userId: string,
    dados: { body: string; parentId?: string },
    ctx: VisitContext,
  ) {
    const content = await this.conteudoPublicado(contentId)
    const corpo = dados.body.trim()
    if (!corpo) throw new BadRequestException('O comentário está vazio')

    // Resposta só pode apontar para comentário do MESMO conteúdo — sem isso,
    // dá para pendurar uma resposta em qualquer comentário do sistema.
    if (dados.parentId) {
      const pai = await this.prisma.comment.findUnique({
        where: { id: dados.parentId },
        select: { contentId: true },
      })
      if (!pai || pai.contentId !== contentId) {
        throw new BadRequestException('Comentário original não encontrado')
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        projectId: content.projectId,
        contentId,
        userId,
        body: corpo,
        parentId: dados.parentId ?? null,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        parentId: true,
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    })

    const visita = await this.attribution.resolveVisit({ ...ctx, userId })
    await this.events.registrar({
      type: EventType.COMMENT,
      attribution: { ...visita.attribution, userId },
      contentId,
      props: { commentId: comment.id, resposta: Boolean(dados.parentId) },
    })

    return comment
  }

  async removerComentario(commentId: string, userId: string, ehAdmin: boolean) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, contentId: true, status: true },
    })
    if (!comment || comment.status !== 'PUBLISHED') {
      throw new NotFoundException('Comentário não encontrado')
    }
    if (comment.userId !== userId && !ehAdmin) {
      throw new ForbiddenException('Você só pode apagar os seus comentários')
    }

    // Marca como apagado em vez de remover: o comentário pode ter respostas
    // penduradas, e some-lo levaria a conversa inteira junto.
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { status: 'DELETED', deletedAt: new Date() },
    })
  }

  // ── Compartilhar ──────────────────────────────────────────────────

  /**
   * O coração da propagação.
   *
   * Gera um link identificável por usuário e por conteúdo — é assim que se
   * mede quem trouxe quem sem entrar em nenhuma conversa privada, que foi
   * exatamente o pedido do cliente.
   *
   * O elo da cadeia vem do `acquiredViaLinkId` do visitante: o link pelo qual
   * QUEM ESTÁ COMPARTILHANDO chegou. Com isso o novo link herda a raiz e soma
   * 1 na profundidade, e a árvore Instagram → A → B → C fica reconstruível.
   */
  /**
   * Clique no botão de comprar: registra o evento e devolve o link já
   * carimbado com a origem.
   *
   * O evento é gravado ANTES de a pessoa sair, porque depois de sair do site
   * não há segunda chance: a próxima coisa que acontece é a Hotmart, e ela não
   * sabe nada do que houve aqui. Este é o último passo do funil que o cliente
   * descreveu em 08/08 — entrada, cadastro, interação, compartilhamento e
   * clique em comprar — e era o único que faltava, por não existir botão.
   *
   * O que vai no link é a ORIGEM, não a pessoa: `pv-instagram-video03`. Assim,
   * quando a confirmação de compra da Hotmart for ligada, cada venda volta
   * dizendo de qual canal e campanha veio. Mandar um identificador do visitante
   * resolveria o mesmo problema com mais precisão, mas seria entregar um dado
   * pessoal pseudonimizado a um terceiro — e a nossa política de privacidade
   * diz, com todas as letras, que isso não é feito.
   */
  async cliqueDeCompra(contentId: string, ctx: VisitContext, userId: string | null) {
    const content = await this.conteudoPublicado(contentId)
    const projeto = await this.prisma.project.findUnique({
      where: { id: content.projectId },
      select: { checkoutUrl: true },
    })
    if (!projeto?.checkoutUrl) {
      throw new NotFoundException('Este projeto ainda não tem link de compra')
    }

    const visita = await this.attribution.resolveVisit({ ...ctx, userId: userId ?? undefined })
    const a = visita.attribution

    // A referência da campanha (o vídeo, o post) chega na URL de entrada e fica
    // gravada no evento daquela visita. Este clique, porém, é uma requisição
    // nova e sem aqueles parâmetros: resolvido sozinho, ele sairia sabendo o
    // canal e não sabendo QUAL publicação trouxe a pessoa.
    //
    // Então lê-se o histórico do próprio visitante, em vez de reescrevê-lo —
    // mesma solução usada no perfil para contar o que aconteceu antes do
    // cadastro. Sem isto, "conversão por campanha" nunca sairia do zero, que é
    // exatamente o exemplo que o cliente deu: Instagram → Vídeo 03 → compras.
    let campanha = a.campaignRef
    if (!campanha && a.visitorId) {
      const anterior = await this.prisma.event.findFirst({
        where: { visitorId: a.visitorId, campaignRef: { not: null } },
        orderBy: { occurredAt: 'desc' },
        select: { campaignRef: true },
      })
      campanha = anterior?.campaignRef ?? null
    }

    // A campanha entra também NO EVENTO, e não só no endereço que vai para a
    // Hotmart: sem isso, o painel dele contaria cliques por canal mas não por
    // publicação, e a resposta ficaria só do lado de fora.
    await this.events.registrar({
      type: EventType.CHECKOUT_CLICKED,
      attribution: { ...a, campaignRef: campanha, userId: userId ?? a.userId },
      contentId,
      props: { destino: 'externo' },
    })

    const limpar = (v: string | null | undefined) =>
      (v ?? '')
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    const origem = ['pv', limpar(a.rootPlatform ?? a.platform) || 'direto', limpar(campanha)]
      .filter(Boolean)
      .join('-')
      .slice(0, 60)

    // `src` é o parâmetro que a Hotmart devolve na confirmação da compra.
    // Se o cliente colar um link que já tenha `src`, o dele é respeitado.
    const url = new URL(projeto.checkoutUrl)
    if (!url.searchParams.has('src')) url.searchParams.set('src', origem)

    return { url: url.toString(), origem }
  }

  async compartilhar(
    contentId: string,
    userId: string,
    canal: Platform,
    ctx: VisitContext,
  ): Promise<{ url: string; code: string }> {
    const content = await this.conteudoPublicado(contentId)

    const visita = await this.attribution.resolveVisit({ ...ctx, userId })

    // O visitante atual pode ser um dispositivo novo desta pessoa. Procuramos
    // o link de aquisição em qualquer visitante já ligado a este usuário, para
    // a cadeia não se perder quando alguém troca de aparelho.
    const origem =
      visita.visitor.acquiredViaLinkId ??
      (
        await this.prisma.visitor.findFirst({
          where: { userId, acquiredViaLinkId: { not: null } },
          orderBy: { firstSeenAt: 'asc' },
          select: { acquiredViaLinkId: true },
        })
      )?.acquiredViaLinkId ??
      null

    const link = await this.shortLinks.criarCompartilhamento({
      projectId: content.projectId,
      contentId,
      userId,
      channel: canal,
      linkDeOrigemId: origem,
      targetPath: `/${content.project.slug}/${content.slug}`,
    })

    await this.prisma.share.create({
      data: { userId, shortLinkId: link.id, channel: canal },
    })

    await this.events.registrar({
      type: EventType.SHARE_CREATED,
      attribution: { ...visita.attribution, userId },
      contentId,
      props: { canal, code: link.code, depth: link.depth },
    })

    return { url: this.shortLinks.urlPublica(link.code), code: link.code }
  }

  // ── Leitura agregada para a página ────────────────────────────────

  /**
   * Estado social de um conteúdo, do ponto de vista de quem está olhando.
   *
   * CONTA-SE AGORA, E NÃO SE LÊ UM CONTADOR GUARDADO.
   *
   * Isto lia a tabela `content_stats`, que é somada quando alguém comenta e
   * subtraída quando alguém apaga. Um contador desses só está certo enquanto
   * ninguém falhar um passo, e em 27/08 estava a mostrar MENOS TRÊS comentários
   * na introdução e MENOS DOIS na Letra A. Um número negativo ao lado de um
   * conteúdo não é um número errado, é um número que denuncia a forma como foi
   * obtido.
   *
   * Vinha de duas contas para a mesma coisa: eu corrigi a contagem em 26/08,
   * mas corrigi a que a lista usa, e o ecrã lia esta. É a mesma armadilha que
   * este projecto já me armou três vezes, e a saída é sempre a mesma: apagar a
   * segunda conta em vez de a acertar. A faixa (`estadoDaFaixa`) já contava em
   * directo; o conteúdo passa a fazer igual, com as mesmas regras.
   *
   * As visualizações passam a ser aberturas do conteúdo, que é o que ele espera
   * ver subir quando abre uma letra, e não um valor recalculado de vez em quando
   * que estava parado em zero desde 18/08.
   */
  async estado(contentId: string, userId: string | null) {
    const [numeros, curtido, lista] = await Promise.all([
      this.contagens.deConteudo(contentId, await this.bloqueadosPor(userId)),
      (async () =>
        userId
          ? this.prisma.reaction
              .findUnique({
                where: {
                  contentId_userId_type: { contentId, userId, type: ReactionType.LIKE },
                },
                select: { id: true },
              })
              .then(Boolean)
          : false)(),
      this.listarComentarios(contentId, 100, userId),
    ])

    return {
      visualizacoes: numeros.views,
      curtidas: numeros.likes,
      // O número sai da lista que segue junto, e não de uma contagem à parte.
      comentarios: this.contagens.desenhaveis(lista),
      compartilhamentos: numeros.shares,
      curtidoPorMim: curtido,
      lista,
    }
  }

  // ── O comentário como objecto social ─────────────────────────────────
  //
  // Pedido dele em 20/08: curtir, responder, editar e apagar. Responder já
  // existia no modelo desde o início (parentId); faltava o resto.

  /** Selecção comum a todas as listas de comentários, agora com o social. */
  private get selecaoDeComentario() {
    return {
      id: true,
      body: true,
      createdAt: true,
      editedAt: true,
      parentId: true,
      user: { select: { id: true, displayName: true, avatarUrl: true } },
      _count: { select: { reactions: true } },
    }
  }

  async alternarCurtidaDoComentario(commentId: string, userId: string) {
    const comentario = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, status: true },
    })
    if (!comentario || comentario.status !== 'PUBLISHED') {
      throw new NotFoundException('Comentário não encontrado')
    }

    const existente = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId: { commentId, userId } },
    })
    if (existente) await this.prisma.commentReaction.delete({ where: { id: existente.id } })
    else await this.prisma.commentReaction.create({ data: { commentId, userId } })

    return {
      curtido: !existente,
      total: await this.prisma.commentReaction.count({ where: { commentId } }),
    }
  }

  /**
   * Editar o próprio comentário.
   *
   * Só o autor, e nem o administrador: apagar o que está fora do lugar é
   * moderar, reescrever o que outra pessoa disse é pôr palavras na boca dela.
   * A marca de edição fica gravada porque pode já haver respostas penduradas a
   * um texto que deixou de existir.
   */
  async editarComentario(commentId: string, userId: string, corpo: string) {
    const comentario = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, status: true },
    })
    if (!comentario || comentario.status !== 'PUBLISHED') {
      throw new NotFoundException('Comentário não encontrado')
    }
    if (comentario.userId !== userId) {
      throw new ForbiddenException('Você só pode editar os seus comentários')
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body: corpo.trim(), editedAt: new Date() },
      select: this.selecaoDeComentario,
    })
  }

  /**
   * Junta a cada comentário se ESTA pessoa já o curtiu.
   *
   * Sem isto o coração vinha sempre vazio ao recarregar: o número estava certo,
   * mas quem tinha curtido não se reconhecia na tela e voltava a curtir. O
   * cliente apanhou-o em 20/08 e descreveu-o como a curtida a desaparecer —
   * era o que parecia.
   */
  private async comSinalDeCurtida<T extends { id: string }>(
    lista: T[],
    leitorId: string | null,
  ): Promise<(T & { curtidoPorMim: boolean })[]> {
    const meus = new Set(
      await this.curtidasDe(
        leitorId,
        lista.map((c) => c.id),
      ),
    )
    return lista.map((c) => ({ ...c, curtidoPorMim: meus.has(c.id) }))
  }

  /** Quais destes comentários esta pessoa já curtiu. */
  async curtidasDe(userId: string | null, ids: string[]): Promise<string[]> {
    if (!userId || ids.length === 0) return []
    const linhas = await this.prisma.commentReaction.findMany({
      where: { userId, commentId: { in: ids } },
      select: { commentId: true },
    })
    return linhas.map((l) => l.commentId)
  }

  // ── Engajamento do PERFIL anfitrião ──────────────────────────────────
  //
  // O projeto tem um rosto, e é sempre o mesmo para quem chega. Esse perfil
  // comporta-se como qualquer outro objecto social: vê-se, curte-se,
  // comenta-se e partilha-se.
  //
  // As visualizações saem das visitas à página do projeto, que já eram
  // gravadas: a página inicial É o perfil anfitrião, então contar duas vezes
  // a mesma chegada seria inventar público.

  /** O perfil público de qualquer pessoa, para se poder abrir a partir de um
   *  comentário. Só o que a própria escolheu mostrar. */
  async perfilPublico(userId: string) {
    const pessoa = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        guardianName: true,
        createdAt: true,
        status: true,
      },
    })
    if (!pessoa || pessoa.status !== 'ACTIVE') throw new NotFoundException('Perfil não encontrado')
    const { status: _ignorado, ...publico } = pessoa
    return publico
  }

  async estadoDoPerfil(profileUserId: string, leitorId: string | null) {
    const pessoa = await this.prisma.user.findUnique({
      where: { id: profileUserId },
      select: { id: true, status: true },
    })
    if (!pessoa || pessoa.status !== 'ACTIVE') throw new NotFoundException('Perfil não encontrado')

    const [visualizacoes, curtidas, compartilhamentos, curtido, lista] = await Promise.all([
      this.prisma.event.count({
        where: {
          type: EventType.PAGE_VIEW,
          AND: [{ props: { path: ['perfilId'], equals: profileUserId } }],
          /*
            E SEM AS MINHAS VISITAS, NEM AS DELE.

            Este contador não passava pelo filtro das visitas marcadas fora das
            métricas, e reparei nisso ao prová-lo a funcionar: abri um perfil
            três vezes para mostrar que o número mexia, e acabei de somar três
            visitas minhas ao perfil de uma pessoa real.

            É o defeito de 27/08 outra vez, o dos 66 "visitantes alemães" que
            eram a minha máquina, a partir dos quais ele ia escolher a língua da
            tradução. Um número que conta quem o está a construir não é um
            número dele.
          */
          visitor: { is: { ignoradoNasMetricas: false } },
        },
      }),
      this.prisma.profileReaction.count({
        where: { profileUserId, type: ReactionType.LIKE },
      }),
      this.prisma.event.count({
        where: {
          type: EventType.CUSTOM,
          AND: [
            { props: { path: ['perfilId'], equals: profileUserId } },
            { props: { path: ['acao'], equals: 'partilhar_perfil' } },
          ],
        },
      }),
      leitorId
        ? this.prisma.profileReaction
            .findUnique({
              where: {
                profileUserId_userId_type: {
                  profileUserId,
                  userId: leitorId,
                  type: ReactionType.LIKE,
                },
              },
              select: { id: true },
            })
            .then(Boolean)
        : Promise.resolve(false),
      this.listarComentariosDoPerfil(profileUserId, leitorId),
    ])

    return {
      visualizacoes,
      curtidas,
      comentarios: this.contagens.desenhaveis(lista),
      compartilhamentos,
      curtidoPorMim: curtido,
      lista,
    }
  }

  /**
   * Quem curtiu este perfil, com cara e nome.
   *
   * Ele quis, com razão, que os números tivessem pessoas por trás: cem
   * curtidas sem ninguém a quem associá-las parecem inventadas.
   *
   * A lista é só de quem CURTIU ou COMENTOU. Quem apenas viu não entra, e não
   * é limitação técnica: ver uma página não é um acto público, a pessoa não
   * escolheu aparecer em lista nenhuma, e a política de privacidade publicada
   * em nome dele promete exactamente o contrário — que a visita fica anónima.
   * Numa plataforma usada por crianças, uma lista de quem andou a ver o perfil
   * de um menino é a espécie de coisa que não se constrói.
   */
  async quemInteragiuComOPerfil(profileUserId: string) {
    const [curtiram, comentaram, visualizacoes] = await Promise.all([
      this.prisma.profileReaction.findMany({
        // Só contas activas: uma conta removida não aparece em lista pública.
        where: { profileUserId, user: { status: 'ACTIVE' } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      }),
      this.prisma.comment.findMany({
        where: { profileUserId, status: 'PUBLISHED', user: { status: 'ACTIVE' } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        distinct: ['userId'],
        select: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      }),
      this.prisma.event.count({
        where: {
          type: EventType.PAGE_VIEW,
          AND: [{ props: { path: ['perfilId'], equals: profileUserId } }],
          /*
            E SEM AS MINHAS VISITAS, NEM AS DELE.

            Este contador não passava pelo filtro das visitas marcadas fora das
            métricas, e reparei nisso ao prová-lo a funcionar: abri um perfil
            três vezes para mostrar que o número mexia, e acabei de somar três
            visitas minhas ao perfil de uma pessoa real.

            É o defeito de 27/08 outra vez, o dos 66 "visitantes alemães" que
            eram a minha máquina, a partir dos quais ele ia escolher a língua da
            tradução. Um número que conta quem o está a construir não é um
            número dele.
          */
          visitor: { is: { ignoradoNasMetricas: false } },
        },
      }),
    ])

    return {
      curtiram: curtiram.map((c) => c.user),
      comentaram: comentaram.map((c) => c.user),
      visualizacoes,
    }
  }

  async listarComentariosDoPerfil(profileUserId: string, leitorId: string | null = null) {
    const escondidos = await this.bloqueadosPor(leitorId)
    const lista = await this.prisma.comment.findMany({
      where: {
        profileUserId,
        status: 'PUBLISHED',
        ...(escondidos.length ? { userId: { notIn: escondidos } } : {}),
        // A LISTA DEVOLVE O MESMO QUE O CONTADOR CONTA.
        // Uma resposta cujo pai foi apagado não tem onde ser desenhada — as
        // respostas vivem dentro do pai — e vinha na lista para ser deitada
        // fora pelo ecrã. Sair daqui é mais honesto do que sair lá à frente.
        OR: [{ parentId: null }, { parent: { is: { status: 'PUBLISHED' } } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: this.selecaoDeComentario,
    })
    return this.comSinalDeCurtida(lista, leitorId)
  }

  /**
   * Quem curtiu uma publicação ou uma faixa.
   *
   * Ele pediu-o em 25/08: "quando eu tocar no número de likes, preciso
   * conseguir ver quais pessoas deram like, como nas redes sociais. Não quero
   * somente um número sem saber de onde ele veio".
   *
   * O mesmo limite do perfil vale aqui: QUEM CURTIU aparece, quem só viu não.
   * Curtir é um acto público — a pessoa carregou num coração — e ver não é. A
   * política de privacidade publicada em nome dele promete que a visita fica
   * anónima, e numa plataforma usada por crianças uma lista de quem andou a ver
   * é a espécie de coisa que não se constrói.
   */
  async quemCurtiu(alvo: { blockId?: string; contentId?: string }) {
    if (alvo.blockId) {
      const curtiram = await this.prisma.blockReaction.findMany({
        // SÓ CONTAS ACTIVAS. Uma conta removida deixa as curtidas dela para
        // trás — o registo é dela e não se apaga — mas o nome de quem já não
        // está na plataforma não tem de aparecer numa lista pública. Apanhei-o
        // porque as minhas próprias contas de teste apareciam na lista dele.
        where: { blockId: alvo.blockId, type: ReactionType.LIKE, user: { status: 'ACTIVE' } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      })
      return { curtiram: curtiram.map((c) => c.user) }
    }

    const curtiram = await this.prisma.reaction.findMany({
      where: { contentId: alvo.contentId, type: ReactionType.LIKE, user: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    })
    return { curtiram: curtiram.map((c) => c.user).filter(Boolean) }
  }

  async alternarCurtidaDoPerfil(profileUserId: string, userId: string) {
    // O dono pode curtir o próprio perfil. Eu tinha-o proibido — um número que
    // o dono sobe sozinho vale menos — e ele pediu duas vezes o contrário. É
    // decisão de produto e é dele; fica registado que o aviso foi dado.
    const existente = await this.prisma.profileReaction.findUnique({
      where: {
        profileUserId_userId_type: { profileUserId, userId, type: ReactionType.LIKE },
      },
    })

    if (existente) await this.prisma.profileReaction.delete({ where: { id: existente.id } })
    else await this.prisma.profileReaction.create({ data: { profileUserId, userId } })

    return {
      curtido: !existente,
      total: await this.prisma.profileReaction.count({
        where: { profileUserId, type: ReactionType.LIKE },
      }),
    }
  }

  async comentarNoPerfil(
    profileUserId: string,
    userId: string,
    projectId: string,
    corpo: string,
    parentId?: string,
  ) {
    return this.prisma.comment.create({
      data: { projectId, profileUserId, userId, body: corpo.trim(), parentId },
      select: this.selecaoDeComentario,
    })
  }

  // ── Denúncia e bloqueio ──────────────────────────────────────────────
  //
  // Os seis motivos são os que ele listou. O alvo vai como tipo + id porque
  // denunciar é raro e cinco colunas opcionais custariam mais a ler do que o
  // par. E o autor é opcional: exigir conta para avisar que há algo errado
  // numa plataforma de crianças é pedir que a mãe se registe primeiro,
  // enquanto o conteúdo continua no ar.

  async denunciar(
    dados: {
      projectId: string
      targetType: ReportTarget
      targetId: string
      reason: ReportReason
      note?: string
      bloquear?: boolean
    },
    userId: string | null,
  ) {
    const denuncia = await this.prisma.report.create({
      data: {
        projectId: dados.projectId,
        reporterId: userId,
        targetType: dados.targetType,
        targetId: dados.targetId,
        reason: dados.reason,
        note: dados.note?.trim() || null,
      },
      select: { id: true, createdAt: true },
    })

    // O bloqueio é do denunciante, e é imediato: quem denuncia não deve ter de
    // esperar pela decisão do administrador para deixar de ver quem o
    // incomodou. A denúncia segue o seu caminho em paralelo.
    let bloqueado = false
    if (dados.bloquear && userId && dados.targetType === 'PROFILE' && dados.targetId !== userId) {
      await this.prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: dados.targetId } },
        create: { blockerId: userId, blockedId: dados.targetId },
        update: {},
      })
      bloqueado = true
    }

    return { id: denuncia.id, bloqueado }
  }

  /** Ids que esta pessoa bloqueou — usado para esconder o que eles escrevem. */
  private async bloqueadosPor(userId: string | null): Promise<string[]> {
    if (!userId) return []
    const linhas = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    })
    return linhas.map((l) => l.blockedId)
  }

  // ── Engajamento por faixa ────────────────────────────────────────────
  //
  // Pedido dele em 19/08: cada áudio da letra — música, explicação,
  // memorização, oração — precisa dos seus próprios números, e não de uma
  // barra só no fim da página. Tem razão: são quatro peças com propósitos
  // diferentes, e saber que a oração é ouvida mais vezes do que a explicação
  // é justamente o tipo de coisa que este produto existe para revelar.
  //
  // Visualizações e partilhas saem do log de eventos, que já as regista;
  // curtidas e comentários têm tabela. Contar na hora, em vez de manter um
  // contador por bloco, evita ter dois números sobre a mesma coisa a
  // divergirem — são quatro faixas por letra, a consulta é barata.

  private async faixaExiste(blockId: string) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blockId },
      select: { id: true, contentId: true, content: { select: { projectId: true, status: true } } },
    })
    if (!bloco || bloco.content.status !== 'PUBLISHED') {
      throw new NotFoundException('Faixa não encontrada')
    }
    return bloco
  }

  private contarEventoDaFaixa(blockId: string, tipo: EventType, acao?: string) {
    return this.prisma.event.count({
      where: {
        type: tipo,
        AND: [
          { props: { path: ['blockId'], equals: blockId } },
          ...(acao ? [{ props: { path: ['acao'], equals: acao } }] : []),
        ],
        // Fora das métricas quer dizer fora de todos os números, e não só dos
        // do painel. Ver a nota no contador de visualizações do perfil.
        visitor: { is: { ignoradoNasMetricas: false } },
      },
    })
  }

  async estadoDaFaixa(blockId: string, userId: string | null) {
    await this.faixaExiste(blockId)

    const [visualizacoes, curtidas, compartilhamentos, reproducoes, curtido, lista] =
      await Promise.all([
        /**
         * O OLHO CONTA ABERTURAS, e não reproduções.
         *
         * Contava MEDIA_PLAY — quantas vezes o áudio foi tocado. Isso não é uma
         * visualização, é uma escuta, e o cliente esperava outra coisa: "se
         * Explicação está com 24 visualizações e eu realmente abro aquele
         * conteúdo, deve passar para 25".
         *
         * Tinha razão, e o número antigo era pior do que parecia: um cartão que
         * ninguém tocasse ficava eternamente a zero mesmo tendo sido visto por
         * cem pessoas.
         */
        this.contarEventoDaFaixa(blockId, EventType.CONTENT_VIEW),
        this.prisma.blockReaction.count({ where: { blockId, type: ReactionType.LIKE } }),
        this.contarEventoDaFaixa(blockId, EventType.CUSTOM, 'partilhar_faixa'),
        /**
         * QUANTAS VEZES ESTA MÚSICA FOI TOCADA.
         *
         * Ele pediu-o em 29/08, "pequeno e discreto perto dos três pontinhos".
         * O dado já existia: o tocador emite MEDIA_PLAY desde sempre e ninguém
         * lhe perguntava. Não é o mesmo que o olho, que conta aberturas da
         * página: dá para abrir a letra e nunca carregar em tocar.
         */
        this.contarEventoDaFaixa(blockId, EventType.MEDIA_PLAY),
        userId
          ? this.prisma.blockReaction
              .findUnique({
                where: { blockId_userId_type: { blockId, userId, type: ReactionType.LIKE } },
                select: { id: true },
              })
              .then(Boolean)
          : Promise.resolve(false),
        this.listarComentariosDaFaixa(blockId, userId),
      ])

    return {
      visualizacoes,
      curtidas,
      comentarios: this.contagens.desenhaveis(lista),
      compartilhamentos,
      reproducoes,
      curtidoPorMim: curtido,
      lista,
    }
  }

  async alternarCurtidaDaFaixa(blockId: string, userId: string, ctx: VisitContext) {
    const bloco = await this.faixaExiste(blockId)
    const existente = await this.prisma.blockReaction.findUnique({
      where: { blockId_userId_type: { blockId, userId, type: ReactionType.LIKE } },
    })

    const visita = await this.attribution.resolveVisit({ ...ctx, userId })
    const atribuicao = { ...visita.attribution, userId }

    if (existente) {
      await this.prisma.blockReaction.delete({ where: { id: existente.id } })
      await this.events.registrar({
        type: EventType.UNLIKE,
        attribution: atribuicao,
        contentId: bloco.contentId,
        props: { blockId },
      })
    } else {
      await this.prisma.blockReaction.create({
        data: { blockId, userId, type: ReactionType.LIKE },
      })
      await this.events.registrar({
        type: EventType.LIKE,
        attribution: atribuicao,
        contentId: bloco.contentId,
        props: { blockId },
      })
    }

    return {
      curtido: !existente,
      total: await this.prisma.blockReaction.count({ where: { blockId, type: ReactionType.LIKE } }),
    }
  }

  async listarComentariosDaFaixa(blockId: string, leitorId: string | null = null) {
    const escondidos = await this.bloqueadosPor(leitorId)
    const lista = await this.prisma.comment.findMany({
      where: {
        blockId,
        status: 'PUBLISHED',
        ...(escondidos.length ? { userId: { notIn: escondidos } } : {}),
        // Mesma regra do perfil: uma resposta órfã não tem onde ser desenhada.
        OR: [{ parentId: null }, { parent: { is: { status: 'PUBLISHED' } } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: this.selecaoDeComentario,
    })
    return this.comSinalDeCurtida(lista, leitorId)
  }

  async comentarNaFaixa(
    blockId: string,
    userId: string,
    corpo: string,
    ctx: VisitContext,
    parentId?: string,
  ) {
    const bloco = await this.faixaExiste(blockId)
    const visita = await this.attribution.resolveVisit({ ...ctx, userId })

    const comentario = await this.prisma.comment.create({
      data: {
        projectId: bloco.content.projectId,
        contentId: bloco.contentId,
        blockId,
        userId,
        body: corpo.trim(),
        parentId,
      },
      select: this.selecaoDeComentario,
    })

    await this.events.registrar({
      type: EventType.COMMENT,
      attribution: { ...visita.attribution, userId },
      contentId: bloco.contentId,
      props: { blockId },
    })

    return comentario
  }

  private async conteudoPublicado(contentId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        slug: true,
        status: true,
        projectId: true,
        project: { select: { slug: true } },
      },
    })
    if (!content || content.status !== 'PUBLISHED') {
      throw new NotFoundException('Conteúdo não encontrado')
    }
    return content
  }
}
