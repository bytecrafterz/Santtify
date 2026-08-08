import { Platform } from '@pv/db'

/**
 * Mapeamento de origem para as plataformas que o cliente quer comparar.
 *
 * Só é usado quando a visita NÃO chegou por um link curto nosso. Link curto é
 * sempre mais confiável: o referrer se perde em app nativo, em WhatsApp e em
 * qualquer navegação com `noreferrer` — que é justamente o caso da maior parte
 * do tráfego de rede social. Daí a insistência em usar link identificável.
 */
const POR_HOST: ReadonlyArray<[RegExp, Platform]> = [
  [/(^|\.)instagram\.com$/i, Platform.INSTAGRAM],
  [/(^|\.)tiktok\.com$/i, Platform.TIKTOK],
  [/(^|\.)(youtube\.com|youtu\.be)$/i, Platform.YOUTUBE],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com)$/i, Platform.FACEBOOK],
  [/(^|\.)(whatsapp\.com|wa\.me)$/i, Platform.WHATSAPP],
  [/(^|\.)google\./i, Platform.GOOGLE],
]

const POR_UTM: Readonly<Record<string, Platform>> = {
  instagram: Platform.INSTAGRAM,
  ig: Platform.INSTAGRAM,
  tiktok: Platform.TIKTOK,
  youtube: Platform.YOUTUBE,
  yt: Platform.YOUTUBE,
  facebook: Platform.FACEBOOK,
  fb: Platform.FACEBOOK,
  whatsapp: Platform.WHATSAPP,
  wpp: Platform.WHATSAPP,
  google: Platform.GOOGLE,
  email: Platform.EMAIL,
  qr: Platform.QR_CODE,
  qrcode: Platform.QR_CODE,
}

export function plataformaDeUtm(utmSource?: string | null): Platform | null {
  if (!utmSource) return null
  return POR_UTM[utmSource.trim().toLowerCase()] ?? Platform.OTHER
}

export function plataformaDeReferrer(referrer?: string | null): Platform | null {
  const host = hostDeReferrer(referrer)
  if (!host) return null
  for (const [padrao, plataforma] of POR_HOST) {
    if (padrao.test(host)) return plataforma
  }
  return Platform.OTHER
}

export function hostDeReferrer(referrer?: string | null): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).hostname
  } catch {
    return null
  }
}

/** Classificação grosseira de dispositivo, suficiente para o dashboard. */
export function tipoDeDispositivo(userAgent?: string | null): string | null {
  if (!userAgent) return null
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet'
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile'
  return 'desktop'
}
