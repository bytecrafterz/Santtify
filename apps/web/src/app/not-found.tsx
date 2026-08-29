import { RecuperarDeVersaoAntiga } from '@/components/RecuperarDeVersaoAntiga'
import Link from 'next/link'

export const metadata = { title: 'Página não encontrada' }

/**
 * A página que aparece quando um endereço não existe — e a rede de segurança
 * para quando ele existe e o navegador é que está atrasado.
 *
 * Ele apanhou um 404 no Alfabeto do painel em 29/08, numa rota que existe e
 * responde 200. Conferi as nove rotas do painel, todas abrem. O que aconteceu
 * quase de certeza foi isto: eu publiquei oito versões nesse dia, e quando se
 * publica, os ficheiros da versão anterior deixam de existir. Quem tinha a
 * aplicação aberta e carregou num link nesse instante foi buscar um ficheiro
 * que já não estava lá, e o resultado é este ecrã.
 *
 * O aviso de versão nova já existia e já recarrega a página, mas só quando o
 * service worker assume. Entre a publicação e esse instante há uma janela, e
 * foi nela que ele carregou.
 *
 * Por isso este ecrã tenta recarregar UMA vez antes de se dar por vencido.
 */
export default function NaoEncontrada() {
  return (
    <main className="envoltorio">
      <RecuperarDeVersaoAntiga />
      <h1>Página não encontrada</h1>
      <p className="nota">
        Se você chegou aqui por um link do site, provavelmente uma versão nova acabou de ser
        publicada. Esta página tenta recarregar sozinha uma vez.
      </p>
      <p>
        <Link href="/">Voltar ao início</Link>
      </p>
    </main>
  )
}
