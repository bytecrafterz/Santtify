import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { BlockType, ContentStatus, MediaKind, Prisma } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { ShortLinksService } from '../short-links/short-links.service'

/**
 * Operações do painel administrativo.
 *
 * Tudo genérico sobre Project/Content: o painel que o cliente usa para as 26
 * letras é o mesmo que servirá o próximo projeto. Nenhuma rota menciona letra.
 *
 * Toda alteração é registrada em AdminAuditLog — se um conteúdo sumir ou mudar
 * sozinho, dá para saber quem fez e quando.
 */
@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shortLinks: ShortLinksService,
  ) {}

  /** Lista TUDO, inclusive rascunho — diferente da leitura pública. */
  async listar(projectSlug: string) {
    const project = await this.projeto(projectSlug)

    const contents = await this.prisma.content.findMany({
      where: { projectId: project.id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        status: true,
        position: true,
        publishedAt: true,
        updatedAt: true,
        stats: { select: { views: true, likes: true, comments: true, shares: true } },
        shortLink: {
          where: { kind: 'CONTENT_QR', active: true },
          select: { code: true },
          take: 1,
        },
        blocks: { select: { id: true, type: true, text: true, assetId: true } },
      },
    })

    return {
      project,
      contents: contents.map((c) => {
        const preenchidos = c.blocks.filter((b) => b.text || b.assetId).length
        return {
          id: c.id,
          slug: c.slug,
          title: c.title,
          subtitle: c.subtitle,
          status: c.status,
          position: c.position,
          publishedAt: c.publishedAt,
          updatedAt: c.updatedAt,
          stats: c.stats,
          qrCode: c.shortLink[0]?.code ?? null,
          // O cliente precisa ver de relance o que falta preencher.
          blocosPreenchidos: preenchidos,
          blocosTotal: c.blocks.length,
        }
      }),
    }
  }

  async detalhe(projectSlug: string, contentSlug: string) {
    const project = await this.projeto(projectSlug)
    const content = await this.prisma.content.findUnique({
      where: { projectId_slug: { projectId: project.id, slug: contentSlug } },
      include: {
        blocks: { orderBy: { position: 'asc' }, include: { asset: true } },
        metadata: true,
        shortLink: { where: { kind: 'CONTENT_QR', active: true }, take: 1 },
      },
    })
    if (!content) throw new NotFoundException('Conteúdo não encontrado')

    const code = content.shortLink[0]?.code ?? null
    return {
      project,
      content: {
        ...content,
        shortLink: undefined,
        qrCode: code,
        qrUrl: code ? this.shortLinks.urlPublica(code) : null,
      },
    }
  }

  async criarConteudo(
    projectSlug: string,
    dados: { slug: string; title: string; subtitle?: string },
    adminId: string,
  ) {
    const project = await this.projeto(projectSlug)
    const slug = this.normalizarSlug(dados.slug)

    const existe = await this.prisma.content.findUnique({
      where: { projectId_slug: { projectId: project.id, slug } },
      select: { id: true },
    })
    if (existe) throw new BadRequestException(`Já existe um conteúdo com o endereço "${slug}"`)

    const ultimo = await this.prisma.content.findFirst({
      where: { projectId: project.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const content = await this.prisma.content.create({
      data: {
        projectId: project.id,
        slug,
        title: dados.title.trim(),
        subtitle: dados.subtitle?.trim() || null,
        position: (ultimo?.position ?? 0) + 1,
        status: ContentStatus.DRAFT,
        stats: { create: {} },
        metadata: { create: {} },
      },
    })

    // QR gerado na criação, não na publicação: o cliente pode imprimir o
    // material antes de terminar de cadastrar o conteúdo.
    await this.shortLinks.criarQrDeConteudo({
      projectId: project.id,
      contentId: content.id,
      projectSlug: project.slug,
      contentSlug: slug,
    })

    await this.auditar(adminId, project.id, 'content.create', 'Content', content.id, { slug })
    return content
  }

  async atualizarConteudo(
    contentId: string,
    dados: { title?: string; subtitle?: string; summary?: string; coverUrl?: string; position?: number },
    adminId: string,
  ) {
    const content = await this.prisma.content.update({
      where: { id: contentId },
      data: {
        ...(dados.title !== undefined ? { title: dados.title.trim() } : {}),
        ...(dados.subtitle !== undefined ? { subtitle: dados.subtitle.trim() || null } : {}),
        ...(dados.summary !== undefined ? { summary: dados.summary.trim() || null } : {}),
        ...(dados.coverUrl !== undefined ? { coverUrl: dados.coverUrl || null } : {}),
        ...(dados.position !== undefined ? { position: dados.position } : {}),
      },
    })
    await this.auditar(adminId, content.projectId, 'content.update', 'Content', contentId, dados)
    return content
  }

  /**
   * Publicar exige conteúdo de verdade.
   *
   * Sem esta checagem o cliente publicaria uma página vazia sem perceber, e
   * quem escaneasse o QR encontraria só o título. O erro diz o que falta.
   */
  async publicar(contentId: string, publicar: boolean, adminId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: { blocks: { select: { text: true, assetId: true, url: true } } },
    })
    if (!content) throw new NotFoundException('Conteúdo não encontrado')

    if (publicar) {
      const temAlgo = content.blocks.some((b) => b.text?.trim() || b.assetId || b.url)
      if (!temAlgo) {
        throw new BadRequestException(
          'Este conteúdo ainda está vazio. Preencha pelo menos um bloco antes de publicar.',
        )
      }
    }

    const atualizado = await this.prisma.content.update({
      where: { id: contentId },
      data: {
        status: publicar ? ContentStatus.PUBLISHED : ContentStatus.DRAFT,
        publishedAt: publicar ? (content.publishedAt ?? new Date()) : null,
      },
    })

    await this.auditar(
      adminId,
      content.projectId,
      publicar ? 'content.publish' : 'content.unpublish',
      'Content',
      contentId,
      {},
    )
    return atualizado
  }

  async salvarBloco(
    blocoId: string,
    dados: { label?: string; text?: string; url?: string; assetId?: string | null },
    adminId: string,
  ) {
    const bloco = await this.prisma.contentBlock.update({
      where: { id: blocoId },
      data: {
        ...(dados.label !== undefined ? { label: dados.label.trim() || null } : {}),
        ...(dados.text !== undefined ? { text: dados.text || null } : {}),
        ...(dados.url !== undefined ? { url: dados.url.trim() || null } : {}),
        ...(dados.assetId !== undefined ? { assetId: dados.assetId } : {}),
      },
      include: { asset: true, content: { select: { projectId: true } } },
    })
    await this.auditar(adminId, bloco.content.projectId, 'block.update', 'ContentBlock', blocoId, {})
    return bloco
  }

  async criarBloco(
    contentId: string,
    dados: { type: BlockType; label?: string },
    adminId: string,
  ) {
    const ultimo = await this.prisma.contentBlock.findFirst({
      where: { contentId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const bloco = await this.prisma.contentBlock.create({
      data: {
        contentId,
        type: dados.type,
        label: dados.label?.trim() || null,
        position: (ultimo?.position ?? 0) + 1,
      },
    })
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { projectId: true },
    })
    await this.auditar(adminId, content!.projectId, 'block.create', 'ContentBlock', bloco.id, dados)
    return bloco
  }

  async removerBloco(blocoId: string, adminId: string) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      include: { content: { select: { projectId: true } } },
    })
    if (!bloco) throw new NotFoundException('Bloco não encontrado')
    await this.prisma.contentBlock.delete({ where: { id: blocoId } })
    await this.auditar(adminId, bloco.content.projectId, 'block.delete', 'ContentBlock', blocoId, {})
  }

  async registrarMidia(
    dados: { url: string; kind: MediaKind; mimeType: string; sizeBytes: number; title: string },
    adminId: string,
  ) {
    return this.prisma.mediaAsset.create({
      data: {
        kind: dados.kind,
        url: dados.url,
        mimeType: dados.mimeType,
        sizeBytes: dados.sizeBytes,
        title: dados.title,
        uploadedById: adminId,
      },
    })
  }

  /** Metadados analíticos do conteúdo — o pedido final do cliente. */
  async salvarMetadados(
    contentId: string,
    dados: Record<string, unknown>,
    adminId: string,
  ) {
    const campos = ['platform', 'format', 'theme', 'productRef', 'cta', 'testVariant'] as const
    const data: Record<string, unknown> = {}
    for (const campo of campos) {
      if (dados[campo] !== undefined) data[campo] = dados[campo] || null
    }

    const metadata = await this.prisma.contentMetadata.upsert({
      where: { contentId },
      update: data,
      create: { contentId, ...data },
    })
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { projectId: true },
    })
    await this.auditar(adminId, content!.projectId, 'metadata.update', 'Content', contentId, data)
    return metadata
  }

  private async projeto(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        photoApprovalRequired: true,
      },
    })
    if (!project) throw new NotFoundException('Projeto não encontrado')
    return project
  }

  /**
   * Liga e desliga a aprovação prévia de foto.
   *
   * Passa pela auditoria como qualquer outra decisão do painel: é a mudança de
   * configuração de maior consequência que existe aqui, porque decide se uma
   * foto de criança fica pública no instante do envio. Quem ligou ou desligou,
   * e quando, precisa ser reconstituível.
   */
  async definirAprovacaoDeFoto(projectSlug: string, exigir: boolean, userId: string) {
    const project = await this.projeto(projectSlug)
    const atual = await this.prisma.project.update({
      where: { id: project.id },
      data: { photoApprovalRequired: exigir },
      select: { slug: true, name: true, photoApprovalRequired: true },
    })
    await this.auditar(
      userId,
      project.id,
      exigir ? 'project.photo_approval.on' : 'project.photo_approval.off',
      'Project',
      project.id,
      { photoApprovalRequired: exigir },
    )
    return atual
  }

  // ── Moderação da comunidade ───────────────────────────────────────

  /**
   * Comentários recentes do projeto, para o dono ver e agir.
   *
   * Mostra os apagados junto, marcados: quem modera precisa conseguir conferir
   * o que já resolveu, e uma lista onde o item some no instante da ação deixa
   * a dúvida de se a ação funcionou.
   */
  async comentariosRecentes(projectSlug: string, limite = 100) {
    const project = await this.projeto(projectSlug)
    const comments = await this.prisma.comment.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        body: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, email: true, status: true } },
        content: { select: { slug: true, title: true } },
      },
    })
    return { project, comments }
  }

  /**
   * Bloqueia ou libera uma conta.
   *
   * Bloquear apaga também os tokens de renovação da pessoa. Sem isso, a sessão
   * já aberta continuaria funcionando até o token curto expirar, e "bloqueei e
   * ele continua comentando" é exatamente o tipo de coisa que faz o dono
   * perder a confiança na ferramenta.
   *
   * Administrador não bloqueia administrador: evita que uma conta invadida
   * derrube o dono do próprio painel.
   */
  async bloquearConta(userId: string, bloquear: boolean, adminId: string, motivo?: string) {
    const alvo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, email: true, role: true, status: true },
    })
    if (!alvo) throw new NotFoundException('Conta não encontrada')
    if (alvo.role === 'ADMIN') {
      throw new BadRequestException('Não é possível bloquear uma conta de administrador')
    }

    const atual = await this.prisma.user.update({
      where: { id: userId },
      data: { status: bloquear ? 'SUSPENDED' : 'ACTIVE' },
      select: { id: true, displayName: true, email: true, status: true },
    })

    if (bloquear) {
      await this.prisma.refreshToken.deleteMany({ where: { userId } })
    }

    const projeto = await this.prisma.project.findFirst({ select: { id: true } })
    if (projeto) {
      await this.auditar(
        adminId,
        projeto.id,
        bloquear ? 'user.block' : 'user.unblock',
        'User',
        userId,
        { motivo: motivo ?? null, email: alvo.email },
      )
    }

    return atual
  }

  private normalizarSlug(bruto: string): string {
    return bruto
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
  }

  private async auditar(
    userId: string,
    projectId: string,
    action: string,
    entityType: string,
    entityId: string,
    changes: Record<string, unknown>,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        userId,
        projectId,
        action,
        entityType,
        entityId,
        changes: changes as Prisma.InputJsonValue,
      },
    })
  }
}
