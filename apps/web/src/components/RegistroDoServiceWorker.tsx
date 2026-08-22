'use client'

import { useEffect, useRef } from 'react'

/**
 * Regista o service worker e garante que ninguém fica preso numa versão velha.
 *
 * O cliente instalou a aplicação, publicou alterações durante dias e continuou
 * a ver o que tinha visto na primeira vez. Registar o service worker uma vez e
 * confiar que ele se actualiza sozinho não chega: o navegador só vai procurar
 * uma versão nova quando lhe apetece, e uma aplicação instalada pode ficar
 * aberta semanas.
 *
 * Aqui procuramos activamente: ao abrir, e sempre que a pessoa volta ao
 * separador. Quando o service worker novo assume, ele avisa e a página
 * recarrega-se — uma vez só, senão entrava em ciclo.
 */
export function RegistroDoServiceWorker() {
  const jaRecarregou = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    let registo: ServiceWorkerRegistration | null = null

    navigator.serviceWorker
      .register('/sw.js')
      .then((r) => {
        registo = r
        // Procura uma versão nova logo à partida.
        void r.update().catch(() => {})
      })
      .catch(() => {
        // Sem service worker o site continua a funcionar, só não fica offline.
      })

    function aoVoltar() {
      if (document.visibilityState === 'visible') void registo?.update().catch(() => {})
    }
    document.addEventListener('visibilitychange', aoVoltar)

    function aoReceber(evento: MessageEvent) {
      if (evento.data?.tipo !== 'versao-nova') return
      if (jaRecarregou.current) return
      jaRecarregou.current = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('message', aoReceber)

    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      navigator.serviceWorker.removeEventListener('message', aoReceber)
    }
  }, [])

  return null
}
