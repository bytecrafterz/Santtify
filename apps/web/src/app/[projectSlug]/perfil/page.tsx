import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { PainelDePerfil } from '@/components/PainelDePerfil'

export const metadata = { title: 'Meu perfil' }

export default async function PaginaDePerfil({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const project = await api.projeto(projectSlug)
  if (!project) notFound()

  return (
    <main className="envoltorio">
      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← {project.name}</Link>
      </div>
      <PainelDePerfil projectSlug={projectSlug} />
    </main>
  )
}
