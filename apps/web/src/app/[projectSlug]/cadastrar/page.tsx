import { Voltar } from '@/components/Voltar'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { FormularioDeAuth } from '@/components/FormularioDeAuth'

// O `<title>` é o nome da aplicação: o iPhone usa-o ao instalar.
export const metadata = { title: 'Santtify' }

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
        <Voltar href={`/${projectSlug}`}>{project.name}</Voltar>
      </div>
      <h1>Criar conta</h1>
      <p className="subtitulo">
        Para curtir, comentar e guardar por onde você já passou.
      </p>
      <Suspense fallback={null}>
        <FormularioDeAuth modo="cadastrar" projectId={project.id} projectSlug={projectSlug} />
      </Suspense>
    </main>
  )
}
