import { Injectable, Logger } from '@nestjs/common'
import { EventType, Prisma } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { AttributionSnapshot } from './attribution.types'

export interface RegistrarEventoInput {
  type: EventType
  attribution: AttributionSnapshot
  contentId?: string | null
  occurredAt?: Date
  props?: Prisma.InputJsonValue
  /** Comércio — Fase 2. Os campos existem; nada os preenche na Fase 1. */
  productRef?: string | null
  value?: number | string | null
  currency?: string | null
  externalOrderRef?: string | null
}

/**
 * Gravação de eventos.
 *
 * Único ponto do sistema que escreve em `events`. A tabela é append-only por
 * trigger, então não existe update nem correção: um dado errado é corrigido
 * por evento compensatório, nunca reescrevendo o passado.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async registrar(input: RegistrarEventoInput): Promise<void> {
    const a = input.attribution
    try {
      await this.prisma.event.create({
        data: {
          type: input.type,
          occurredAt: input.occurredAt ?? new Date(),
          projectId: a.projectId,
          visitorId: a.visitorId,
          userId: a.userId,
          sessionId: a.sessionId,
          contentId: input.contentId ?? null,

          platform: a.platform,
          source: a.source,
          medium: a.medium,
          campaignId: a.campaignId,
          campaignRef: a.campaignRef,

          shortLinkId: a.shortLinkId,
          parentShortLinkId: a.parentShortLinkId,
          rootShortLinkId: a.rootShortLinkId,
          rootPlatform: a.rootPlatform,
          chainDepth: a.chainDepth,

          productRef: input.productRef ?? null,
          value: input.value != null ? new Prisma.Decimal(input.value) : null,
          currency: input.currency ?? null,
          externalOrderRef: input.externalOrderRef ?? null,

          props: input.props ?? {},

          path: a.path,
          referrerHost: a.referrerHost,
          ipHash: a.ipHash,
          userAgentHash: a.userAgentHash,
          deviceType: a.deviceType,
          countryCode: a.countryCode,
        },
      })
    } catch (erro) {
      // Rastreamento nunca derruba a experiência do usuário. Mas o erro é
      // registrado alto: perder evento é perder dado que não volta.
      this.logger.error(
        `Falha ao gravar evento ${input.type} (visitante ${a.visitorId}): ${erro instanceof Error ? erro.message : erro}`,
      )
    }
  }

  /** Vários eventos do mesmo contexto, numa só ida ao banco. */
  async registrarVarios(inputs: RegistrarEventoInput[]): Promise<void> {
    await Promise.all(inputs.map((i) => this.registrar(i)))
  }
}
