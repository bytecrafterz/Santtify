'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import {
  assinarPaginas,
  haPaginaAnterior,
  haPaginaAnteriorNoServidor,
  voltarAPaginaAnterior,
} from '@/lib/paginas-visitadas'

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
 *
 * ── E O LINK VAI À PÁGINA ANTERIOR (11/10) ────────────────────────────
 *
 * "Return to Previous Page on every page." Com `href`, o Voltar leva à página
 * de onde se veio, se se veio de alguma nesta visita (ver
 * `paginas-visitadas.ts`), e diz só "Voltar" — "Início" ou o nome do projeto
 * seriam mentira quando a anterior é outra. O `href` fica para quem abriu a
 * página direta, por um link ou um QR Code: aí não há anterior, e vai-se ao
 * sítio de sempre, com o nome de sempre.
 *
 * `fixo` mantém o destino de sempre; `soComAnterior` só mostra o botão quando
 * há para onde voltar — nas páginas de entrada, que não têm "acima".
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
  fixo = false,
  soComAnterior = false,
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
  /** Vai sempre ao `href`, mesmo havendo página anterior. */
  fixo?: boolean
  /** Só aparece quando há página anterior para onde voltar. */
  soComAnterior?: boolean
}) {
  const haAnterior = useSyncExternalStore(assinarPaginas, haPaginaAnterior, haPaginaAnteriorNoServidor)
  const vaiAtras = !aoClicar && !fixo && haAnterior
  if (soComAnterior && !haAnterior) return null
  const texto = vaiAtras && children ? 'Voltar' : children

  const soSeta = !texto
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
      {texto && <span className="rotulo">{texto}</span>}
    </>
  )
  const etiqueta = vaiAtras && soSeta ? 'Voltar à página anterior' : (rotulo ?? (soSeta ? 'Voltar' : undefined))

  if (aoClicar) {
    return (
      <button type="button" className={classe} onClick={aoClicar} aria-label={etiqueta}>
        {dentro}
      </button>
    )
  }

  return (
    <Link
      href={href ?? '/'}
      className={classe}
      aria-label={etiqueta}
      onClick={(ev) => {
        if (fixo) return
        if (voltarAPaginaAnterior()) ev.preventDefault()
      }}
    >
      {dentro}
    </Link>
  )
}
