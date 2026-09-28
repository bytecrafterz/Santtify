import { PedidosDoPainel } from '@/components/vendas/PedidosDoPainel'

export const metadata = { title: 'Pedidos' }

export default async function Pagina({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params
  return <PedidosDoPainel projectSlug={projectSlug} />
}
