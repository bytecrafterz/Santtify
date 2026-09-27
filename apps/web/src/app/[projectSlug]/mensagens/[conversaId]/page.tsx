import { ConversaPrivada } from '@/components/MensagensPrivadas'

export const metadata = { title: 'Santtify', robots: { index: false } }

export default async function PaginaDaConversa({
  params,
}: {
  params: Promise<{ projectSlug: string; conversaId: string }>
}) {
  const { projectSlug, conversaId } = await params
  return (
    <main className="envoltorio">
      <ConversaPrivada projectSlug={projectSlug} conversaId={conversaId} />
    </main>
  )
}
