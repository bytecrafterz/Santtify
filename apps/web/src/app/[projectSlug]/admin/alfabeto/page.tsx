import { SequenciaDoAlfabeto } from '@/components/SequenciaDoAlfabeto'

export const metadata = { title: 'Alfabeto — sequência infinita' }

export default async function PaginaDoAlfabeto({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio com-cabecalho">
      <SequenciaDoAlfabeto projectSlug={projectSlug} />
    </main>
  )
}
