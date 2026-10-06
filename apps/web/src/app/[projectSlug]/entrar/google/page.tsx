import { Suspense } from 'react'
import { RegressoDoGoogle } from '@/components/RegressoDoGoogle'

// O `<title>` é o nome da aplicação: o iPhone usa-o ao instalar.
export const metadata = { title: 'Santtify', robots: { index: false } }

/** Onde o "Continuar com Google" termina (06/10): ver `RegressoDoGoogle`. */
export default async function PaginaDoRegressoDoGoogle({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio estreito">
      <Suspense fallback={<p className="subtitulo">Entrando…</p>}>
        <RegressoDoGoogle projectSlug={projectSlug} />
      </Suspense>
    </main>
  )
}
