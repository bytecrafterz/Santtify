import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventType, PostStatus } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { AttributionService } from '../tracking/attribution.service'
import { EventsService } from '../tracking/events.service'
import { VisitContext } from '../tracking/attribution.types'

/**
 * "My Post" — a pessoa publica no próprio perfil um conteúdo da plataforma.
 *
 * O escopo veio de um alinhamento com o cliente: ele leu "Minhas Publicações"
 * como área de publicação do usuário, e o exemplo que deu foi alguém ouvindo
 * uma música do projeto e querendo publicá-la no perfil. Isso está mais perto
 * de "compartilhar informações" — que estava contratado — do que de publicar
 * conteúdo novo, então entrou sem custo adicional.
 *
 * O que NÃO entra aqui, de propósito: envio de foto ou vídeo do aparelho da
 * pessoa. Aquilo é outra engrenagem — armazenamento, validação e moderação —
 * e foi separado num bloco próprio, com a proteção que conteúdo de criança
 * exige.
 */
@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attribution: AttributionService,
    private readonly events: EventsService,
  ) {}

  async publicar(
    contentId: string,
    userId: string,
    legenda: string | undefined,
    ctx: VisitContext,
  ) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, status: true, projectId: true },
    })
    if (!content || content.status !== 'PUBLISHED') {
      throw new NotFoundException('Conteúdo não encontrado')
    }

    const corpo = legenda?.trim() || null
    if (corpo && corpo.length > 1000) {
      throw new BadRequestException('A legenda ficou longa demais')
    }

    // A mesma pessoa publicando a mesma música repetidamente enche o próprio
    // perfil sem querer — normalmente é toque duplo, não intenção.
    const recente = await this.prisma.post.findFirst({
      where: {
        userId,
        contentId,
        status: PostStatus.PUBLISHED,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    })
    if (recente) {
      throw new BadRequestException('Você acabou de publicar este conteúdo.')
    }

    const post = await this.prisma.post.create({
      data: { projectId: content.projectId, userId, contentId, body: corpo },
      select: {
        id: true,
        body: true,
        createdAt: true,
        content: {
          select: { slug: true, title: true, subtitle: true, project: { select: { slug: true } } },
        },
      },
    })

    const visita = await this.attribution.resolveVisit({ ...ctx, userId })
    await this.events.registrar({
      type: EventType.POST_CREATED,
      attribution: { ...visita.attribution, userId },
      contentId,
      props: { postId: post.id, comLegenda: Boolean(corpo) },
    })

    return post
  }

  /** As publicações da própria pessoa, para a aba "Minhas Publicações". */
  async minhas(userId: string, limite = 50) {
    return this.prisma.post.findMany({
      where: { userId, status: PostStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        body: true,
        createdAt: true,
        content: {
          select: { slug: true, title: true, subtitle: true, project: { select: { slug: true } } },
        },
      },
    })
  }

  async remover(postId: string, userId: string, ehAdmin: boolean) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, contentId: true, projectId: true, status: true },
    })
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Publicação não encontrada')
    }
    if (post.userId !== userId && !ehAdmin) {
      throw new ForbiddenException('Você só pode apagar as suas publicações')
    }

    // Marca como apagada em vez de remover: o evento de criação continua no
    // log, e apagar a linha deixaria o histórico contando uma publicação que
    // não existe em lugar nenhum.
    await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.DELETED, deletedAt: new Date() },
    })

    const visitor = await this.prisma.visitor.findFirst({
      where: { userId, projectId: post.projectId },
      select: { id: true },
    })
    if (visitor) {
      await this.events.registrar({
        type: EventType.POST_DELETED,
        attribution: {
          projectId: post.projectId,
          visitorId: visitor.id,
          userId,
          sessionId: null,
          platform: null,
          source: null,
          medium: null,
          campaignId: null,
          campaignRef: null,
          shortLinkId: null,
          parentShortLinkId: null,
          rootShortLinkId: null,
          rootPlatform: null,
          chainDepth: 0,
          ipHash: null,
          userAgentHash: null,
          deviceType: null,
          countryCode: null,
          path: null,
          referrerHost: null,
        },
        contentId: post.contentId,
        props: { postId },
      })
    }
  }
}
