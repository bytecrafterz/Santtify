import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventType, MediaKind, PostStatus, Prisma } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { AttributionService } from '../tracking/attribution.service'
import { EventsService } from '../tracking/events.service'
import { StorageService } from '../admin/storage.service'
import { VisitContext } from '../tracking/attribution.types'

/**
 * "My Post" — a pessoa publica no próprio perfil.
 *
 * Uma publicação pode ter três coisas, e qualquer combinação delas: o conteúdo
 * da plataforma que ela estava ouvindo, uma legenda escrita por ela, e uma foto
 * enviada do aparelho.
 *
 * A foto entrou no contrato original em 12/08, depois de um alinhamento em que
 * o cliente apontou, com razão, que o preço foi dado sem que se perguntasse o
 * que existiria dentro do My Post. A infraestrutura de envio já existia do
 * painel administrativo, então o que faltava era ligar a foto à publicação e
 * criar a moderação.
 *
 * REGRA DE MODERAÇÃO, e o porquê dela ser assimétrica:
 *
 *   - com foto  → nasce PENDING, invisível até a aprovação
 *   - sem foto  → nasce PUBLISHED, como já era antes
 *
 * Imagem de criança enviada do aparelho, que fica pública e pode ser
 * compartilhada para fora da plataforma, é de outra ordem de risco que uma
 * legenda sobre uma música do próprio projeto. Moderar as duas coisas do mesmo
 * jeito atrasaria o uso legítimo sem reduzir o risco que importa.
 *
 * A aprovação prévia virou uma CHAVE do projeto em 12/08. O cliente decidiu não
 * seguir com revisão manual — não tem tempo nem condição de contratar quem
 * revise — e quer prevenção na entrada mais ação por exceção. A recomendação
 * contrária ficou registrada; a decisão é dele, e é dele o conteúdo hospedado.
 *
 * Continua sendo uma chave, e não uma remoção do código, por dois motivos:
 * ele pode religar num dia de problema sem depender de mim, e a mesma fila é a
 * caixa de entrada das denúncias quando esse bloco existir.
 */
/** Quantas fotos a mesma pessoa pode ter esperando aprovação ao mesmo tempo. */
const MAXIMO_NA_FILA = 5

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attribution: AttributionService,
    private readonly events: EventsService,
    private readonly storage: StorageService,
  ) {}

  async publicar(
    contentId: string,
    userId: string,
    legenda: string | undefined,
    ctx: VisitContext,
    foto?: Express.Multer.File,
  ) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        status: true,
        projectId: true,
        project: { select: { photoApprovalRequired: true } },
      },
    })
    if (!content || content.status !== 'PUBLISHED') {
      throw new NotFoundException('Conteúdo não encontrado')
    }
    const exigeAprovacao = content.project.photoApprovalRequired

    const corpo = legenda?.trim() || null
    if (corpo && corpo.length > 1000) {
      throw new BadRequestException('A legenda ficou longa demais')
    }

    // Só imagem: aceitar vídeo aqui abriria por acidente o bloco que ficou
    // explicitamente de fora do contrato.
    if (foto && this.storage.tipoDe(foto.mimetype) !== MediaKind.IMAGE) {
      throw new BadRequestException('Envie uma imagem. Vídeo ainda não está disponível.')
    }

    // A mesma pessoa publicando a mesma música repetidamente enche o próprio
    // perfil sem querer — normalmente é toque duplo, não intenção. Com foto a
    // publicação é deliberada, então a trava não se aplica; e ela só olha para
    // publicações sem foto, senão publicar a música logo depois de mandar uma
    // foto dela seria recusado como se fosse repetição.
    if (!foto) {
      const recente = await this.prisma.post.findFirst({
        where: {
          userId,
          contentId,
          imageAssetId: null,
          status: { in: [PostStatus.PUBLISHED, PostStatus.PENDING] },
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
        select: { id: true },
      })
      if (recente) throw new BadRequestException('Você acabou de publicar este conteúdo.')
    }

    // Teto de fotos esperando aprovação, por pessoa.
    //
    // Sem ele, uma conta sozinha enche a fila e o responsável perde a única
    // ferramenta que tem para proteger as crianças: conseguir olhar item a
    // item. O teto é por fila, não por dia — quem tem foto aprovada volta a
    // ter espaço na hora, e quem está esperando aguarda a revisão.
    if (foto && exigeAprovacao) {
      const naFila = await this.prisma.post.count({
        where: { userId, status: PostStatus.PENDING },
      })
      if (naFila >= MAXIMO_NA_FILA) {
        throw new BadRequestException(
          'Você já tem fotos esperando aprovação. Assim que forem revistas, dá para enviar mais.',
        )
      }
    }

    let imageAssetId: string | null = null
    if (foto) {
      const salvo = await this.storage.salvar(foto)
      const asset = await this.prisma.mediaAsset.create({
        data: {
          kind: salvo.kind,
          url: salvo.url,
          mimeType: salvo.mimeType,
          sizeBytes: salvo.sizeBytes,
          title: salvo.nomeOriginal,
          uploadedById: userId,
        },
      })
      imageAssetId = asset.id
    }

    const post = await this.prisma.post.create({
      data: {
        projectId: content.projectId,
        userId,
        contentId,
        body: corpo,
        imageAssetId,
        status: foto && exigeAprovacao ? PostStatus.PENDING : PostStatus.PUBLISHED,
      },
      select: this.selecao(),
    })

    const visita = await this.attribution.resolveVisit({ ...ctx, userId })
    await this.events.registrar({
      type: EventType.POST_CREATED,
      attribution: { ...visita.attribution, userId },
      contentId,
      props: { postId: post.id, comLegenda: Boolean(corpo), comFoto: Boolean(foto) },
    })

    return {
      ...post,
      aguardandoAprovacao: post.status === PostStatus.PENDING,
    }
  }

  /**
   * As publicações da própria pessoa.
   *
   * Ela vê as próprias pendentes e recusadas — esconder deixaria a impressão de
   * que a publicação sumiu. O público só vê as aprovadas.
   */
  async minhas(userId: string, limite = 50) {
    return this.prisma.post.findMany({
      where: {
        userId,
        status: { in: [PostStatus.PENDING, PostStatus.PUBLISHED, PostStatus.REJECTED] },
      },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: this.selecao(),
    })
  }

  /**
   * As publicações de uma pessoa, para quem visita o perfil dela.
   *
   * SÓ AS PUBLICADAS, ao contrário de `minhas`. O dono do perfil vê as suas
   * pendentes e as recusadas, porque são dele e ele precisa de saber em que
   * estado estão; quem visita vê só o que passou pela moderação. Mostrar uma
   * publicação pendente a estranhos seria publicar aquilo que ainda não foi
   * aprovado, que é o contrário do que a moderação existe para fazer.
   */
  async doPerfil(userId: string, limite = 50) {
    return this.prisma.post.findMany({
      where: { userId, status: PostStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: this.selecao(),
    })
  }

  async remover(postId: string, userId: string, ehAdmin: boolean) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, contentId: true, projectId: true, status: true },
    })
    if (!post || post.status === PostStatus.DELETED) {
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
        attribution: this.atribuicaoMinima(post.projectId, visitor.id, userId),
        contentId: post.contentId,
        props: { postId },
      })
    }
  }

  // ── Moderação ─────────────────────────────────────────────────────

  /** Fila do painel: o que está esperando aprovação, mais antigo primeiro. */
  async pendentes(projectSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true, name: true, photoApprovalRequired: true },
    })
    if (!project) throw new NotFoundException('Projeto não encontrado')

    const posts = await this.prisma.post.findMany({
      where: { projectId: project.id, status: PostStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      select: {
        ...this.selecao(),
        user: { select: { id: true, displayName: true, email: true } },
      },
    })
    return { project, posts }
  }

  async moderar(
    postId: string,
    aprovar: boolean,
    adminId: string,
    nota: string | undefined,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true, projectId: true },
    })
    if (!post) throw new NotFoundException('Publicação não encontrada')
    if (post.status !== PostStatus.PENDING) {
      throw new BadRequestException('Esta publicação já foi moderada')
    }

    const atualizada = await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: aprovar ? PostStatus.PUBLISHED : PostStatus.REJECTED,
        moderatedAt: new Date(),
        moderatedById: adminId,
        moderationNote: nota?.trim() || null,
      },
      select: this.selecao(),
    })

    await this.prisma.adminAuditLog.create({
      data: {
        userId: adminId,
        projectId: post.projectId,
        action: aprovar ? 'post.approve' : 'post.reject',
        entityType: 'Post',
        entityId: postId,
        changes: { nota: nota ?? null } as Prisma.InputJsonValue,
      },
    })

    return atualizada
  }

  private selecao() {
    return {
      id: true,
      body: true,
      status: true,
      createdAt: true,
      moderationNote: true,
      imageAsset: { select: { url: true, title: true } },
      content: {
        select: { slug: true, title: true, subtitle: true, project: { select: { slug: true } } },
      },
    } satisfies Prisma.PostSelect
  }

  /** Atribuição sem contexto de requisição, para ações fora de uma visita. */
  private atribuicaoMinima(projectId: string, visitorId: string, userId: string) {
    return {
      projectId,
      visitorId,
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
    }
  }
}
