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
  props,
}: {
  projectId: string
  contentId?: string
  type?: TipoEvento
  /**
   * Contexto extra do evento. A página inicial usa-o para dizer de que perfil
   * é esta visita: essa página É o perfil anfitrião, e contar a chegada duas
   * vezes — uma para a página, outra para o perfil — seria inventar público.
   */
  props?: Record<string, unknown>
}) {
  const jaEnviado = useRef(false)

  useEffect(() => {
    if (jaEnviado.current) return
    jaEnviado.current = true
    /**
     * AVISA A PÁGINA DEPOIS DE A VISITA FICAR REGISTADA.
     *
     * Os indicadores leem os números ao montar, e a visita é gravada ao mesmo
     * tempo — a leitura chega primeiro, e por isso o número mostrado é sempre o
     * de ANTES desta visita. Ele descreveu-o em 25/08: "está em 451, saio,
     * entro outra vez e continua 451".
     *
     * Medi e as visitas contam-se bem: 453, 454, 455 em três aberturas. O que
     * estava errado não era a contagem, era o instante em que se lê.
     */
    void rastrear({ projectId, type, contentId, props }).then(() => {
      window.dispatchEvent(new CustomEvent('pv:visita-registada'))
    })
    // `props` fica de fora das dependências de propósito: é um objecto novo a
    // cada render, e incluí-lo faria o evento disparar outra vez em cada um.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, contentId, type])

  return null
}
