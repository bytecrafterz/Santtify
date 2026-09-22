import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { FormularioDeAuth } from '@/components/FormularioDeAuth'
import { Voltar } from '@/components/Voltar'

// O `<title>` é o nome da aplicação: o iPhone usa-o ao instalar.
export const metadata = { title: 'Santtify' }

export default async function PaginaDeLogin({
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
      <h1>Entrar</h1>
      <p className="subtitulo">Que bom te ver de novo.</p>
      <Suspense fallback={null}>
        <FormularioDeAuth modo="entrar" projectId={project.id} projectSlug={projectSlug} />
      </Suspense>
    </main>
  )
}
