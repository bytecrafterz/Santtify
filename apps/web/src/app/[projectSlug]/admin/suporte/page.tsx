import Link from 'next/link'
import { AjudaESuporte } from '@/components/AjudaESuporte'

export const metadata = { title: 'Ajuda e suporte' }

export default async function PaginaDeSuporte({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio">
      <div className="cabecalho">
        <Link href={`/${projectSlug}/admin`}>← Painel</Link>
      </div>
      <h1>Ajuda e suporte</h1>
      <p className="subtitulo">Quem ficou sem entrar, e o que fazer por essa pessoa</p>
      <AjudaESuporte projectSlug={projectSlug} />
    </main>
  )
}
