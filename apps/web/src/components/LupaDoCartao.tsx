'use client'

import { useEffect, useRef, useState } from 'react'

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
 * fotografia enquadrada e nome — e só o amplia. Mostrar aqui outra coisa seria
 * mostrar-lhe uma qualidade que não é a que ele vai receber, que é o oposto do
 * que ele pediu.
 */

/** Até onde se pode aproximar. Oito vezes lê o texto mais pequeno de um A4. */
const MAXIMO = 8
const MINIMO = 1

export function LupaDoCartao({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string
  aoFechar: () => void
  children: React.ReactNode
}) {
  const palco = useRef<HTMLDivElement | null>(null)
  const [escala, definirEscala] = useState(1)
  const [pos, definirPos] = useState({ x: 0, y: 0 })

  // Os dedos e o rato em curso. Em `ref` e não em estado: mudam a cada pixel
  // de movimento, e re-desenhar a folha a cada pixel dava um zoom aos saltos.
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  const inicio = useRef<{ dist: number; escala: number; x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => {
    const fechaComEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', fechaComEsc)
    // Enquanto a lupa está aberta, a página por baixo não rola: um gesto que
    // atravessasse levava a pessoa para longe do cartão que está a inspeccionar.
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', fechaComEsc)
      document.body.style.overflow = antes
    }
  }, [aoFechar])

  /** Impede que a folha seja arrastada para fora do ecrã e não volte. */
  function travar(x: number, y: number, e: number) {
    const caixa = palco.current?.getBoundingClientRect()
    if (!caixa) return { x, y }
    const folgaX = (caixa.width * (e - 1)) / 2
    const folgaY = (caixa.height * (e - 1)) / 2
    return {
      x: Math.min(folgaX, Math.max(-folgaX, x)),
      y: Math.min(folgaY, Math.max(-folgaY, y)),
    }
  }

  const distancia = () => {
    const [a, b] = [...dedos.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  return (
    <div
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
        <button type="button" className="lupa-fechar" onClick={aoFechar} aria-label="Fechar">
          ✕
        </button>
      </header>

      <div
        ref={palco}
        className="lupa-palco"
        onPointerDown={(ev) => {
          dedos.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
          ev.currentTarget.setPointerCapture(ev.pointerId)
          if (dedos.current.size === 2) {
            inicio.current = {
              dist: distancia(),
              escala,
              x: ev.clientX,
              y: ev.clientY,
              px: pos.x,
              py: pos.y,
            }
          } else if (dedos.current.size === 1) {
            inicio.current = { dist: 0, escala, x: ev.clientX, y: ev.clientY, px: pos.x, py: pos.y }
          }
        }}
        onPointerMove={(ev) => {
          if (!dedos.current.has(ev.pointerId) || !inicio.current) return
          dedos.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })

          if (dedos.current.size >= 2) {
            // Dois dedos: a razão entre a distância de agora e a do início dá
            // a escala. É a mesma conta que qualquer galeria de fotografias.
            const agora = distancia()
            if (!inicio.current.dist) return
            const nova = Math.min(
              MAXIMO,
              Math.max(MINIMO, (inicio.current.escala * agora) / inicio.current.dist),
            )
            definirEscala(nova)
            definirPos((p) => travar(p.x, p.y, nova))
            return
          }

          // Um dedo arrasta, mas só quando há para onde arrastar.
          if (escala <= 1) return
          const i = inicio.current
          definirPos(travar(i.px + (ev.clientX - i.x), i.py + (ev.clientY - i.y), escala))
        }}
        onPointerUp={(ev) => {
          dedos.current.delete(ev.pointerId)
          if (dedos.current.size === 0) inicio.current = null
        }}
        onPointerCancel={(ev) => {
          dedos.current.delete(ev.pointerId)
          if (dedos.current.size === 0) inicio.current = null
        }}
        /*
          O rato também aproxima, com a roda: metade de quem confere isto está
          num computador, e um rato não faz pinça.

          A ESCALA NOVA SAI DA ANTERIOR PELA FORMA FUNCIONAL, e não da variável
          `escala`. Uma roda dá dez eventos antes de o React voltar a desenhar, e
          todos liam a mesma escala velha: dez voltas davam UMA volta. Media-se
          1,1× onde deviam estar 3×.

          O mesmo vale para a posição, que tem de ser travada contra a escala
          nova — por isso ela é guardada aqui fora para o segundo `definirPos`.
        */
        onWheel={(ev) => {
          let nova = escala
          definirEscala((actual) => {
            nova = Math.min(MAXIMO, Math.max(MINIMO, actual * (ev.deltaY < 0 ? 1.12 : 0.89)))
            return nova
          })
          definirPos((p) => travar(p.x, p.y, nova))
        }}
        /* Dois toques seguidos: aproxima de vez, ou volta ao princípio. */
        onDoubleClick={() => {
          const nova = escala > 1.2 ? 1 : 3
          definirEscala(nova)
          definirPos(nova === 1 ? { x: 0, y: 0 } : (p) => travar(p.x, p.y, nova))
        }}
      >
        <div
          className="lupa-folha"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`,
            cursor: escala > 1 ? 'grab' : 'default',
          }}
        >
          {children}
        </div>
      </div>

      <footer className="lupa-fundo">
        <button
          type="button"
          aria-label="Afastar"
          disabled={escala <= MINIMO}
          onClick={() => {
            const nova = Math.max(MINIMO, escala - 1)
            definirEscala(nova)
            definirPos(nova === 1 ? { x: 0, y: 0 } : (p) => travar(p.x, p.y, nova))
          }}
        >
          −
        </button>
        <span>Aproxime com dois dedos, ou toque duas vezes</span>
        <button
          type="button"
          aria-label="Aproximar"
          disabled={escala >= MAXIMO}
          onClick={() => {
            const nova = Math.min(MAXIMO, escala + 1)
            definirEscala(nova)
            definirPos((p) => travar(p.x, p.y, nova))
          }}
        >
          ＋
        </button>
      </footer>
    </div>
  )
}
