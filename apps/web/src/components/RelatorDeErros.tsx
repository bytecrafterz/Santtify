'use client'

import { useEffect } from 'react'
import { relatarErro } from '@/lib/erros'

/**
 * Os erros soltos do aparelho — fora do desenho da página, em eventos e em
 * promessas — vão para o registo da API. Os do desenho apanham-nos `error.tsx`
 * e `global-error.tsx`. Ver `relatarErro`.
 */
export function RelatorDeErros() {
  useEffect(() => {
    const aoErrar = (e: ErrorEvent) =>
      relatarErro({ tipo: 'janela', mensagem: String(e.message ?? e.error), pilha: e.error?.stack })
    const aoRejeitar = (e: PromiseRejectionEvent) => {
      const r = e.reason
      relatarErro({
        tipo: 'promessa',
        mensagem: r instanceof Error ? `${r.name}: ${r.message}` : String(r),
        pilha: r instanceof Error ? r.stack : undefined,
      })
    }
    window.addEventListener('error', aoErrar)
    window.addEventListener('unhandledrejection', aoRejeitar)
    return () => {
      window.removeEventListener('error', aoErrar)
      window.removeEventListener('unhandledrejection', aoRejeitar)
    }
  }, [])
  return null
}
