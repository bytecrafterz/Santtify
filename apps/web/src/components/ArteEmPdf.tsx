'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { paginaDoPdf, pixeisPorCanvas } from '@/lib/pdf'

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

/**
 * Fundo transparente, e não o branco do PDF.js. Se alguma coisa não chegar a
 * ser desenhada, vê-se a imagem por baixo, e não um buraco branco.
 */
const SEM_FUNDO = 'rgba(0,0,0,0)'

/** Liberta já a memória de um canvas: o iPhone demora a devolvê-la sozinho. */
function largar(c: HTMLCanvasElement | null) {
  if (!c) return
  c.remove()
  c.width = 0
  c.height = 0
}

/**
 * A ARTE DESENHADA A PARTIR DO PDF, POR CIMA DAS IMAGENS.
 *
 * As imagens continuam por baixo e são o que se vê no primeiro instante; o
 * PDF cobre-as quando fica pronto. Se o PDF não chegar (rede, telemóvel sem
 * suporte), ficam as imagens, e nada se parte.
 *
 *   - NO EDITOR: a folha inteira, à resolução do ecrã. É pequena (um milhão de
 *     pixéis num iPhone) e rápida.
 *   - NA LUPA: só o que está à vista, aos pixéis exactos do ecrã, desenhado
 *     outra vez sempre que um zoom assenta — como um leitor de PDF. É o que
 *     deixa o texto das caixas nítido a 3× ou a 8×.
 *
 * ── 29/09: EM BRANCO, E LENTO, NO IPHONE ─────────────────────────────────
 *
 * No iPhone a lupa aparecia branca, ou demorava 10 segundos a ficar nítida.
 * O Safari tem um tecto para a memória de TODOS os canvas da página, e
 * passado ele os canvas novos saem vazios, sem erro nenhum; e aqui gastava-se
 * muito: a lupa desenhava primeiro a folha INTEIRA ao dobro (6 milhões de
 * pixéis), com uma cópia enquanto trocava, e só depois a parte à vista; e os
 * canvas dos cartões por onde se passava nunca eram largados.
 *
 * Agora a lupa desenha só a parte à vista, cada canvas cabe no orçamento do
 * aparelho (ver `pixeisPorCanvas`), é desenhado já no sítio onde fica, sem
 * cópia, e é largado assim que deixa de servir. O fundo é transparente: se
 * ainda assim alguma coisa falhar, vê-se a imagem, e não branco.
 */
export function ArteEmPdf({ url }: { url: string }) {
  const caixa = useRef<HTMLDivElement | null>(null)
  // Os canvas são criados e trocados à mão, fora do React: trocar o nó é o que
  // evita ter dois do mesmo tamanho em memória ao mesmo tempo.
  const tela = useRef<HTMLCanvasElement | null>(null)
  const lupa = useContext(LupaContexto)
  const naLupa = lupa !== null
  const [largura, definirLargura] = useState(0)
  const [pagina, definirPagina] = useState<PDFPageProxy | null>(null)

  // A largura da folha no ecrã, sem zoom (o zoom da lupa é uma transformação,
  // e as transformações não mudam a medida da caixa).
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const observador = new ResizeObserver(([e]) => definirLargura(Math.round(e.contentRect.width)))
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    let vivo = true
    paginaDoPdf(url)
      .then((p) => vivo && definirPagina(p))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [url])

  // Ao sair (fechar a lupa, trocar de cartão), a memória volta logo.
  useEffect(
    () => () => {
      largar(tela.current)
      tela.current = null
    },
    [],
  )

  const versao = lupa?.versao ?? 0
  const aMexer = lupa?.aMexer ?? false

  useEffect(() => {
    const el = caixa.current
    if (!el || !pagina || !largura || aMexer) return
    const altura = el.offsetHeight
    if (!altura) return

    // A região a desenhar, nas medidas da folha sem zoom.
    let x0 = 0
    let y0 = 0
    let x1 = largura
    let y1 = altura
    // O zoom da lupa (1 fora dela).
    let s = 1
    if (naLupa) {
      const r = el.getBoundingClientRect()
      s = r.width / largura
      const palco = (el.closest('.lupa-palco') ?? document.documentElement).getBoundingClientRect()
      const vx0 = (Math.max(palco.left, r.left) - r.left) / s
      const vx1 = (Math.min(palco.right, r.right) - r.left) / s
      const vy0 = (Math.max(palco.top, r.top) - r.top) / s
      const vy1 = (Math.min(palco.bottom, r.bottom) - r.top) / s
      if (vx1 <= vx0 || vy1 <= vy0) return
      // Uma margem curta: um arrasto pequeno encontra pormenor, e para lá dela
      // vê-se a JPEG de 300 dpi, e não um vazio.
      const mx = (vx1 - vx0) / 16
      const my = (vy1 - vy0) / 16
      x0 = Math.max(0, vx0 - mx)
      x1 = Math.min(largura, vx1 + mx)
      y0 = Math.max(0, vy0 - my)
      y1 = Math.min(altura, vy1 + my)
    }

    /*
      DUAS PASSAGENS NA LUPA, COMO UM LEITOR DE PDF.

      "quando amplio, tenho de esperar 10 segundos, e só então a qualidade
      fica boa" — 29/09. O tempo de desenhar cresce com os pixéis: a 3× num
      iPhone (3 pixéis por ponto) são 2,6 milhões. Primeiro desenha-se a 2
      pixéis por ponto (a nitidez de um ecrã retina, menos de metade do
      trabalho) e mostra-se logo; depois, se o ecrã tiver mais, a passagem
      final troca-a sem se notar.
    */
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const doNavegador = window.visualViewport?.scale ?? 1
    const orcamento = pixeisPorCanvas()
    const area = (x1 - x0) * (y1 - y0)
    const kDe = (densidade: number) => {
      const k = densidade * doNavegador * s
      return area * k * k > orcamento ? Math.sqrt(orcamento / area) : k
    }
    const passagens = [kDe(naLupa ? Math.min(2, dpr) : dpr)]
    if (naLupa && dpr > 2) {
      const final = kDe(dpr)
      if (final > passagens[0] * 1.05) passagens.push(final)
    }

    let vivo = true
    let tarefa: RenderTask | null = null
    const criadas: HTMLCanvasElement[] = []
    const desenhar = (k: number) => {
      const nova = document.createElement('canvas')
      criadas.push(nova)
      nova.className = 'ce-arte-pdf-camada'
      const viewport = pagina.getViewport({ scale: (largura * k) / pagina.getViewport({ scale: 1 }).width })
      nova.width = Math.ceil((x1 - x0) * k)
      nova.height = Math.ceil((y1 - y0) * k)
      /*
        O CONTEXTO É NOSSO, E NÃO DO PDF.JS.

        Com o canvas na mão, o PDF.js cria o contexto sem transparência e
        preso ao processador (`alpha: false`, `willReadFrequently`): o fundo
        transparente saía PRETO e o desenho não usava a placa gráfica. Com o
        nosso, a transparência vale e o navegador acelera como quiser. E um
        iPhone sem memória para mais um canvas devolve aqui `null`: não se
        desenha, e fica a imagem por baixo.
      */
      const contexto = nova.getContext('2d')
      if (!contexto) {
        largar(nova)
        return Promise.resolve()
      }
      tarefa = pagina.render({
        canvas: null,
        canvasContext: contexto,
        viewport,
        transform: [1, 0, 0, 1, -x0 * k, -y0 * k],
        background: SEM_FUNDO,
      })
      return tarefa.promise.then(() => {
        if (!vivo) return
        nova.style.left = `${x0}px`
        nova.style.top = `${y0}px`
        nova.style.width = `${x1 - x0}px`
        nova.style.height = `${y1 - y0}px`
        el.appendChild(nova)
        const velha = tela.current
        tela.current = nova
        if (velha && velha !== nova) largar(velha)
      })
    }
    passagens
      .reduce<Promise<void>>((antes, k) => antes.then(() => (vivo ? desenhar(k) : undefined)), Promise.resolve())
      .catch(() => {})

    return () => {
      vivo = false
      tarefa?.cancel()
      for (const c of criadas) if (c !== tela.current) largar(c)
    }
  }, [pagina, largura, naLupa, versao, aMexer])

  return <div ref={caixa} className="ce-arte-pdf" aria-hidden="true" />
}
