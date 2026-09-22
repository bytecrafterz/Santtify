import { Voltar } from '@/components/Voltar'
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
      <Voltar href={`/${projectSlug}/admin`}>Painel</Voltar>
      <h1>Categorias de áudio</h1>
      <p className="subtitulo">
        Servem para a pessoa escolher o que ouvir na playlist: só as músicas, só as
        explicações, só as orações.
      </p>
      <CategoriasDeAudio projectSlug={projectSlug} />
    </main>
  )
}
