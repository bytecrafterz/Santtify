'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { CascaDoAdmin } from './CascaDoAdmin'

/** `/admin…` e `/<projeto>/admin…`: os endereços do painel. */
function ehDoPainel(caminho: string): boolean {
  return /^\/admin(\/|$)/.test(caminho) || /^\/[^/]+\/admin(\/|$)/.test(caminho)
}

/**
 * A CASCA DO PAINEL, MONTADA UMA VEZ SÓ (03/10).
 *
 * Vivia em dois layouts — o de `/admin` e o de `/<projeto>/admin` — e o Next
 * trata-os como árvores diferentes: ir de Conteúdo (`/admin/conteudo`) para
 * Vendas (`/<projeto>/admin/vendas`) desmontava a casca inteira e montava outra.
 * No telemóvel via-se: a faixa do menu voltava ao princípio, com a área aberta
 * fora do ecrã, e o topo piscava — "the header does not remain fixed when
 * switching pages".
 *
 * Aqui, no layout raiz, a casca fica de pé enquanto se anda dentro do painel, e
 * só a página do meio troca.
 */
export function PainelPersistente({ children }: { children: ReactNode }) {
  const caminho = usePathname() ?? ''
  if (!ehDoPainel(caminho)) return <>{children}</>
  return <CascaDoAdmin>{children}</CascaDoAdmin>
}
