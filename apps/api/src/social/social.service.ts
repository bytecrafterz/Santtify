import { BadRequestException, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { EventType, Platform, ReactionType } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { ShortLinksService } from '../short-links/short-links.service'
import { EventsService } from '../tracking/events.service'
import { AttributionService } from '../tracking/attribution.service'
import { VisitContext } from '../tracking/attribution.types'

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
  ) {}

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
      await this.prisma.contentStats.update({
        where: { contentId },
        data: { likes: { decrement: 1 } },
      })
      await this.events.registrar({ type: EventType.UNLIKE, attribution: atribuicao, contentId })
      return { curtido: false, total: await this.contarCurtidas(contentId) }
    }

    await this.prisma.reaction.create({
      data: { projectId: content.projectId, contentId, userId, type: ReactionType.LIKE },
    })
    await this.prisma.contentStats.update({
      where: { contentId },
      data: { likes: { increment: 1 } },
    })
    await this.events.registrar({ type: EventType.LIKE, attribution: atribuicao, contentId })
    return { curtido: true, total: await this.contarCurtidas(contentId) }
  }

  private contarCurtidas(contentId: string) {
    return this.prisma.reaction.count({ where: { contentId, type: ReactionType.LIKE } })
  }

  // ── Comentar ──────────────────────────────────────────────────────

  async listarComentarios(contentId: string, limite = 100) {
    return this.prisma.comment.findMany({
      where: { contentId, status: 'PUBLISHED' },
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

    await this.prisma.contentStats.update({
      where: { contentId },
      data: { comments: { increment: 1 } },
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
    await this.prisma.contentStats.update({
      where: { contentId: comment.contentId },
      data: { comments: { decrement: 1 } },
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
      (v ?? '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

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
    await this.prisma.contentStats.update({
      where: { contentId },
      data: { shares: { increment: 1 } },
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

  /** Estado social de um conteúdo, do ponto de vista de quem está olhando. */
  async estado(contentId: string, userId: string | null) {
    const [stats, curtido, comentarios] = await Promise.all([
      this.prisma.contentStats.findUnique({
        where: { contentId },
        select: { likes: true, comments: true, shares: true, views: true },
      }),
      userId
        ? this.prisma.reaction
            .findUnique({
              where: {
                contentId_userId_type: { contentId, userId, type: ReactionType.LIKE },
              },
              select: { id: true },
            })
            .then(Boolean)
        : Promise.resolve(false),
      this.listarComentarios(contentId),
    ])

    return {
      curtidas: stats?.likes ?? 0,
      comentarios: stats?.comments ?? 0,
      compartilhamentos: stats?.shares ?? 0,
      curtidoPorMim: curtido,
      lista: comentarios,
    }
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
