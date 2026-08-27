import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { EventType, ShortLinkKind } from '@pv/db'
import { ShortLinksService } from './short-links.service'
import { AttributionService } from '../tracking/attribution.service'
import { EventsService } from '../tracking/events.service'
import { ANON_COOKIE, cookieOptions, ipDaRequisicao } from '../common/http.util'

/**
 * Porta de entrada de todo tráfego rastreado: QR Code escaneado, link de
 * campanha aberto, link de compartilhamento clicado.
 *
 * A atribuição é decidida aqui, antes do redirecionamento. Se este handler
 * falhar em gravar, o dado desse visitante não existe — por isso o
 * redirecionamento nunca depende do sucesso da gravação, mas a falha é logada.
 */
@Controller('r')
export class ShortLinksController {

  constructor(
    private readonly shortLinks: ShortLinksService,
    private readonly attribution: AttributionService,
    private readonly events: EventsService,
    config: ConfigService,
  ) {
  }

  @Get(':code')
  async abrir(
    @Param('code') code: string,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const link = await this.shortLinks.resolver(code)

    const { attribution, anonIdGerado, visitor } = await this.attribution.resolveVisit({
      projectId: link.projectId,
      anonId: req.cookies?.[ANON_COOKIE] ?? null,
      linkCode: code,
      utmSource: query.utm_source ?? null,
      utmMedium: query.utm_medium ?? null,
      utmCampaign: query.utm_campaign ?? null,
      campaignRef: query.pv_ref ?? null,
      referrer: req.get('referer') ?? null,
      path: `/r/${code}`,
      ip: ipDaRequisicao(req),
      userAgent: req.get('user-agent') ?? null,
    })

    if (anonIdGerado) {
      res.cookie(ANON_COOKIE, visitor.anonId, cookieOptions())
    }

    // O tipo de entrada diferencia scan de QR de clique em compartilhamento —
    // é o que permite responder "quantos vieram de QR" e "quantos de partilha".
    const tipoDeEntrada =
      link.kind === ShortLinkKind.SHARE
        ? EventType.SHARE_LINK_CLICKED
        : link.kind === ShortLinkKind.CONTENT_QR
          ? EventType.QR_SCAN
          : EventType.PAGE_VIEW

    await this.events.registrarVarios([
      { type: tipoDeEntrada, attribution, contentId: link.contentId },
      { type: EventType.SESSION_START, attribution, contentId: link.contentId },
    ])

    return res.redirect(302, link.targetUrl)
  }
}
