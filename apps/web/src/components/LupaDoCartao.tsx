'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LupaContexto } from './ArteEmPdf'

/**
 * O CARTÃO EM GRANDE, COM ZOOM DE DOIS DEDOS.
 *
 * Ele pediu isto em 25/09 e a razão que deu é a certa:
 *
 *   "se eu vou pagar por um arquivo de alta qualidade para impressão A4,
 *    preciso conseguir verificar essa qualidade antes de comprar."
 *
 * Quem compra uma folha para imprimir está a comprar nitidez, e nitidez não se
 * vê num cartão de 350px. Aqui aproxima-se até 8×, que é o suficiente para ler
 * os versículos pequenos e para ver se a fotografia aguenta o tamanho — que é
 * precisamente a dúvida que faz alguém não carregar em pagar.
 *
 * FECHA ONDE ABRIU. O cartão por baixo não muda de dia nem perde o
 * enquadramento: isto é uma folha por cima, e não uma navegação.
 *
 * NÃO É UMA IMAGEM À PARTE. Recebe o mesmo desenho que está na página — arte,
 * fotografia enquadrada e nome — e só o amplia. A arte vem do PDF do designer
 * (ver `ArteEmPdf`), desenhada outra vez a cada zoom.
 *
 * ── 28/09: COMO UM PDF NO TELEFONE ────────────────────────────────────────
 *
 * "Quando eu clico na caixa 1 para ampliar, ela precisa abrir centralizada
 * exatamente na caixa 1, igual acontece quando abro o PDF normalmente no
 * telefone. Hoje ela aumenta e vai para o centro do documento." E: "depois do
 * zoom, não consigo voltar normalmente e fica travando."
 *
 *   - O ZOOM É ONDE SE TOCA. Tudo aproximava à volta do meio da folha, que no
 *     cartão é a moldura vazia da foto: a caixa escolhida saía do ecrã. Agora o
 *     toque duplo leva ao centro o ponto tocado, a pinça aproxima à volta dos
 *     dedos e a roda à volta do rato. Aberta com um toque duplo no cartão, a
 *     lupa abre já nessa caixa.
 *   - SEM TRAVAR. A escala e a posição eram estado do React: cada pixel de
 *     movimento voltava a desenhar o cartão inteiro, com as imagens grandes lá
 *     dentro. Agora os dedos mexem a folha directamente, um desenho por quadro,
 *     e o React só sabe do gesto quando ele assenta. A pinça fora da folha (no
 *     título, nos botões) aproximava a PÁGINA inteira do navegador, e depois
 *     não havia como voltar: a lupa inteira recusa esse gesto.
 *   - VOLTAR É VOLTAR. O botão de voltar do telemóvel fecha a lupa, como fecha
 *     um PDF, em vez de sair do editor. Dois toques quando está ampliada voltam
 *     ao cartão inteiro, com animação e não aos saltos.
 */

/** Até onde se pode aproximar. Oito vezes lê o texto mais pequeno de um A4. */
const MAXIMO = 8
const MINIMO = 1
/** O zoom do toque duplo: uma caixa da arte (um terço da largura) enche o ecrã. */
const ZOOM_DO_TOQUE = 3
/** Dois toques dentro deste tempo, e perto um do outro, são um toque duplo. */
const TOQUE_DUPLO_MS = 320
const ANIMACAO_MS = 260
/** Cada toque em + ou − multiplica ou divide o zoom por isto. */
const PASSO_DOS_BOTOES = 1.6

/** Escala e deslocamento da folha dentro do palco (origem no canto de cima). */
type Vista = { s: number; x: number; y: number }

/** O ponto do cartão onde se tocou, em fracção da largura e da altura. */
export type FocoDaLupa = { fx: number; fy: number }

type Gesto =
  | { tipo: 'arrasto'; px: number; py: number; v: Vista }
  | { tipo: 'pinca'; d: number; mx: number; my: number; v: Vista }

export function LupaDoCartao({
  titulo,
  aoFechar,
  foco = null,
  children,
}: {
  titulo: string
  aoFechar: () => void
  /** Onde abrir já ampliada (o ponto do toque duplo no cartão); nulo abre inteira. */
  foco?: FocoDaLupa | null
  children: React.ReactNode
}) {
  const palco = useRef<HTMLDivElement | null>(null)
  const folha = useRef<HTMLDivElement | null>(null)

  // A vista de AGORA vive fora do React: muda a cada quadro de um gesto.
  const vista = useRef<Vista>({ s: 1, x: 0, y: 0 })
  const quadro = useRef(0)
  const fimDaAnimacao = useRef(0)
  const fimDaRoda = useRef(0)
  const mexendo = useRef(false)
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  const gesto = useRef<Gesto | null>(null)
  const moveu = useRef(false)
  const ultimoToque = useRef<{ t: number; x: number; y: number } | null>(null)

  // O que o ecrã mostra, actualizado só quando um gesto assenta.
  const [escala, definirEscala] = useState(1)
  const [versao, definirVersao] = useState(0)
  const [aMexer, definirAMexer] = useState(false)
  const contexto = useMemo(() => ({ versao, aMexer }), [versao, aMexer])

  const aoFecharAgora = useRef(aoFechar)
  aoFecharAgora.current = aoFechar
  const fechar = useRef<() => void>(() => aoFechar())
  const empurrou = useRef(false)

  /* ── Contas ─────────────────────────────────────────────────────────── */

  function medidas() {
    const p = palco.current
    const f = folha.current
    if (!p || !f) return null
    return {
      pw: p.clientWidth,
      ph: p.clientHeight,
      // Onde a folha está no palco sem zoom (o palco é o `offsetParent`).
      l: f.offsetLeft,
      t: f.offsetTop,
      w: f.offsetWidth,
      h: f.offsetHeight,
    }
  }

  /**
   * A vista possível mais perto da pedida. Maior do que o palco, a folha não
   * deixa ver para lá das bordas; mais pequena, fica ao meio.
   */
  function travar(v: Vista, m = medidas()): Vista {
    if (!m) return v
    const s = Math.min(MAXIMO, Math.max(MINIMO, v.s))
    const eixo = (d: number, tamanho: number, palcoTam: number, origem: number) => {
      const ocupa = tamanho * s
      if (ocupa <= palcoTam) return (palcoTam - ocupa) / 2 - origem
      return Math.min(-origem, Math.max(palcoTam - ocupa - origem, d))
    }
    return { s, x: eixo(v.x, m.w, m.pw, m.l), y: eixo(v.y, m.h, m.ph, m.t) }
  }

  function pintar(v: Vista, animar = false) {
    vista.current = v
    const f = folha.current
    if (!f) return
    f.style.transition = animar ? `transform ${ANIMACAO_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none'
    f.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`
  }

  /** Um desenho por quadro, por muitos eventos que o dedo mande. */
  function pintarNoQuadro(v: Vista) {
    vista.current = v
    if (quadro.current) return
    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0
      pintar(vista.current)
    })
  }

  function comecar() {
    window.clearTimeout(fimDaAnimacao.current)
    if (folha.current) folha.current.style.transition = 'none'
    if (!mexendo.current) {
      mexendo.current = true
      definirAMexer(true)
    }
  }

  function assentar() {
    mexendo.current = false
    definirAMexer(false)
    definirEscala(vista.current.s)
    definirVersao((n) => n + 1)
  }

  function irPara(alvo: Vista) {
    comecar()
    pintar(travar(alvo), true)
    fimDaAnimacao.current = window.setTimeout(() => {
      if (folha.current) folha.current.style.transition = 'none'
      assentar()
    }, ANIMACAO_MS + 40)
  }

  /** Aproxima (ou afasta) para `s`, levando o ponto (x, y) do palco ao centro. */
  function centrar(s: number, x: number, y: number) {
    const m = medidas()
    if (!m) return
    const v = vista.current
    const qx = (x - m.l - v.x) / v.s
    const qy = (y - m.t - v.y) / v.s
    irPara({ s, x: m.pw / 2 - m.l - s * qx, y: m.ph / 2 - m.t - s * qy })
  }

  function inteira() {
    irPara({ s: 1, x: 0, y: 0 })
  }

  /**
   * Um ponto do ecrã em medidas do palco. Com a página ampliada pelo navegador
   * a lupa está encolhida (ver abaixo), e um pixel do ecrã não é um do palco.
   */
  const noPalco = (e: { clientX: number; clientY: number }) => {
    const p = palco.current
    const r = p?.getBoundingClientRect()
    if (!p || !r || !r.width) return { x: 0, y: 0 }
    const f = p.clientWidth / r.width
    return { x: (e.clientX - r.left) * f, y: (e.clientY - r.top) * f }
  }

  /** Com um dedo a mais ou a menos, o gesto recomeça de onde a folha está. */
  function recomecar() {
    const lista = [...dedos.current.values()]
    if (lista.length >= 2) {
      const [a, b] = lista
      gesto.current = {
        tipo: 'pinca',
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        v: { ...vista.current },
      }
      moveu.current = true
    } else if (lista.length === 1) {
      gesto.current = { tipo: 'arrasto', px: lista[0].x, py: lista[0].y, v: { ...vista.current } }
    } else {
      gesto.current = null
    }
  }

  function soltar(id: number, x: number, y: number, eToque: boolean) {
    if (!dedos.current.delete(id)) return
    if (dedos.current.size > 0) {
      recomecar()
      return
    }
    gesto.current = null
    // Largada fora do sítio (encolhida abaixo de 1×, ou puxada para lá da
    // borda): volta ao sítio certo com animação, em vez de ficar ali.
    const v = vista.current
    // Quase inteira é inteira: largada a 1,1×, a folha ficava um nada maior do
    // que o ecrã (bordas cortadas e nada para onde arrastar) e parecia presa.
    const certa = v.s < 1.15 ? travar({ s: 1, x: 0, y: 0 }) : travar(v)
    if (Math.abs(certa.s - v.s) > 0.001 || Math.abs(certa.x - v.x) > 0.5 || Math.abs(certa.y - v.y) > 0.5) {
      irPara(certa)
    } else {
      assentar()
    }

    if (!eToque || moveu.current) {
      ultimoToque.current = null
      return
    }
    /*
      Dois toques seguidos: aproxima centrando o sítio tocado, ou, se já está
      ampliada, volta ao cartão inteiro.

      Contado à mão, porque `onDoubleClick` não chega de forma fiável do Safari
      do iPhone — e é no iPhone que isto mais se usa.
    */
    const agora = { t: performance.now(), x, y }
    const antes = ultimoToque.current
    if (antes && agora.t - antes.t < TOQUE_DUPLO_MS && Math.hypot(agora.x - antes.x, agora.y - antes.y) < 40) {
      ultimoToque.current = null
      if (vista.current.s > 1.5) inteira()
      else centrar(ZOOM_DO_TOQUE, x, y)
    } else {
      ultimoToque.current = agora
    }
  }

  /* ── Abrir, fechar, e o botão de voltar ─────────────────────────────── */

  // A folha começa com a transformação explícita, para a primeira animação
  // ter de onde partir.
  useLayoutEffect(() => {
    pintar({ s: 1, x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current()
    }
    window.addEventListener('keydown', teclas)
    // Enquanto a lupa está aberta, a página por baixo não rola: um gesto que
    // atravessasse levava a pessoa para longe do cartão que está a inspeccionar.
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // O Safari do iPhone aproxima a página com dois dedos mesmo onde isso está
    // desligado por CSS, através deste evento seu.
    const semZoomDaPagina = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', semZoomDaPagina)

    /*
      O VOLTAR DO TELEMÓVEL FECHA A LUPA.

      A lupa deixa uma entrada no histórico, com o mesmo endereço; voltar tira-a
      e fecha a lupa, e o editor fica onde estava. Uma vez só por lupa (o
      `useRef` sobrevive ao duplo arranque do modo estrito do React).
    */
    if (!empurrou.current) {
      empurrou.current = true
      window.history.pushState({ ...(window.history.state ?? {}), lupaDoCartao: true }, '')
    }
    let saiu = false
    const aoVoltar = () => {
      if (saiu) return
      saiu = true
      aoFecharAgora.current()
    }
    window.addEventListener('popstate', aoVoltar)
    fechar.current = () => {
      if (saiu) return
      // Tira-se a entrada da lupa; o `popstate` que isso dá é que fecha.
      if (window.history.state?.lupaDoCartao) window.history.back()
      else aoVoltar()
    }

    return () => {
      window.removeEventListener('keydown', teclas)
      window.removeEventListener('popstate', aoVoltar)
      document.removeEventListener('gesturestart', semZoomDaPagina)
      document.body.style.overflow = antes
      cancelAnimationFrame(quadro.current)
      window.clearTimeout(fimDaAnimacao.current)
      window.clearTimeout(fimDaRoda.current)
    }
  }, [])

  /*
    A LUPA COBRE O QUE SE VÊ, MESMO COM A PÁGINA AMPLIADA.

    "fixed" com "inset: 0" é do tamanho da página, e não do ecrã: com a página
    ampliada pelo Safari (a pinça, ou o zoom automático ao escrever num campo
    pequeno), a lupa ficava maior do que o ecrã, com o lado direito e o ✕ de
    fora — e, com os gestos da página bloqueados aqui dentro, sem maneira de
    sair (29/09). Encaixa-se na área visível e desfaz-se o zoom da página só
    na lupa, para ela se ver ao tamanho de sempre.
  */
  const raiz = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const vv = window.visualViewport
    const el = raiz.current
    if (!vv || !el) return
    const encaixar = () => {
      const s = vv.scale || 1
      if (Math.abs(s - 1) < 0.01 && Math.abs(vv.offsetLeft) < 0.5 && Math.abs(vv.offsetTop) < 0.5) {
        el.style.cssText = ''
        return
      }
      el.style.left = `${vv.offsetLeft}px`
      el.style.top = `${vv.offsetTop}px`
      el.style.right = 'auto'
      el.style.bottom = 'auto'
      el.style.width = `${vv.width * s}px`
      el.style.height = `${vv.height * s}px`
      el.style.transform = `scale(${1 / s})`
      el.style.transformOrigin = '0 0'
    }
    encaixar()
    vv.addEventListener('resize', encaixar)
    vv.addEventListener('scroll', encaixar)
    return () => {
      vv.removeEventListener('resize', encaixar)
      vv.removeEventListener('scroll', encaixar)
    }
  }, [])

  // Aberta com um toque duplo no cartão: vai já ampliada para esse ponto.
  useEffect(() => {
    if (!foco) return
    let tentativas = 0
    let id = 0
    const tentar = () => {
      const f = folha.current
      // O cartão lá dentro mede-se sozinho; espera-se que tenha a altura de um A4.
      if (!f || (f.offsetHeight < f.offsetWidth * 1.3 && tentativas++ < 30)) {
        id = requestAnimationFrame(tentar)
        return
      }
      const m = medidas()
      if (!m) return
      const qx = foco.fx * m.w
      const qy = foco.fy * m.h
      const s = ZOOM_DO_TOQUE
      irPara({ s, x: m.pw / 2 - m.l - s * qx, y: m.ph / 2 - m.t - s * qy })
    }
    id = requestAnimationFrame(tentar)
    return () => cancelAnimationFrame(id)
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
    O rato também aproxima, com a roda (e o trackpad, com dois dedos): metade de
    quem confere isto está num computador. À volta do ponteiro, como o resto.
    Ouvido à mão porque o React regista a roda como passiva, e aí não se pode
    impedir a página de rolar.
  */
  useEffect(() => {
    const el = palco.current
    if (!el) return
    const roda = (ev: WheelEvent) => {
      ev.preventDefault()
      comecar()
      const p = noPalco(ev)
      const v = vista.current
      const s = Math.min(MAXIMO, Math.max(MINIMO, v.s * Math.exp(-ev.deltaY * 0.0022)))
      const m = medidas()
      if (!m) return
      const qx = (p.x - m.l - v.x) / v.s
      const qy = (p.y - m.t - v.y) / v.s
      pintarNoQuadro(travar({ s, x: p.x - m.l - s * qx, y: p.y - m.t - s * qy }, m))
      window.clearTimeout(fimDaRoda.current)
      fimDaRoda.current = window.setTimeout(assentar, 160)
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ampliada = escala > 1.05

  return (
    <LupaContexto.Provider value={contexto}>
      <div
        ref={raiz}
        className="lupa"
        role="dialog"
        aria-modal="true"
        aria-label={`${titulo} — em tamanho grande`}
      >
        <header className="lupa-topo">
          <strong>{titulo}</strong>
          <span className="lupa-escala" aria-live="polite">
            {escala.toFixed(1)}×
          </span>
          <button type="button" className="lupa-fechar" onClick={() => fechar.current()} aria-label="Fechar">
            ✕
          </button>
        </header>

        <div
          ref={palco}
          className="lupa-palco"
          onPointerDown={(ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId)
            if (dedos.current.size === 0) moveu.current = false
            dedos.current.set(ev.pointerId, noPalco(ev))
            comecar()
            recomecar()
          }}
          onPointerMove={(ev) => {
            if (!dedos.current.has(ev.pointerId)) return
            const p = noPalco(ev)
            dedos.current.set(ev.pointerId, p)
            const g = gesto.current
            if (!g) return

            if (g.tipo === 'pinca') {
              const [a, b] = [...dedos.current.values()]
              if (!a || !b) return
              const d = Math.hypot(a.x - b.x, a.y - b.y)
              const mx = (a.x + b.x) / 2
              const my = (a.y + b.y) / 2
              // Um pouco abaixo de 1× deixa-se ir, e volta ao largar: é o que
              // diz "é aqui o fim" sem bater numa parede.
              const s = Math.min(MAXIMO, Math.max(MINIMO * 0.8, (g.v.s * d) / g.d))
              const m = medidas()
              if (!m) return
              // O ponto que estava entre os dedos continua entre os dedos.
              const qx = (g.mx - m.l - g.v.x) / g.v.s
              const qy = (g.my - m.t - g.v.y) / g.v.s
              const livre = { s, x: mx - m.l - s * qx, y: my - m.t - s * qy }
              pintarNoQuadro(s >= MINIMO ? travar(livre, m) : livre)
              return
            }

            if (Math.hypot(p.x - g.px, p.y - g.py) > 8) moveu.current = true
            if (g.v.s <= 1.001) return
            pintarNoQuadro(travar({ s: g.v.s, x: g.v.x + (p.x - g.px), y: g.v.y + (p.y - g.py) }))
          }}
          onPointerUp={(ev) => {
            const p = noPalco(ev)
            soltar(ev.pointerId, p.x, p.y, true)
          }}
          onPointerCancel={(ev) => soltar(ev.pointerId, 0, 0, false)}
        >
          <div ref={folha} className={aMexer ? 'lupa-folha a-mexer' : 'lupa-folha'}>
            {children}
          </div>
        </div>

        <footer className="lupa-fundo">
          <button
            type="button"
            aria-label="Afastar"
            disabled={!ampliada}
            onClick={() => {
              const m = medidas()
              if (!m) return
              const s = vista.current.s / PASSO_DOS_BOTOES
              if (s <= 1.05) inteira()
              else centrar(s, m.pw / 2, m.ph / 2)
            }}
          >
            −
          </button>
          <span>
            {ampliada ? 'Toque duas vezes para ver o cartão inteiro' : 'Toque duas vezes numa caixa para a ampliar'}
          </span>
          <button
            type="button"
            aria-label="Aproximar"
            disabled={escala >= MAXIMO - 0.01}
            onClick={() => {
              const m = medidas()
              if (!m) return
              centrar(Math.min(MAXIMO, vista.current.s * PASSO_DOS_BOTOES), m.pw / 2, m.ph / 2)
            }}
          >
            ＋
          </button>
        </footer>
      </div>
    </LupaContexto.Provider>
  )
}
