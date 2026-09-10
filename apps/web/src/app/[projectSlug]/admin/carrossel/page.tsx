import Link from 'next/link'
import { PainelDoCarrossel } from '@/components/PainelDoCarrossel'

export const metadata = { title: 'Carrossel de projetos' }

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
      <h1>Carrossel de projetos</h1>
      <p className="subtitulo">
        Escolha os dois projetos em destaque e crie projetos novos. Um projeto
        novo entra no carrossel sozinho.
      </p>
      <PainelDoCarrossel />
    </main>
  )
}
