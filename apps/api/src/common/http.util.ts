import type { CookieOptions, Request } from 'express'

/** Cookie do identificador anônimo do visitante. */
export const ANON_COOKIE = 'pv_anon'

/**
 * Um ano. É pseudônimo e serve para reconhecer o dispositivo entre visitas —
 * sem ele, a mesma pessoa voltando amanhã viraria um visitante novo e a
 * atribuição de origem se perderia.
 */
export function cookieOptions(): CookieOptions {
  return {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: false, // o PWA precisa lê-lo para enviar eventos do cliente
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
}

/**
 * IP real atrás de proxy/CDN. Só o primeiro endereço do X-Forwarded-For é do
 * cliente; o resto são os saltos intermediários.
 */
export function ipDaRequisicao(req: Request): string | null {
  const encaminhado = req.get('x-forwarded-for')
  if (encaminhado) {
    const primeiro = encaminhado.split(',')[0]?.trim()
    if (primeiro) return primeiro
  }
  return req.ip ?? req.socket?.remoteAddress ?? null
}

/** País informado pela CDN, quando houver. Evita base de geolocalização. */
export function paisDaRequisicao(req: Request): string | null {
  const pais =
    req.get('cf-ipcountry') ?? req.get('x-vercel-ip-country') ?? req.get('x-country-code')
  return pais && pais.length === 2 ? pais.toUpperCase() : null
}
