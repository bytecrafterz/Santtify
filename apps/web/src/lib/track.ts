'use client'

/**
 * Envio de eventos do cliente.
 *
 * Duas regras que valem mais do que parecem:
 *
 * 1. Rastreamento nunca quebra a página. Todo erro é engolido — a alternativa
 *    é uma criança olhando para uma tela branca porque a analytics falhou.
 * 2. `credentials: 'include'` é obrigatório: é o cookie `pv_anon` que liga
 *    esta visita à pessoa que escaneou o QR. Sem ele, cada evento vira um
 *    visitante novo e a atribuição de origem se perde.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'

export type TipoEvento =
  | 'PV_CLICK'
  | 'PV_CONTACT'
  | 'PAGE_VIEW'
  | 'CONTENT_VIEW'
  | 'MEDIA_PLAY'
  | 'MEDIA_PROGRESS'
  | 'MEDIA_COMPLETE'
  | 'PROFILE_VIEW'
  | 'CUSTOM'

export interface EventoInput {
  projectId: string
  type: TipoEvento
  contentId?: string
  props?: Record<string, unknown>
}

/** Parâmetros de origem preservados da URL de entrada. */
function parametrosDeOrigem(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const p = new URLSearchParams(window.location.search)
  const out: Record<string, string> = {}
  const utmSource = p.get('utm_source')
  const utmMedium = p.get('utm_medium')
  const utmCampaign = p.get('utm_campaign')
  const ref = p.get('pv_ref')
  const link = p.get('pv')
  if (utmSource) out.utmSource = utmSource
  if (utmMedium) out.utmMedium = utmMedium
  if (utmCampaign) out.utmCampaign = utmCampaign
  if (ref) out.campaignRef = ref
  if (link) out.linkCode = link
  return out
}

export async function rastrear(evento: EventoInput): Promise<void> {
  try {
    await fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true, // sobrevive à navegação para fora da página
      body: JSON.stringify({
        ...evento,
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        occurredAt: new Date().toISOString(),
        ...parametrosDeOrigem(),
      }),
    })
  } catch {
    // Silencioso por desenho. Ver regra 1 acima.
  }
}
