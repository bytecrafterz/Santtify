import Link from 'next/link'

/**
 * O ícone PV que o cliente pediu. Leva à página institucional onde empresas
 * interessadas encontram o botão de WhatsApp dele.
 *
 * Aparece em todo o app de propósito: é a vitrine comercial do Produto Vivo
 * dentro do primeiro caso de uso.
 */
export function SeloProdutoVivo({ projectSlug }: { projectSlug: string }) {
  return (
    <footer className="rodape">
      <Link className="selo-pv" href={`/${projectSlug}/produto-vivo`}>
        <b>PV</b> Tecnologia Produto Vivo
      </Link>
    </footer>
  )
}
