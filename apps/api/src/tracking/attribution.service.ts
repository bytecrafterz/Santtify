import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Platform, ShortLink, Visitor } from '@pv/db'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { HashService } from '../common/privacy/hash.service'
import { AttributionSnapshot, VisitContext } from './attribution.types'
import {
  ehNavegacaoInterna,
  hostDeReferrer,
  plataformaDeReferrer,
  plataformaDeUtm,
  tipoDeDispositivo,
} from './platform.util'

/**
 * Resolve quem é o visitante e de onde ele veio.
 *
 * É aqui que a promessa do Dia Zero se cumpre ou se perde: as três origens
 * (própria, imediata e raiz da cadeia) são decididas neste serviço, e o que
 * não for gravado agora não é recuperável depois.
 */
@Injectable()
export class AttributionService {
  private readonly logger = new Logger(AttributionService.name)

  /** Hosts que são nossos — usados para reconhecer navegação interna. */
  private readonly hostsProprios: ReadonlySet<string>

  constructor(
    private readonly prisma: PrismaService,
    private readonly hash: HashService,
    config: ConfigService,
  ) {
    const hosts = new Set<string>()
    for (const chave of ['PUBLIC_WEB_URL', 'PUBLIC_SHORTLINK_BASE']) {
      const valor = config.get<string>(chave)
      if (!valor) continue
      try {
        hosts.add(new URL(valor).hostname.toLowerCase())
      } catch {
        /* valor malformado é ignorado; o env já foi validado na subida */
      }
    }
    this.hostsProprios = hosts
  }

  static novoAnonId(): string {
    return `a_${randomBytes(16).toString('base64url')}`
  }

  async resolveVisit(ctx: VisitContext): Promise<{
    visitor: Visitor
    attribution: AttributionSnapshot
    anonIdGerado: boolean
  }> {
    const link = ctx.linkCode ? await this.buscarLink(ctx.linkCode) : null

    // ── Visitante ────────────────────────────────────────────────────
    let anonIdGerado = false
    let anonId = ctx.anonId?.trim() || null
    if (!anonId) {
      anonId = AttributionService.novoAnonId()
      anonIdGerado = true
    }

    const ipHash = this.hash.hashIp(ctx.ip)
    const userAgentHash = this.hash.hash(ctx.userAgent)
    const deviceType = tipoDeDispositivo(ctx.userAgent)
    const agora = new Date()

    let visitor = await this.prisma.visitor.findUnique({ where: { anonId } })

    // ── Origem imediata ──────────────────────────────────────────────
    const origem = this.origemDaVisita(ctx, link, visitor)

    if (!visitor) {
      // Primeiro contato desta pessoa. As três origens são fixadas agora.
      visitor = await this.prisma.visitor.create({
        data: {
          projectId: ctx.projectId,
          anonId,
          userId: ctx.userId ?? null,

          // Origem 1 — como ESTA pessoa chegou pela primeira vez.
          firstTouchPlatform: origem.platform,
          firstTouchSource: origem.source,
          firstTouchMedium: origem.medium,
          firstTouchCampaignId: origem.campaignId,
          firstTouchLinkId: link?.id ?? null,
          firstTouchAt: agora,

          // Origem 2 — visita mais recente (igual à primeira, neste momento).
          lastTouchPlatform: origem.platform,
          lastTouchSource: origem.source,
          lastTouchMedium: origem.medium,
          lastTouchCampaignId: origem.campaignId,
          lastTouchLinkId: link?.id ?? null,
          lastTouchAt: agora,

          // Origem 3 — o que originou a CADEIA inteira. Vem do link: se a
          // pessoa chegou por um compartilhamento, a raiz é a campanha que
          // trouxe quem compartilhou, não o WhatsApp por onde ela chegou.
          rootPlatform: link?.rootPlatform ?? origem.platform,
          rootCampaignId: link?.campaignId ?? origem.campaignId,
          rootLinkId: link?.rootShortLinkId ?? link?.id ?? null,

          // Cadeia.
          acquiredViaLinkId: link?.id ?? null,
          referredByUserId: link?.createdByUserId ?? null,
          chainDepth: link?.depth ?? 0,

          ipHash,
          userAgentHash,
          deviceType,
          countryCode: ctx.countryCode ?? null,
        },
      })
    } else {
      // Visita seguinte: só a origem imediata é atualizada. A primeira origem
      // e a raiz da cadeia NUNCA são sobrescritas — é o que garante que a
      // atribuição de aquisição continue verdadeira meses depois.
      //
      // E a origem imediata só muda quando há evidência POSITIVA de uma chegada
      // nova. Quem veio do Instagram e está passeando entre as letras — ou
      // aceitando o consentimento, ou se cadastrando — continua sendo do
      // Instagram.
      visitor = await this.prisma.visitor.update({
        where: { id: visitor.id },
        data: {
          lastSeenAt: agora,
          ...(origem.ehNova
            ? {
                lastTouchPlatform: origem.platform,
                lastTouchSource: origem.source,
                lastTouchMedium: origem.medium,
                lastTouchCampaignId: origem.campaignId,
                lastTouchLinkId: link?.id ?? null,
                lastTouchAt: agora,
              }
            : {}),
          // Vincula ao usuário se ele acabou de se autenticar.
          ...(ctx.userId && !visitor.userId ? { userId: ctx.userId } : {}),
          ...(ipHash ? { ipHash } : {}),
          ...(deviceType ? { deviceType } : {}),
        },
      })
    }

    const attribution: AttributionSnapshot = {
      projectId: ctx.projectId,
      visitorId: visitor.id,
      userId: ctx.userId ?? visitor.userId,
      sessionId: null,

      platform: origem.platform,
      source: origem.source,
      medium: origem.medium,
      campaignId: origem.campaignId,
      campaignRef: ctx.campaignRef ?? null,

      // Sem chegada nova, o link da entrada é preservado: o evento continua
      // pertencendo à jornada que trouxe a pessoa.
      shortLinkId: link?.id ?? (origem.ehNova ? null : visitor.lastTouchLinkId),
      parentShortLinkId: link?.parentShortLinkId ?? null,
      // A raiz do visitante prevalece: um visitante já conhecido que clica num
      // link novo continua pertencendo à cadeia que o adquiriu.
      rootShortLinkId: visitor.rootLinkId ?? link?.rootShortLinkId ?? null,
      rootPlatform: visitor.rootPlatform ?? link?.rootPlatform ?? origem.platform,
      chainDepth: visitor.chainDepth,

      ipHash,
      userAgentHash,
      deviceType,
      countryCode: ctx.countryCode ?? null,
      path: ctx.path ?? null,
      referrerHost: hostDeReferrer(ctx.referrer),
    }

    return { visitor, attribution, anonIdGerado }
  }

  private async buscarLink(code: string): Promise<(ShortLink & { campaignPlatform: Platform | null }) | null> {
    const link = await this.prisma.shortLink.findUnique({
      where: { code },
      include: { campaign: { select: { platform: true } } },
    })
    if (!link || !link.active) return null
    if (link.expiresAt && link.expiresAt < new Date()) return null
    return { ...link, campaignPlatform: link.campaign?.platform ?? null }
  }

  /**
   * A origem imediata é o canal por onde a pessoa chegou AGORA — o WhatsApp de
   * um compartilhamento, não o Instagram que originou a cadeia.
   *
   * A regra que sustenta a qualidade do dado: uma origem nova só é reconhecida
   * com EVIDÊNCIA POSITIVA de chegada — um link curto nosso, um UTM, ou um
   * referrer externo de plataforma conhecida. Na ausência disso, a atribuição
   * que a pessoa já tinha é preservada.
   *
   * Isso vale tanto para navegação interna entre páginas quanto para ações
   * dentro do app (aceitar consentimento, cadastrar-se, tocar um áudio). Nada
   * disso é uma chegada, e tratar como chegada foi o que antes transformava a
   * origem de todo mundo em DIRECT ou OTHER poucos cliques depois da entrada.
   */
  private origemDaVisita(
    ctx: VisitContext,
    link: (ShortLink & { campaignPlatform: Platform | null }) | null,
    visitor: Visitor | null,
  ): {
    platform: Platform | null
    source: string | null
    medium: string | null
    campaignId: string | null
    ehNova: boolean
  } {
    // 1. Link curto nosso — a evidência mais forte que existe.
    if (link) {
      const platform =
        link.channel ?? // compartilhamento: o canal escolhido por quem compartilhou
        link.campaignPlatform ?? // campanha: a plataforma da publicação
        (link.kind === 'CONTENT_QR' ? Platform.QR_CODE : null) ??
        link.rootPlatform

      return {
        platform,
        source: ctx.utmSource ?? platform?.toLowerCase() ?? null,
        medium: ctx.utmMedium ?? (link.kind === 'SHARE' ? 'share' : link.kind.toLowerCase()),
        campaignId: link.campaignId,
        ehNova: true,
      }
    }

    // 2. UTM na URL — a pessoa chegou por uma campanha marcada.
    const porUtm = plataformaDeUtm(ctx.utmSource)
    if (porUtm) {
      return {
        platform: porUtm,
        source: ctx.utmSource ?? null,
        medium: ctx.utmMedium ?? null,
        campaignId: null,
        ehNova: true,
      }
    }

    // 3. Referrer externo de plataforma RECONHECIDA. Um referrer que não
    //    reconhecemos não vale como origem nova: registrar OTHER por cima de
    //    "Instagram" troca informação boa por informação inútil.
    const interna = ehNavegacaoInterna(ctx.referrer, this.hostsProprios)
    const porReferrer = interna ? null : plataformaDeReferrer(ctx.referrer)
    if (porReferrer && porReferrer !== Platform.OTHER) {
      return {
        platform: porReferrer,
        source: hostDeReferrer(ctx.referrer),
        medium: ctx.utmMedium ?? null,
        campaignId: null,
        ehNova: true,
      }
    }

    // 4. Sem evidência de chegada. Visitante conhecido mantém o que tinha.
    if (visitor) {
      return {
        platform: visitor.lastTouchPlatform,
        source: visitor.lastTouchSource,
        medium: visitor.lastTouchMedium,
        campaignId: visitor.lastTouchCampaignId,
        ehNova: false,
      }
    }

    // 5. Visitante novo sem nenhuma pista: acesso direto de verdade.
    return {
      platform: porReferrer ?? Platform.DIRECT,
      source: hostDeReferrer(ctx.referrer) ?? 'direct',
      medium: ctx.utmMedium ?? null,
      campaignId: null,
      ehNova: true,
    }
  }
}
