import type { ReactNode } from 'react'

export const metadata = { title: 'Painel', robots: { index: false } }

/** O menu do painel vive no layout raiz — ver `PainelPersistente`. */
export default function LayoutDoPainelDoProjeto({ children }: { children: ReactNode }) {
  return children
}
