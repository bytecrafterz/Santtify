import { PainelDoCarrossel } from '@/components/PainelDoCarrossel'

export const metadata = { title: 'Página inicial' }

/** A ordem dos projetos na página inicial: a aba "Página inicial" da área Conteúdo. */
export default function PaginaDoCarrossel() {
  return (
    <main className="envoltorio">
      <h1>Projetos da página inicial</h1>
      <p className="subtitulo">A imagem de cada projeto, a ordem, e quais aparecem.</p>
      <PainelDoCarrossel />
    </main>
  )
}
