import Link from 'next/link'
import { KaraokeNoPainel } from '@/components/KaraokeNoPainel'

export const metadata = { title: 'Modo Karaokê' }

export default async function PaginaDoKaraokeNoPainel({
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
      <h1>Modo Karaokê</h1>
      <p className="subtitulo">
        As palavras que ganham destaque, quem pode cantar, e a sincronização de
        cada música. O botão do karaokê só aparece numa faixa depois de você
        publicar a letra dela.
      </p>
      <KaraokeNoPainel projectSlug={projectSlug} />
    </main>
  )
}
