import { ListaAdmin } from '@/components/ListaAdmin'

export const metadata = { title: 'Painel' }

export default async function PaginaAdmin({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    // Mais largo que o envoltório do site: o painel inicial é uma grade de
    // cartões, e em 720px caberia uma coluna só.
    <main className="pi-pagina">
      <ListaAdmin projectSlug={projectSlug} />
    </main>
  )
}
