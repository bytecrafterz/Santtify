import Link from 'next/link'
import { FilaDeModeracao } from '@/components/FilaDeModeracao'

export const metadata = { title: 'Aprovações' }

export default async function PaginaModeracao({
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
      <h1>Aprovações</h1>
      <p className="subtitulo">Fotos publicadas pelos usuários, esperando a sua aprovação.</p>
      <FilaDeModeracao projectSlug={projectSlug} />
    </main>
  )
}
