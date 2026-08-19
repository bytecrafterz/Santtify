import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { Playlist } from '@/components/Playlist'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'

export const metadata = { title: 'Minha Playlist' }

export default async function PaginaPlaylist({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>
  searchParams: Promise<{ filtro?: string }>
}) {
  const { projectSlug } = await params
  const { filtro } = await searchParams
  const dados = await api.playlist(projectSlug)
  if (!dados) notFound()

  // O filtro pode chegar da página inicial ("Só músicas"). Só vale se existir
  // mesmo: um endereço partilhado com uma categoria já apagada abriria a lista
  // vazia, e a pessoa concluiria que não há músicas nenhumas.
  const filtroInicial = dados.categorias.some((c) => c.slug === filtro) ? filtro! : null

  return (
    <main className="envoltorio">
      <RastreadorDeVisita projectId={dados.project.id} type="PAGE_VIEW" />

      <Link className="voltar" href={`/${projectSlug}`}>
        ← {dados.project.name}
      </Link>
      <h1>Minha Playlist</h1>
      <p className="subtitulo">
        Toca as músicas em sequência, da letra A à letra Z, sem precisar escolher uma por uma.
      </p>

      <Playlist
        projectId={dados.project.id}
        projectSlug={projectSlug}
        categorias={dados.categorias}
        faixas={dados.faixas}
        filtroInicial={filtroInicial}
      />

      <BannerDeConsentimento projectId={dados.project.id} />
    </main>
  )
}
