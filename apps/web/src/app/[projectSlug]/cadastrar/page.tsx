import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { FormularioDeAuth } from '@/components/FormularioDeAuth'

export const metadata = { title: 'Criar conta' }

export default async function PaginaDeCadastro({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const project = await api.projeto(projectSlug)
  if (!project) notFound()

  return (
    <main className="envoltorio estreito">
      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← {project.name}</Link>
      </div>
      <h1>Criar conta</h1>
      <p className="subtitulo">
        Para curtir, comentar e guardar por onde você já passou.
      </p>
      <FormularioDeAuth modo="cadastrar" projectId={project.id} projectSlug={projectSlug} />
    </main>
  )
}
