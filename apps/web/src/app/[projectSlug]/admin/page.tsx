import { ListaAdmin } from '@/components/ListaAdmin'

export const metadata = { title: 'Painel' }

export default async function PaginaAdmin({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio">
      <h1>Painel</h1>
      <ListaAdmin projectSlug={projectSlug} />
    </main>
  )
}
