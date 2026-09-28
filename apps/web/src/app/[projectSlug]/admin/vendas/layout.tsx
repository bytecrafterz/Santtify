import type { ReactNode } from 'react'
import { CascaDoPainelDeVendas } from '@/components/vendas/CascaDoPainelDeVendas'

export const metadata = { title: 'Vendas', robots: { index: false } }

/** O painel de vendas e afiliados: o menu do lado, a página ao meio. */
export default async function LayoutDasVendas({
  params,
  children,
}: {
  params: Promise<{ projectSlug: string }>
  children: ReactNode
}) {
  const { projectSlug } = await params
  return <CascaDoPainelDeVendas projectSlug={projectSlug}>{children}</CascaDoPainelDeVendas>
}
