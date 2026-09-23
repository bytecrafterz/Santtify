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
        Aqui carrega a arte de cada cartão, ajusta onde entram a foto e o nome,
        e define o preço e o desconto. Abra um cartão para ver a folha ao lado:
        o retângulo mostra onde a foto vai cair.
      </p>
      <PainelDeModelosDeCartao projectSlug={projectSlug} />
    </main>
  )
}
