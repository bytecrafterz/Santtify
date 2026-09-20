import Link from 'next/link'
import { fonteDoKaraoke } from '@/app/fontes/karaoke'
import { KaraokeNoPainel } from '@/components/KaraokeNoPainel'

export const metadata = { title: 'Modo Karaokê' }

export default async function PaginaDoKaraokeNoPainel({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  /*
    ESTA PÁGINA É ESCURA E O RESTO DO PAINEL NÃO.

    É de propósito, e é a mesma decisão do palco do karaokê: aqui mora o que a
    plataforma tem de mais bonito para mostrar, e um fundo de sala de espetáculo
    faz as cores da letra valerem o que valem. O escuro está todo preso à classe
    `painel-karaoke` — nenhuma regra daqui escorre para as outras páginas do
    painel, que continuam claras.
  */
  return (
    <main className={`envoltorio painel-karaoke ${fonteDoKaraoke.variable}`}>
      <Link className="voltar" href={`/${projectSlug}/admin`}>
        ← Painel
      </Link>
      <h1>Modo Karaokê</h1>
      <p className="subtitulo">
        As palavras que ganham destaque, quem pode cantar, e a letra de cada
        música. O botão do karaokê só aparece numa faixa depois de a letra estar
        publicada — e as letras escrevem-se sozinhas aqui em cima.
      </p>
      <KaraokeNoPainel projectSlug={projectSlug} />
    </main>
  )
}
