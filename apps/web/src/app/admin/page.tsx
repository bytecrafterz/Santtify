import { MeusProjetos } from '@/components/painel/MeusProjetos'

export const metadata = { title: 'Meus Projetos' }

/**
 * A entrada do painel: "Meus Projetos" (03/10).
 *
 * Isto era um redirecionamento para o painel do Jesus Alfabeto, que abria com
 * a lista longa de tudo. Ele pediu o contrário: abrir o painel e ver os
 * projetos, com o botão de criar em cima.
 */
export default function PaginaMeusProjetos() {
  return <MeusProjetos />
}
