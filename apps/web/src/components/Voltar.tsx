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
 * A SETA DEIXA DE SER UMA LETRA. Estava escrita com o carácter U+2190, e um
 * carácter é desenhado pelo tipo de letra de quem está a ler: fica fino num
 * telemóvel, gordo noutro, e desalinhado do texto em quase todos. Passa a ser
 * um traço desenhado, com a espessura que nós escolhemos, igual em toda a
 * parte.
 *
 * ── LINK OU BOTÃO, CONFORME PARA ONDE SE VAI ──────────────────────────
 *
 * Com `href` é um link: muda de página e o navegador sabe disso. Com `aoClicar`
 * é um `<button>`: são os ecrãs que voltam DENTRO de si próprios — do cartão
 * para os quadrados, dos quadrados para a sequência — onde não há página nova
 * nenhuma e um link seria mentira para quem navega pelo teclado ou ouve a
 * página.
 *
 * Os dois existem porque eu comecei por copiar o desenho à mão nesses ecrãs, e
 * copiá-lo três vezes é como isto tinha sete versões antes.
 *
 * O ALVO TEM 44px DE ALTURA mesmo quando o desenho parece menor. É a medida
 * que a Apple e a Google dão como mínimo para um dedo, e este botão é tocado
 * por mães com uma criança ao colo.
 */
function Seta() {
  return (
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
  )
}

export function Voltar({
  href,
  aoClicar,
  children,
  rotulo,
  emLinha = false,
}: {
  /** Para onde vai, quando muda de página. */
  href?: string
  /** O que faz, quando volta dentro do mesmo ecrã. */
  aoClicar?: () => void
  /** O que se lê ao lado da seta. Sem isto fica só a seta, redonda. */
  children?: React.ReactNode
  /** Para quem ouve a página, quando não há texto visível. */
  rotulo?: string
  /** Dentro de um ecrã, e não no topo: acrescenta a folga de baixo. */
  emLinha?: boolean
}) {
  const soSeta = !children
  const classe = [
    'voltar-elegante',
    soSeta ? 'so-seta' : '',
    emLinha ? 'voltar-em-linha' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const dentro = (
    <>
      <Seta />
      {children && <span className="rotulo">{children}</span>}
    </>
  )
  const etiqueta = rotulo ?? (soSeta ? 'Voltar' : undefined)

  if (aoClicar) {
    return (
      <button type="button" className={classe} onClick={aoClicar} aria-label={etiqueta}>
        {dentro}
      </button>
    )
  }

  return (
    <Link href={href ?? '/'} className={classe} aria-label={etiqueta}>
      {dentro}
    </Link>
  )
}
