import { ListaDeConversas } from '@/components/MensagensPrivadas'

// O `<title>` é o nome da aplicação: o iPhone usa-o ao instalar.
export const metadata = { title: 'Santtify', robots: { index: false } }

export default async function PaginaDeMensagens({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio">
      <ListaDeConversas projectSlug={projectSlug} />
    </main>
  )
}
