import { Dashboard } from '@/components/Dashboard'

export const metadata = { title: 'Métricas' }

export default async function PaginaDeMetricas({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio">
      <Dashboard projectSlug={projectSlug} />
    </main>
  )
}
