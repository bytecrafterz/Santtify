import { ConfiguracoesDoPainel } from '@/components/vendas/ConfiguracoesDoPainel'

export const metadata = { title: 'Configurações' }

export default async function Pagina({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params
  return <ConfiguracoesDoPainel projectSlug={projectSlug} />
}
