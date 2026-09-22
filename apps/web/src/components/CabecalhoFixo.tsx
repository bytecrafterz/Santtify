'use client'

import { Voltar } from './Voltar'

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
  rotuloDeVolta = 'Voltar',
}: {
  projectSlug: string
  /** O que a pessoa está a ver: "Letra A", "Gerenciar conteúdo"... */
  onde: string
  /** O que se lê ao lado da seta. "Voltar" serve em todo o lado. */
  rotuloDeVolta?: string
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
      {/*
        DIZIA "ALFABETO" E QUASE NUNCA IA AO ALFABETO.

        O rótulo estava escrito no código e o destino vinha de fora: no painel,
        `voltarPara` é `/${projectSlug}/admin`. Ou seja, a casinha dizia
        "Alfabeto" e abria o painel. E num projeto de sete dias dizia o nome de
        outro projeto, que é o mesmo defeito que a barra de baixo tinha.

        "Voltar" é verdade nos dois casos — vai sempre um nível acima de onde a
        pessoa está — e quem quiser dizer outra coisa passa `rotuloDeVolta`.
      */}
      <Voltar href={voltarPara ?? `/${projectSlug}`}>{rotuloDeVolta}</Voltar>

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
