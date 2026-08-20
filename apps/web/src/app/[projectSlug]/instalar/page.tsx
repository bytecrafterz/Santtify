import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { ConviteDeInstalacao } from '@/components/ConviteDeInstalacao'

export const metadata = { title: 'Instalar o Santtify' }

export default async function PaginaDeInstalacao({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const project = await api.projeto(projectSlug)
  if (!project) notFound()

  return (
    <main className="envoltorio estreito">
      <ConviteDeInstalacao projectSlug={projectSlug} />
    </main>
  )
}
