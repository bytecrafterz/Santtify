import { Platform } from '@pv/db'

/**
 * Snapshot de atribuição no momento de um evento.
 *
 * É gravado junto de CADA evento, em vez de referenciado a partir do estado
 * atual do visitante. Se a atribuição do visitante mudar amanhã, o que
 * aconteceu ontem continua verdadeiro — essa é a diferença entre um log de
 * eventos útil e um agregado que não se pode auditar.
 */
export interface AttributionSnapshot {
  projectId: string
  visitorId: string
  userId: string | null
  sessionId: string | null

  /** Origem imediata: de onde veio ESTA visita. */
  platform: Platform | null
  source: string | null
  medium: string | null
  campaignId: string | null
  campaignRef: string | null

  /** referral_id — o link pelo qual esta pessoa chegou. */
  shortLinkId: string | null
  /** parent_referral — o elo anterior da cadeia. */
  parentShortLinkId: string | null
  /** Raiz da cadeia: permite somar o gerado por uma cadeia inteira. */
  rootShortLinkId: string | null
  rootPlatform: Platform | null
  chainDepth: number

  /** Contexto técnico, já pseudonimizado. */
  ipHash: string | null
  userAgentHash: string | null
  deviceType: string | null
  countryCode: string | null
  path: string | null
  referrerHost: string | null
}

/** Dados crus de uma requisição, antes de virarem atribuição. */
export interface VisitContext {
  projectId: string
  /** Identificador anônimo do dispositivo (cookie). Criado se ausente. */
  anonId?: string | null
  /** Código do link curto, quando a pessoa chegou por /r/:code. */
  linkCode?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  /** Referência externa da publicação (id do post, do vídeo). */
  campaignRef?: string | null
  referrer?: string | null
  path?: string | null
  ip?: string | null
  userAgent?: string | null
  countryCode?: string | null
  userId?: string | null
}
