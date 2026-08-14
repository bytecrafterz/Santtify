import Link from 'next/link'
import { CategoriasDeAudio } from '@/components/CategoriasDeAudio'

export const metadata = { title: 'Categorias de áudio' }

export default async function PaginaCategorias({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio">
      <Link className="voltar" href={`/${projectSlug}/admin`}>
        ← Painel
      </Link>
      <h1>Categorias de áudio</h1>
      <p className="subtitulo">
        Servem para a pessoa escolher o que ouvir na playlist: só as músicas, só as
        explicações, só as orações.
      </p>
      <CategoriasDeAudio projectSlug={projectSlug} />
    </main>
  )
}
