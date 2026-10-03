import type { ReactNode } from 'react'
import { CascaDoAdmin } from '@/components/painel/CascaDoAdmin'

export const metadata = { title: 'Painel', robots: { index: false } }

/** O painel: o menu das oito áreas à volta de cada ecrã. Ver `CascaDoAdmin`. */
export default function LayoutDoPainel({ children }: { children: ReactNode }) {
  return <CascaDoAdmin>{children}</CascaDoAdmin>
}
