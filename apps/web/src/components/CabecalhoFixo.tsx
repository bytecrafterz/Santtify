'use client'

import Link from 'next/link'

/**
 * A barra preta que fica sempre no topo: Alfabeto à esquerda e o nome do sítio
 * onde a pessoa está.
 *
 * TINHA UMA SAÍDA PARA O PRODUTO VIVO À DIREITA E SAIU EM 27/08. Levava à página
 * pública, e ele estava a trabalhar no painel: "quero sair do dashboard somente
 * quando eu decidir sair". É a mesma queixa da casinha em 25/08, e a mesma
 * resposta: quem está a trabalhar por trás não quer portas para a frente da loja
 * no sítio onde procura as ferramentas.
 *
 * Pedido dele em 23/08, e a razão que deu é a certa: "mesmo estando na Letra P,
 * ele não precisa percorrer todas as letras para retornar". Numa página que é
 * uma composição contínua da A à Z, sair do meio dela sem uma saída fixa
 * significa deslizar para trás durante muito tempo — ou fechar.
 *
 * "Alfabeto" leva ao princípio, onde estão o perfil e a grade. Não é o botão de
 * voltar do navegador: voltar leva a pessoa à página anterior, que pode ser
 * outro site. Isto leva sempre ao mesmo sítio, e é isso que o torna previsível.
 */
export function CabecalhoFixo({
  projectSlug,
  onde,
  voltarPara,
}: {
  projectSlug: string
  /** O que a pessoa está a ver: "Letra A", "Gerenciar conteúdo"... */
  onde: string
  /**
   * Para onde a casinha leva.
   *
   * No painel leva ao PAINEL, e não ao perfil público. Ele apanhou-o em 25/08:
   * estava a trabalhar no painel, tocou na casinha, e saiu para o site — e
   * depois teve de ir procurar outra vez o endereço do painel. Quem está a
   * trabalhar por trás não quer sair pela porta da frente.
   */
  voltarPara?: string
}) {
  return (
    <header className="cabecalho-fixo">
      <Link className="ir-alfabeto" href={voltarPara ?? `/${projectSlug}`}>
        <span className="casa" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.5 9.5V20h13V9.5" />
          </svg>
        </span>
        <span className="rotulo">Alfabeto</span>
      </Link>

      {/*
        Só o nome do sítio, sem o retrato ao lado.

        Havia ali um círculo com a fotografia, e vazio era um círculo cinzento
        que já me deu duas correcções por parecer avaria. Ele mandou-o embora em
        27/08: "deixe somente o texto Estrutura raiz de forma limpa". Tem razão,
        e a razão vale para lá do aspecto: no painel a fotografia dele não
        informa nada, porque só ele lá entra.
      */}
      <span className="onde-estou">
        <span className="nome-do-lugar">{onde}</span>
      </span>
    </header>
  )
}
