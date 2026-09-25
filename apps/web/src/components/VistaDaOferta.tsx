'use client'

import { useEffect, useRef } from 'react'
import { social } from '@/lib/social'

/**
 * Conta uma vista do cartaz quando ele entra mesmo no ecrã.
 *
 * NÃO é a vista da página. Quem abre a página do projeto e nunca desce até ao
 * cartaz não o viu, e contá-lo enchia de ar o número que ele vai usar para
 * decidir se a oferta funciona. A página já tem o seu próprio contador.
 *
 * Uma vez por carregamento: o observador desliga-se no primeiro encontro. Sem
 * isso, subir e descer a página contava dez vistas ao mesmo par de olhos.
 *
 * Dispara `pv:visita-registada` a seguir porque é esse o sinal que os
 * indicadores ouvem para relerem. Sem ele, o número mostrado seria sempre o de
 * antes desta visita — a leitura e a gravação acontecem no mesmo instante e a
 * leitura chega primeiro.
 */
export function VistaDaOferta({
  projectSlug,
  categoria,
}: {
  projectSlug: string
  categoria: string
}) {
  const marca = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const alvo = marca.current
    if (!alvo || typeof IntersectionObserver === 'undefined') return

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return
        observador.disconnect()
        social
          .verOferta(projectSlug, categoria)
          .then(() => window.dispatchEvent(new Event('pv:visita-registada')))
          .catch(() => {
            // Falhar a contar não estraga a página a ninguém.
          })
      },
      // Metade do cartaz à vista. Um pixel a assomar no fundo do ecrã não é ver.
      { threshold: 0.5 },
    )
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [projectSlug, categoria])

  return <span ref={marca} aria-hidden="true" className="vista-da-oferta" />
}
