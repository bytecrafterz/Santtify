import { EstruturaRaiz } from '@/components/EstruturaRaiz'

export const metadata = { title: 'Estrutura raiz' }

export default async function PaginaDaEstrutura({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio com-cabecalho">
      <EstruturaRaiz projectSlug={projectSlug} />
    </main>
  )
}
