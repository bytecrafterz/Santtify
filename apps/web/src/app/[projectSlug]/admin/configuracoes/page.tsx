import { ConfiguracoesDoProjeto } from '@/components/painel/ConfiguracoesDoProjeto'

export const metadata = { title: 'Configurações do projeto' }

export default async function PaginaDasConfiguracoesDoProjeto({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return <ConfiguracoesDoProjeto projectSlug={projectSlug} />
}
