import Link from 'next/link'
import { ModeracaoDaComunidade } from '@/components/ModeracaoDaComunidade'

export const metadata = { title: 'Comunidade' }

export default async function PaginaComunidade({
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
      <h1>Comunidade</h1>
      <p className="subtitulo">
        Comentários dos usuários. Aqui você apaga um comentário impróprio ou bloqueia a conta.
      </p>
      <ModeracaoDaComunidade projectSlug={projectSlug} />
    </main>
  )
}
