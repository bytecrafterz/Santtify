'use client'

import { useEffect, useRef } from 'react'
import { rastrear, type TipoEvento } from '@/lib/track'

/**
 * Dispara um evento uma única vez por montagem.
 *
 * O `useRef` existe por causa do StrictMode do React, que monta o componente
 * duas vezes em desenvolvimento — sem ele, cada visualização contaria dobrada
 * e o número que o cliente vai mostrar a uma empresa estaria errado.
 */
export function RastreadorDeVisita({
  projectId,
  contentId,
  type = 'CONTENT_VIEW',
}: {
  projectId: string
  contentId?: string
  type?: TipoEvento
}) {
  const jaEnviado = useRef(false)

  useEffect(() => {
    if (jaEnviado.current) return
    jaEnviado.current = true
    void rastrear({ projectId, type, contentId })
  }, [projectId, contentId, type])

  return null
}
