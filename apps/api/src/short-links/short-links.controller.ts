import { Controller, Get, Logger, Param, Query, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { EventType, ShortLinkKind } from '@pv/db'
import { ShortLinksService } from './short-links.service'
import { AttributionService } from '../tracking/attribution.service'
import { EventsService } from '../tracking/events.service'
import { ANON_COOKIE, cookieOptions, ipDaRequisicao } from '../common/http.util'
import { AfiliadosService } from '../afiliados/afiliados.service'

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
  private readonly logger = new Logger(ShortLinksController.name)

  constructor(
    private readonly shortLinks: ShortLinksService,
    private readonly attribution: AttributionService,
    private readonly events: EventsService,
    private readonly afiliados: AfiliadosService,
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
    /*
      O LINK DE UM AFILIADO. santtify.com/af/<código> chega aqui como
      `af-<código>` e segue pelo mesmo caminho de todos os links — o que lhe dá
      o cookie, a origem e as métricas de graça. O link rastreado de quem
      virou afiliado na migração nasce aqui, no primeiro clique.

      Um código que não existe NÃO dá erro: vai para a loja. Um link partilhado
      no WhatsApp com uma letra trocada continua a vender, só sem comissão.
    */
    let codigo = code
    if (/^af-/i.test(code)) {
      const doAfiliado = await this.afiliados.linkDoCodigo(code).catch((erro) => {
        this.logger.error(`Link de afiliado ${code}: ${String(erro)}`)
        return null
      })
      if (!doAfiliado) return res.redirect(302, await this.afiliados.urlDaLoja())
      codigo = doAfiliado.code
    }

    const link = await this.shortLinks.resolver(codigo)

    const { attribution, anonIdGerado, visitor } = await this.attribution.resolveVisit({
      projectId: link.projectId,
      anonId: req.cookies?.[ANON_COOKIE] ?? null,
      linkCode: codigo,
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
        : link.kind === ShortLinkKind.CONTENT_QR || link.kind === ShortLinkKind.PUBLICACAO_QR
          ? EventType.QR_SCAN
          : EventType.PAGE_VIEW

    await this.events.registrarVarios([
      { type: tipoDeEntrada, attribution, contentId: link.contentId },
      { type: EventType.SESSION_START, attribution, contentId: link.contentId },
    ])

    // O clique do afiliado: um por pessoa por dia, e é dele que sai a venda.
    if (link.kind === ShortLinkKind.AFILIADO) {
      await this.afiliados
        .registarClique(link, visitor, req.get('user-agent'))
        .catch((erro) => this.logger.error(`Clique de afiliado não registado: ${String(erro)}`))
    }

    return res.redirect(302, link.targetUrl)
  }
}
