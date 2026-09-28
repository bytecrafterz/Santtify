import { ClientesDoPainel } from '@/components/vendas/ClientesDoPainel'

export const metadata = { title: 'Clientes' }

export default async function Pagina({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params
  return <ClientesDoPainel projectSlug={projectSlug} />
}
