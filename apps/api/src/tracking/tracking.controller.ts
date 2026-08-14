import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { EventType } from '@pv/db'
import { IsEnum, IsISO8601, IsObject, IsOptional, IsString, IsUUID } from 'class-validator'
import { AttributionService } from './attribution.service'
import { EventsService } from './events.service'
import { ANON_COOKIE, cookieOptions, ipDaRequisicao, paisDaRequisicao } from '../common/http.util'

/** Eventos que o PWA pode enviar. Compra é da Fase 2 e não é aceita aqui. */
const TIPOS_PERMITIDOS = new Set<EventType>([
  EventType.PAGE_VIEW,
  EventType.CONTENT_VIEW,
  EventType.MEDIA_PLAY,
  EventType.MEDIA_PROGRESS,
  EventType.MEDIA_COMPLETE,
  EventType.PROFILE_VIEW,
  // O clique no selo PV nasce no navegador e é inofensivo se alguém forjar:
  // infla um contador de curiosidade, não uma venda nem um cadastro. Compra
  // continua de fora — aquela só entra por dentro, pela rota de checkout.
  EventType.PV_CLICK,
  EventType.CUSTOM,
])

export class RegistrarEventoDto {
  @IsUUID()
  projectId!: string

  @IsEnum(EventType)
  type!: EventType

  @IsOptional()
  @IsUUID()
  contentId?: string

  @IsOptional()
  @IsString()
  path?: string

  @IsOptional()
  @IsString()
  linkCode?: string

  @IsOptional()
  @IsString()
  utmSource?: string

  @IsOptional()
  @IsString()
  utmMedium?: string

  @IsOptional()
  @IsString()
  utmCampaign?: string

  @IsOptional()
  @IsString()
  campaignRef?: string

  @IsOptional()
  @IsISO8601()
  occurredAt?: string

  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>
}

@Controller('track')
export class TrackingController {
  constructor(
    private readonly attribution: AttributionService,
    private readonly events: EventsService,
  ) {}

  /**
   * Ingestão de eventos do cliente.
   *
   * Responde 204 e nunca falha por causa de rastreamento — se a gravação der
   * erro, o usuário não percebe e o erro fica no log. O que não pode acontecer
   * é o inverso: um erro de tracking derrubar a página.
   */
  @Post()
  @HttpCode(204)
  async registrar(@Body() dto: RegistrarEventoDto, @Req() req: Request, @Res() res: Response) {
    if (!TIPOS_PERMITIDOS.has(dto.type)) {
      // Tipos sensíveis (cadastro, compra, curtida) são gravados pelo servidor
      // no fluxo que os origina, nunca aceitos do cliente.
      return res.status(204).send()
    }

    const { attribution, anonIdGerado, visitor } = await this.attribution.resolveVisit({
      projectId: dto.projectId,
      anonId: req.cookies?.[ANON_COOKIE] ?? null,
      linkCode: dto.linkCode ?? null,
      utmSource: dto.utmSource ?? null,
      utmMedium: dto.utmMedium ?? null,
      utmCampaign: dto.utmCampaign ?? null,
      campaignRef: dto.campaignRef ?? null,
      referrer: req.get('referer') ?? null,
      path: dto.path ?? null,
      ip: ipDaRequisicao(req),
      userAgent: req.get('user-agent') ?? null,
      countryCode: paisDaRequisicao(req),
    })

    if (anonIdGerado) {
      res.cookie(ANON_COOKIE, visitor.anonId, cookieOptions())
    }

    await this.events.registrar({
      type: dto.type,
      attribution,
      contentId: dto.contentId ?? null,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      props: (dto.props ?? {}) as Record<string, never>,
    })

    return res.status(204).send()
  }
}
