import { ListaDeConversas } from '@/components/MensagensPrivadas'

export const metadata = { title: 'Mensagens' }

const PROJETO_PADRAO = process.env.NEXT_PUBLIC_PROJETO_PADRAO ?? 'jesus-alfabeto-saudavel'

/**
 * As mensagens dentro do painel. São as mesmas conversas da página de
 * mensagens do site — a conta dele é uma só —, aqui com o menu do painel à
 * volta, para a área não o tirar do painel.
 */
export default function PaginaDeMensagensDoPainel() {
  return (
    <main className="envoltorio">
      <ListaDeConversas projectSlug={PROJETO_PADRAO} />
    </main>
  )
}
