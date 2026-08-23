import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { ReporSenha } from '@/components/ReporSenha'

export const metadata = { title: 'Escolher senha nova' }

export default async function PaginaDeReposicao({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { projectSlug } = await params
  const { t } = await searchParams
  const project = await api.projeto(projectSlug)
  if (!project) notFound()

  return (
    <main className="envoltorio estreito">
      <h1>Escolher senha nova</h1>
      {t ? (
        <Suspense fallback={null}>
          <ReporSenha token={t} projectSlug={projectSlug} />
        </Suspense>
      ) : (
        <div className="bloco">
          <p>Este endereço precisa do link que lhe foi enviado.</p>
          <p className="nota">
            Se não o tem, <Link href={`/${projectSlug}/recuperar`}>peça o acesso de novo</Link>.
          </p>
        </div>
      )}
    </main>
  )
}
