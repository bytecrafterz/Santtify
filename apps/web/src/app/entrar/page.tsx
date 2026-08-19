import { redirect } from 'next/navigation'

/**
 * Atalho de raiz para /entrar.
 *
 * As páginas moram sob /[projectSlug], mas ninguém digita o slug do projeto na
 * barra de endereço — escreve santtify.com/entrar e espera que abra. Sem isto a
 * pessoa recebe um 404 e conclui que o site está partido, que foi exatamente o
 * que aconteceu com o cliente em 19/08.
 */
const PROJETO_PADRAO = process.env.NEXT_PUBLIC_PROJETO_PADRAO ?? 'jesus-alfabeto-saudavel'

export default function Atalho() {
  redirect(`/${PROJETO_PADRAO}/entrar`)
}
