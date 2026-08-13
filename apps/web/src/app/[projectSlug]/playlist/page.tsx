import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { Playlist } from '@/components/Playlist'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'

export const metadata = { title: 'Minha Playlist' }

export default async function PaginaPlaylist({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const dados = await api.playlist(projectSlug)
  if (!dados) notFound()

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

      <Playlist projectId={dados.project.id} projectSlug={projectSlug} faixas={dados.faixas} />

      <BannerDeConsentimento projectId={dados.project.id} />
    </main>
  )
}
