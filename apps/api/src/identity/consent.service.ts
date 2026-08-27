import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ConsentStatus, EventType, Prisma } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { AttributionService } from '../tracking/attribution.service'
import { EventsService } from '../tracking/events.service'
import { VisitContext } from '../tracking/attribution.types'

/** Finalidades apresentadas ao usuário. `essential` não é recusável. */
export interface Finalidades {
  essential: true
  analytics: boolean
  marketing: boolean
}

/**
 * Consentimento LGPD/GDPR.
 *
 * O cliente está em Portugal, então GDPR é o piso. Duas consequências práticas
 * que este serviço garante:
 *
 * 1. O consentimento é registrado com a VERSÃO da política. Quando o texto
 *    mudar, quem aceitou a versão anterior não conta como tendo aceitado a
 *    nova — sem a versão gravada, não há como provar o que a pessoa aceitou.
 * 2. A revogação é um registro novo, não uma edição do anterior. O histórico
 *    de consentimento precisa ser auditável, e sobrescrever apaga a prova.
 */
@Injectable()
export class ConsentService {
  private readonly versaoDaPolitica: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly attribution: AttributionService,
    private readonly events: EventsService,
    config: ConfigService,
  ) {
    this.versaoDaPolitica = config.get<string>('CONSENT_POLICY_VERSION') ?? '1.0.0'
  }

  async registrar(
    entrada: { granted: boolean; analytics: boolean; marketing: boolean },
    ctx: VisitContext,
  ): Promise<{ status: ConsentStatus; policyVersion: string; anonId: string | null }> {
    const visita = await this.attribution.resolveVisit(ctx)

    const finalidades: Finalidades = {
      essential: true,
      analytics: entrada.granted && entrada.analytics,
      marketing: entrada.granted && entrada.marketing,
    }

    await this.prisma.consent.create({
      data: {
        visitorId: visita.visitor.id,
        userId: visita.visitor.userId,
        policyVersion: this.versaoDaPolitica,
        purposes: finalidades as unknown as Prisma.InputJsonValue,
        granted: entrada.granted,
        ipHash: visita.attribution.ipHash,
        userAgentHash: visita.attribution.userAgentHash,
      },
    })

    const status = entrada.granted ? ConsentStatus.GRANTED : ConsentStatus.DENIED

    await this.prisma.visitor.update({
      where: { id: visita.visitor.id },
      data: { consentStatus: status, consentAt: new Date() },
    })

    await this.events.registrar({
      type: entrada.granted ? EventType.CONSENT_GIVEN : EventType.CONSENT_REVOKED,
      attribution: visita.attribution,
      props: { ...finalidades, policyVersion: this.versaoDaPolitica },
    })

    return {
      status,
      policyVersion: this.versaoDaPolitica,
      anonId: visita.anonIdGerado ? visita.visitor.anonId : null,
    }
  }

  /**
   * Situação atual do visitante.
   *
   * `precisaPerguntar` fica verdadeiro também quando a política mudou desde o
   * último aceite — é o que evita continuar operando com um consentimento que
   * se refere a um texto que não existe mais.
   */
  async situacao(anonId: string | null): Promise<{
    status: ConsentStatus
    precisaPerguntar: boolean
    policyVersion: string
  }> {
    if (!anonId) {
      return {
        status: ConsentStatus.PENDING,
        precisaPerguntar: true,
        policyVersion: this.versaoDaPolitica,
      }
    }

    const visitor = await this.prisma.visitor.findUnique({
      where: { anonId },
      select: {
        consentStatus: true,
        consents: {
          orderBy: { grantedAt: 'desc' },
          take: 1,
          select: { policyVersion: true },
        },
      },
    })

    if (!visitor) {
      return {
        status: ConsentStatus.PENDING,
        precisaPerguntar: true,
        policyVersion: this.versaoDaPolitica,
      }
    }

    const versaoAceita = visitor.consents[0]?.policyVersion
    const politicaMudou = versaoAceita !== this.versaoDaPolitica

    return {
      status: visitor.consentStatus,
      precisaPerguntar: visitor.consentStatus === ConsentStatus.PENDING || politicaMudou,
      policyVersion: this.versaoDaPolitica,
    }
  }
}
