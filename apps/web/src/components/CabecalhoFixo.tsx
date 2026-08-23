'use client'

import Link from 'next/link'

/**
 * A barra preta que fica sempre no topo: Alfabeto à esquerda, Produto Vivo à
 * direita, e ao meio o nome do sítio onde a pessoa está.
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
  avatarUrl,
}: {
  projectSlug: string
  /** O que a pessoa está a ver: "Letra A", "Gerenciar conteúdo"... */
  onde: string
  avatarUrl?: string | null
}) {
  return (
    <header className="cabecalho-fixo">
      <Link className="ir-alfabeto" href={`/${projectSlug}`}>
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

      <span className="onde-estou">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="retrato-topo" src={avatarUrl} alt="" aria-hidden />
        ) : (
          <span className="retrato-topo sem-foto" aria-hidden />
        )}
        <span className="nome-do-lugar">{onde}</span>
      </span>

      <Link className="ir-pv" href={`/${projectSlug}/produto-vivo`}>
        <span className="marca-pv" aria-hidden>
          PV
        </span>
        <span className="rotulo">Produto Vivo</span>
      </Link>
    </header>
  )
}
