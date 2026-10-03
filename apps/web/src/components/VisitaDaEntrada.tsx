'use client'

import { useRef } from 'react'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * A visita à página inicial, e a quem ela conta (03/10).
 *
 * A visita conta SEMPRE para o site — é dela que sai o número de visitantes do
 * olho da página inicial. Para o PERFIL do anfitrião só conta quando é o perfil
 * dele que está à vista: quem chega sem conta. Quem tem conta vê o seu próprio
 * perfil, e contá-la como visualização do anfitrião era o que fazia o número
 * dele crescer com visitas que nunca o viram (e com as do próprio dono).
 *
 * Espera pela sessão antes de decidir, e decide uma vez — como `VisitaAoPerfil`.
 */
export function VisitaDaEntrada({ projectId, anfitriaoId }: { projectId: string; anfitriaoId: string | null }) {
  const { usuario, carregando } = useAuth()
  const decisao = useRef<'anfitriao' | 'so-o-site' | null>(null)
  if (decisao.current === null && !carregando) {
    decisao.current = !usuario && anfitriaoId ? 'anfitriao' : 'so-o-site'
  }
  if (decisao.current === null) return null
  return (
    <RastreadorDeVisita
      projectId={projectId}
      type="PAGE_VIEW"
      props={decisao.current === 'anfitriao' && anfitriaoId ? { perfilId: anfitriaoId } : undefined}
    />
  )
}
