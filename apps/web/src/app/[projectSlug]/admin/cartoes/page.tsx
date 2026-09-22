import { Voltar } from '@/components/Voltar'
import { PainelDeModelosDeCartao } from '@/components/PainelDeModelosDeCartao'

export const metadata = { title: 'Cartões personalizados' }

export default async function PaginaDeCartoes({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio">
      <Voltar href={`/${projectSlug}/admin`}>Painel</Voltar>
      <h1>Cartões personalizados</h1>
      <p className="subtitulo">
        Os modelos, o preço e o desconto. As medidas da moldura são o que faz a
        verificação de qualidade das fotos funcionar — peça-as ao designer junto
        com as artes.
      </p>
      <PainelDeModelosDeCartao projectSlug={projectSlug} />
    </main>
  )
}
