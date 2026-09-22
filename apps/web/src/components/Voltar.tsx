import Link from 'next/link'

/**
 * O BOTÃO DE VOLTAR, UM SÓ EM TODA A PLATAFORMA.
 *
 * Havia sete maneiras diferentes de voltar: `.cabecalho a`, `.voltar`,
 * `.ir-alfabeto`, `.voltar-sequencia`, `.voltar-do-editor`, e dois links soltos
 * sem classe nenhuma. Cada um com o seu tamanho, a sua cor e o seu peso. Numa
 * plataforma que se vende como produto, a saída de cada ecrã ser diferente da
 * do ecrã anterior é das coisas que mais depressa a fazem parecer montada à
 * pressa.
 *
 * A SETA DEIXA DE SER UMA LETRA. Estava escrita "←" — o carácter U+2190 — e um
 * carácter é desenhado pelo tipo de letra de quem está a ler: fica fino num
 * telemóvel, gordo noutro, e desalinhado do texto em quase todos. Passa a ser
 * um traço desenhado, com a espessura que nós escolhemos, igual em toda a
 * parte.
 *
 * O ALVO TEM 44px DE ALTURA mesmo quando o desenho parece menor. É a medida
 * que a Apple e a Google dão como mínimo para um dedo, e este botão é tocado
 * por mães com uma criança ao colo.
 */
export function Voltar({
  href,
  children,
  rotulo,
}: {
  href: string
  /** O que se lê ao lado da seta. Sem isto fica só a seta, redonda. */
  children?: React.ReactNode
  /** Para quem ouve a página, quando não há texto visível. */
  rotulo?: string
}) {
  const soSeta = !children

  return (
    <Link
      href={href}
      className={soSeta ? 'voltar-elegante so-seta' : 'voltar-elegante'}
      aria-label={rotulo ?? (soSeta ? 'Voltar' : undefined)}
    >
      <span className="seta" aria-hidden>
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 5.5 8 12l6.5 6.5" />
        </svg>
      </span>
      {children && <span className="rotulo">{children}</span>}
    </Link>
  )
}
