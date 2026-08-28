import { ProdutoVivoAdmin } from '@/components/ProdutoVivoAdmin'

export const metadata = { title: 'Produto Vivo' }

/**
 * O Produto Vivo tem página própria no painel desde 28/08.
 *
 * Era uma âncora dentro da Estrutura raiz — `/admin/estrutura#produto-vivo` —
 * e portanto uma parte da página do perfil. Ele pediu a separação, e a razão é
 * simples: a página comercial que as empresas veem não é uma secção do perfil
 * de ninguém.
 */
export default async function PaginaDoProdutoVivo({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio com-cabecalho">
      <ProdutoVivoAdmin projectSlug={projectSlug} />
    </main>
  )
}
