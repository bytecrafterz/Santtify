import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Dashboard das métricas essenciais da Fase 1.
 *
 * Tudo aqui é lido dos EVENTOS BRUTOS, não de contadores. É mais caro por
 * consulta e é a escolha certa: qualquer número mostrado ao cliente pode ser
 * auditado até o evento que o originou, e nenhum agregado pode divergir da
 * verdade sem ser recalculável.
 *
 * As comparações cruzadas, o funil por campanha e a árvore visual são Fase 2 —
 * combinado por escrito com o cliente. O que está aqui é exatamente a lista de
 * métricas essenciais do escopo acordado.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async visaoGeral(projectSlug: string, dias = 30) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true, slug: true, name: true, createdAt: true },
    })
    if (!project) throw new NotFoundException('Projeto não encontrado')

    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

    const [
      totais,
      porDia,
      origemVisitantes,
      origemCadastros,
      propagacao,
      conteudos,
      diaZero,
    ] = await Promise.all([
      this.totais(project.id),
      this.novosPorDia(project.id, desde),
      this.origemDeVisitantes(project.id),
      this.origemDeCadastros(project.id),
      this.propagacao(project.id),
      this.conteudosMaisAcessados(project.id),
      this.marcoDiaZero(project.id),
    ])

    return { project, periodoDias: dias, totais, porDia, origemVisitantes, origemCadastros, propagacao, conteudos, diaZero }
  }

  /** Visitantes, cadastros, interações. */
  private async totais(projectId: string) {
    const [visitantes, cadastros, curtidas, comentarios, compartilhamentos, cliquesEmPartilha] =
      await Promise.all([
        this.prisma.visitor.count({ where: { projectId } }),
        this.prisma.visitor.count({ where: { projectId, userId: { not: null } } }),
        this.prisma.reaction.count({ where: { projectId } }),
        this.prisma.comment.count({ where: { projectId, status: 'PUBLISHED' } }),
        this.prisma.share.count({ where: { shortLink: { projectId } } }),
        this.prisma.event.count({ where: { projectId, type: 'SHARE_LINK_CLICKED' } }),
      ])

    // Conversão de visita para cadastro: a pergunta comercial central.
    const conversao = visitantes > 0 ? Number(((cadastros / visitantes) * 100).toFixed(1)) : 0

    return { visitantes, cadastros, conversao, curtidas, comentarios, compartilhamentos, cliquesEmPartilha }
  }

  /** Curva de crescimento a partir do Dia Zero. */
  private async novosPorDia(projectId: string, desde: Date) {
    return this.prisma.$queryRaw<Array<{ dia: Date; visitantes: number; cadastros: number }>>`
      SELECT date_trunc('day', v."firstSeenAt")::date              AS dia,
             count(*)::int                                         AS visitantes,
             (count(*) FILTER (WHERE v."userId" IS NOT NULL))::int AS cadastros
      FROM visitors v
      WHERE v."projectId" = ${projectId}::uuid AND v."firstSeenAt" >= ${desde}
      GROUP BY 1 ORDER BY 1`
  }

  /**
   * Origem dos visitantes pela RAIZ da cadeia, não pelo toque imediato.
   *
   * A diferença importa: quem chegou por um compartilhamento de WhatsApp
   * originado no Instagram conta para o Instagram, porque foi o Instagram que
   * trouxe aquela pessoa para dentro. Contar pelo toque imediato faria o
   * WhatsApp parecer o maior canal de aquisição quando ele é só o meio de
   * propagação.
   */
  private async origemDeVisitantes(projectId: string) {
    return this.prisma.$queryRaw<Array<{ plataforma: string; visitantes: number }>>`
      SELECT COALESCE(v."rootPlatform"::text, 'DESCONHECIDA') AS plataforma,
             count(*)::int                                    AS visitantes
      FROM visitors v
      WHERE v."projectId" = ${projectId}::uuid
      GROUP BY 1 ORDER BY 2 DESC`
  }

  private async origemDeCadastros(projectId: string) {
    return this.prisma.$queryRaw<Array<{ plataforma: string; cadastros: number }>>`
      SELECT COALESCE(v."rootPlatform"::text, 'DESCONHECIDA') AS plataforma,
             count(*)::int                                    AS cadastros
      FROM visitors v
      WHERE v."projectId" = ${projectId}::uuid AND v."userId" IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC`
  }

  /**
   * Quanto do crescimento veio da propagação interna.
   *
   * É a prova comercial que o cliente quer poder mostrar a uma empresa:
   * "X por cento dos meus usuários foram trazidos pelos próprios usuários".
   */
  private async propagacao(projectId: string) {
    const [diretos, porPartilha, cadastrosPorPartilha] = await Promise.all([
      this.prisma.visitor.count({ where: { projectId, chainDepth: 0 } }),
      this.prisma.visitor.count({ where: { projectId, chainDepth: { gt: 0 } } }),
      this.prisma.visitor.count({
        where: { projectId, chainDepth: { gt: 0 }, userId: { not: null } },
      }),
    ])

    const total = diretos + porPartilha
    return {
      diretos,
      porPartilha,
      cadastrosPorPartilha,
      percentualPorPartilha: total > 0 ? Number(((porPartilha / total) * 100).toFixed(1)) : 0,
      // Quantos usuários novos cada pessoa adquirida diretamente trouxe.
      usuariosPorUsuario: diretos > 0 ? Number((porPartilha / diretos).toFixed(2)) : 0,
    }
  }

  private async conteudosMaisAcessados(projectId: string) {
    return this.prisma.$queryRaw<
      Array<{ titulo: string; slug: string; visualizacoes: number; visitantes: number }>
    >`
      SELECT c.title                        AS titulo,
             c.slug                         AS slug,
             count(e.id)::int                    AS visualizacoes,
             count(DISTINCT e."visitorId")::int AS visitantes
      FROM events e
      JOIN contents c ON c.id = e."contentId"
      WHERE e."projectId" = ${projectId}::uuid AND e.type = 'CONTENT_VIEW'
      GROUP BY c.title, c.slug
      ORDER BY 3 DESC
      LIMIT 10`
  }

  /** Linha de base de lançamento, para a curva ter um ponto de partida real. */
  private async marcoDiaZero(projectId: string) {
    return this.prisma.baselineSnapshot.findMany({
      where: { projectId, label: 'Dia Zero' },
      select: { platform: true, followers: true, capturedAt: true },
      orderBy: { followers: 'desc' },
    })
  }
}
