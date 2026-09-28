'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { MAXIMO_DE_PIXEIS_POR_CANVAS, paginaDoPdf } from '@/lib/pdf'

/**
 * O que a lupa conta aos PDFs que tem dentro. `versao` muda quando um gesto
 * ASSENTA (dedos levantados, animação acabada), e não a cada pixel: é aí, e
 * só aí, que vale a pena desenhar outra vez.
 */
export interface EstadoDaLupa {
  versao: number
  aMexer: boolean
}

export const LupaContexto = createContext<EstadoDaLupa | null>(null)

/** Até este zoom a base chega, porque na lupa ela é desenhada ao dobro. */
const BASE_CHEGA_ATE = 2.05

/**
 * A ARTE DESENHADA A PARTIR DO PDF, POR CIMA DA IMAGEM LEVE.
 *
 * A imagem continua por baixo e é o que se vê no primeiro instante; o PDF
 * cobre-a quando fica pronto. Se o PDF não chegar (rede, telemóvel sem
 * suporte), fica a imagem, e nada se parte.
 *
 * Duas camadas, como um leitor de PDF:
 *   - a BASE: a folha inteira, à resolução do ecrã (na lupa, ao dobro);
 *   - o PORMENOR, só na lupa: depois de cada zoom, a parte que está à vista
 *     desenhada outra vez aos pixéis exactos do ecrã. É ela que deixa o texto
 *     das caixas nítido a 3× ou a 8×, como no PDF original.
 */
export function ArteEmPdf({ url }: { url: string }) {
  const caixa = useRef<HTMLDivElement | null>(null)
  const base = useRef<HTMLCanvasElement | null>(null)
  const detalhe = useRef<HTMLCanvasElement | null>(null)
  const lupa = useContext(LupaContexto)
  const naLupa = lupa !== null
  const [largura, definirLargura] = useState(0)
  const [pronta, definirPronta] = useState(false)

  // A largura da folha no ecrã, sem zoom (o zoom da lupa é uma transformação,
  // e as transformações não mudam a medida da caixa).
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const observador = new ResizeObserver(([e]) => definirLargura(Math.round(e.contentRect.width)))
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  // ── A base ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tela = base.current
    if (!tela || !largura) return
    let vivo = true
    let tarefa: RenderTask | null = null
    paginaDoPdf(url)
      .then((pagina) => {
        if (!vivo) return
        const umPorUm = pagina.getViewport({ scale: 1 })
        const dpr = Math.min(window.devicePixelRatio || 1, 3)
        const pedida = largura * dpr * (naLupa ? 2 : 1)
        const cabe = Math.sqrt((MAXIMO_DE_PIXEIS_POR_CANVAS * umPorUm.width) / umPorUm.height)
        const viewport = pagina.getViewport({ scale: Math.min(pedida, cabe) / umPorUm.width })
        // Desenha-se fora e só depois se troca: redimensionar o canvas à vista
        // apagava-o, e a folha piscava.
        const rascunho = document.createElement('canvas')
        rascunho.width = Math.round(viewport.width)
        rascunho.height = Math.round(viewport.height)
        tarefa = pagina.render({ canvas: rascunho, viewport })
        return tarefa.promise.then(() => {
          if (!vivo) return
          tela.width = rascunho.width
          tela.height = rascunho.height
          tela.getContext('2d')?.drawImage(rascunho, 0, 0)
          rascunho.width = 0
          definirPronta(true)
        })
      })
      .catch(() => {})
    return () => {
      vivo = false
      tarefa?.cancel()
    }
  }, [url, largura, naLupa])

  // ── O pormenor, na lupa, cada vez que um zoom assenta ─────────────────
  const versao = lupa?.versao ?? 0
  const aMexer = lupa?.aMexer ?? false
  useEffect(() => {
    const el = caixa.current
    const tela = detalhe.current
    if (!naLupa || aMexer || !pronta || !el || !tela) return
    const largura = el.offsetWidth
    const altura = el.offsetHeight
    if (!largura || !altura) return
    const r = el.getBoundingClientRect()
    const s = r.width / largura
    if (s <= BASE_CHEGA_ATE) {
      tela.style.display = ''
      return
    }
    // A parte da folha que está à vista, nas medidas da folha sem zoom.
    const palco = (el.closest('.lupa-palco') ?? document.documentElement).getBoundingClientRect()
    const vx0 = (Math.max(palco.left, r.left) - r.left) / s
    const vx1 = (Math.min(palco.right, r.right) - r.left) / s
    const vy0 = (Math.max(palco.top, r.top) - r.top) / s
    const vy1 = (Math.min(palco.bottom, r.bottom) - r.top) / s
    if (vx1 <= vx0 || vy1 <= vy0) return
    // Um quarto a mais de cada lado: um arrasto curto já encontra pormenor.
    const mx = (vx1 - vx0) / 4
    const my = (vy1 - vy0) / 4
    const x0 = Math.max(0, vx0 - mx)
    const x1 = Math.min(largura, vx1 + mx)
    const y0 = Math.max(0, vy0 - my)
    const y1 = Math.min(altura, vy1 + my)
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    let k = s * dpr
    const area = (x1 - x0) * (y1 - y0) * k * k
    if (area > MAXIMO_DE_PIXEIS_POR_CANVAS) k *= Math.sqrt(MAXIMO_DE_PIXEIS_POR_CANVAS / area)

    let vivo = true
    let tarefa: RenderTask | null = null
    paginaDoPdf(url)
      .then((pagina) => {
        if (!vivo) return
        const viewport = pagina.getViewport({ scale: (largura * k) / pagina.getViewport({ scale: 1 }).width })
        const rascunho = document.createElement('canvas')
        rascunho.width = Math.ceil((x1 - x0) * k)
        rascunho.height = Math.ceil((y1 - y0) * k)
        tarefa = pagina.render({
          canvas: rascunho,
          viewport,
          transform: [1, 0, 0, 1, -x0 * k, -y0 * k],
        })
        return tarefa.promise.then(() => {
          if (!vivo) return
          tela.width = rascunho.width
          tela.height = rascunho.height
          tela.getContext('2d')?.drawImage(rascunho, 0, 0)
          rascunho.width = 0
          tela.style.left = `${x0}px`
          tela.style.top = `${y0}px`
          tela.style.width = `${x1 - x0}px`
          tela.style.height = `${y1 - y0}px`
          tela.style.display = 'block'
        })
      })
      .catch(() => {})
    return () => {
      vivo = false
      tarefa?.cancel()
    }
  }, [url, naLupa, versao, aMexer, pronta])

  return (
    <div ref={caixa} className="ce-arte-pdf" aria-hidden="true">
      <canvas ref={base} className="ce-arte-pdf-base" />
      {naLupa && <canvas ref={detalhe} className="ce-arte-pdf-detalhe" />}
    </div>
  )
}
