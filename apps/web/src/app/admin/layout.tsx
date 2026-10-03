import type { ReactNode } from 'react'

export const metadata = { title: 'Painel', robots: { index: false } }

/**
 * O menu do painel não vive aqui: vive no layout raiz (`PainelPersistente`),
 * para não se desmontar ao passar de `/admin` para `/<projeto>/admin`.
 */
export default function LayoutDoPainel({ children }: { children: ReactNode }) {
  return children
}
