'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker que torna o app instalável e faz o conteúdo já
 * visitado abrir sem rede — o que importa para criança em carro, em sala de
 * aula com wi-fi ruim, ou em dado móvel limitado.
 */
export function RegistroDoServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sem service worker o app continua funcionando, só não fica offline.
    })
  }, [])

  return null
}
