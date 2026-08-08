import { Injectable, NotFoundException } from '@nestjs/common'
import { ContentStatus } from '@pv/db'
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
      select: { id: true, slug: true, name: true, description: true, branding: true, status: true },
    })
    if (!project || project.status === 'ARCHIVED') {
      throw new NotFoundException('Projeto não encontrado')
    }
    return project
  }

  /** Índice do projeto: só o publicado, na ordem definida no painel. */
  async listar(projectSlug: string) {
    const project = await this.projeto(projectSlug)

    const contents = await this.prisma.content.findMany({
      where: { projectId: project.id, status: ContentStatus.PUBLISHED },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        coverUrl: true,
        position: true,
        stats: { select: { views: true, likes: true, comments: true, shares: true } },
      },
    })

    return { project, contents }
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
        title: content.title,
        subtitle: content.subtitle,
        summary: content.summary,
        coverUrl: content.coverUrl,
        position: content.position,
        blocks: content.blocks.map((b) => ({
          id: b.id,
          type: b.type,
          label: b.label,
          text: b.text,
          url: b.url,
          asset: b.asset,
          meta: b.meta,
        })),
        stats: content.stats ?? { views: 0, likes: 0, comments: 0, shares: 0 },
        qrCode: code,
        qrUrl: code ? this.shortLinks.urlPublica(code) : null,
      },
      navegacao: { anterior, proximo },
    }
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
