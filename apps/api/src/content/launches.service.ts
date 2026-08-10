import { Injectable, NotFoundException } from '@nestjs/common'
import { LaunchStatus, Prisma } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'

/**
 * "Meus Lançamentos" — vitrine dos próximos produtos.
 *
 * A definição veio dos mockups do cliente e resolveu a única dúvida de escopo
 * que estava aberta desde a proposta: não são lançamentos DO USUÁRIO, são os
 * próximos produtos que ele está preparando, cada um com o seu status.
 *
 * Por isso a lista é igual para todo mundo, mesmo aparecendo dentro do perfil,
 * e por isso ela é gerida pelo painel e não pelo usuário final.
 */
@Injectable()
export class LaunchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Leitura pública: só o que está visível, na ordem definida no painel. */
  async listar(projectSlug: string) {
    const project = await this.projeto(projectSlug)
    return this.prisma.launch.findMany({
      where: { projectId: project.id, visible: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        status: true,
        externalUrl: true,
      },
    })
  }

  /** Painel: inclui os ocultos, para o cliente preparar antes de publicar. */
  async listarParaAdmin(projectSlug: string) {
    const project = await this.projeto(projectSlug)
    const launches = await this.prisma.launch.findMany({
      where: { projectId: project.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
    return { project, launches }
  }

  async criar(
    projectSlug: string,
    dados: { title: string; description?: string; status?: LaunchStatus },
    adminId: string,
  ) {
    const project = await this.projeto(projectSlug)
    const ultimo = await this.prisma.launch.findFirst({
      where: { projectId: project.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const launch = await this.prisma.launch.create({
      data: {
        projectId: project.id,
        title: dados.title.trim(),
        description: dados.description?.trim() || null,
        status: dados.status ?? LaunchStatus.EM_BREVE,
        position: (ultimo?.position ?? 0) + 1,
      },
    })

    await this.auditar(adminId, project.id, 'launch.create', launch.id, { title: launch.title })
    return launch
  }

  async atualizar(
    id: string,
    dados: {
      title?: string
      description?: string
      imageUrl?: string
      status?: LaunchStatus
      externalUrl?: string
      visible?: boolean
      position?: number
    },
    adminId: string,
  ) {
    const launch = await this.prisma.launch.update({
      where: { id },
      data: {
        ...(dados.title !== undefined ? { title: dados.title.trim() } : {}),
        ...(dados.description !== undefined
          ? { description: dados.description.trim() || null }
          : {}),
        ...(dados.imageUrl !== undefined ? { imageUrl: dados.imageUrl || null } : {}),
        ...(dados.status !== undefined ? { status: dados.status } : {}),
        ...(dados.externalUrl !== undefined
          ? { externalUrl: dados.externalUrl.trim() || null }
          : {}),
        ...(dados.visible !== undefined ? { visible: dados.visible } : {}),
        ...(dados.position !== undefined ? { position: dados.position } : {}),
      },
    })
    await this.auditar(adminId, launch.projectId, 'launch.update', id, dados)
    return launch
  }

  async remover(id: string, adminId: string) {
    const launch = await this.prisma.launch.findUnique({ where: { id } })
    if (!launch) throw new NotFoundException('Lançamento não encontrado')
    await this.prisma.launch.delete({ where: { id } })
    await this.auditar(adminId, launch.projectId, 'launch.delete', id, {})
  }

  private async projeto(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    })
    if (!project) throw new NotFoundException('Projeto não encontrado')
    return project
  }

  private async auditar(
    userId: string,
    projectId: string,
    action: string,
    entityId: string,
    changes: Record<string, unknown>,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        userId,
        projectId,
        action,
        entityType: 'Launch',
        entityId,
        changes: changes as Prisma.InputJsonValue,
      },
    })
  }
}
