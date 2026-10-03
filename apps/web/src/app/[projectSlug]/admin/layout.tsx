import type { ReactNode } from 'react'
import { CascaDoAdmin } from '@/components/painel/CascaDoAdmin'

export const metadata = { title: 'Painel', robots: { index: false } }

/**
 * Os ecrãs de um projeto ficam dentro da mesma casca da entrada do painel, com o
 * mesmo menu: de qualquer ecrã chega-se a qualquer área. Ver `CascaDoAdmin`.
 */
export default function LayoutDoPainelDoProjeto({ children }: { children: ReactNode }) {
  return <CascaDoAdmin>{children}</CascaDoAdmin>
}
