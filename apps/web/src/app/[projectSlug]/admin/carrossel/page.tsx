import Link from 'next/link'
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
      <Link className="voltar" href={`/${projectSlug}/admin`}>
        ← Painel
      </Link>
      <h1>Projetos da página inicial</h1>
      <p className="subtitulo">
        A imagem de cada projeto, a ordem, quais aparecem, e os projetos novos.
      </p>
      <PainelDoCarrossel />
    </main>
  )
}
