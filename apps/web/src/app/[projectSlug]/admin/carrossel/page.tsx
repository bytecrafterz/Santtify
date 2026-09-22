import { Voltar } from '@/components/Voltar'
import { PainelDoCarrossel } from '@/components/PainelDoCarrossel'

export const metadata = { title: 'Projetos da página inicial' }

export default async function PaginaDoCarrossel({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio">
      <Voltar href={`/${projectSlug}/admin`}>Painel</Voltar>
      <h1>Projetos da página inicial</h1>
      <p className="subtitulo">
        A imagem de cada projeto, a ordem, quais aparecem, e os projetos novos.
      </p>
      <PainelDoCarrossel />
    </main>
  )
}
