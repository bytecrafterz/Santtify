'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Enquadrar a fotografia antes de a gravar.
 *
 * Ele passou de dez tentativas a refazer a arte no ChatGPT até acertar o corte,
 * e escreveu a conclusão certa em 29/08: "isso não deveria depender de eu ficar
 * refazendo a arte até acertar exatamente o corte". O recorte é do computador,
 * não da pessoa.
 *
 * O RECORTE É FEITO AQUI, NO TELEMÓVEL, e não no servidor. O que sobe já é a
 * imagem enquadrada, na proporção exacta da capa, e é por isso que não foi
 * preciso mexer em nada do lado de lá: o servidor continua a receber uma
 * fotografia e a guardá-la. Também poupa a ligação dele: sobe 1200 de largura
 * em vez dos vários megabytes que uma câmara moderna produz.
 *
 * A MOLDURA TEM A FORMA DA CAPA DO PERFIL, e é a coisa mais importante deste
 * ficheiro. Comecei por fazê-la quadrada, a pensar no avatar redondo, e estava
 * errado: o que se vê no perfil é uma capa larga. Ele enquadrava num quadrado,
 * o perfil recortava outra vez num rectângulo, e o resultado não era o que ele
 * tinha visto. A frase dele é a especificação inteira: "o que eu vejo no editor
 * = o que o público vê no perfil".
 *
 * A proporção não está escrita aqui. Vem de `--proporcao-da-capa`, o mesmo
 * valor que a capa pública usa, lido do CSS. Escrevê-la nos dois sítios era
 * garantir que um dia divergissem, e divergir aqui é o defeito que este ecrã
 * existe para acabar.
 *
 * TRÊS MANEIRAS DE FAZER A MESMA COISA, de propósito: arrastar, dois dedos, e a
 * barra de aproximar. A barra existe porque é a única que se vê. Quem não sabe
 * que pode arrastar descobre pela barra; quem já sabe, arrasta.
 */
/** A largura do ficheiro gravado. A altura sai da proporção da capa. */
const LARGURA = 1200

/** Lê a proporção da capa do CSS: um número só para a mesma coisa. */
function proporcaoDaCapa(): number {
  if (typeof window === 'undefined') return 4 / 3
  const bruto = getComputedStyle(document.documentElement)
    .getPropertyValue('--proporcao-da-capa')
    .trim()
  const [a, b] = bruto.split('/').map((n) => Number(n.trim()))
  return a && b ? a / b : 4 / 3
}

export function AjustarFoto({
  ficheiro,
  aoConfirmar,
  aoCancelar,
}: {
  ficheiro: File
  aoConfirmar: (recortada: File) => void
  aoCancelar: () => void
}) {
  const [origem, definirOrigem] = useState<string | null>(null)
  const [zoom, definirZoom] = useState(1)
  const [pos, definirPos] = useState({ x: 0, y: 0 })
  const [aGravar, definirAGravar] = useState(false)
  const imagem = useRef<HTMLImageElement | null>(null)
  const moldura = useRef<HTMLDivElement | null>(null)
  const arrasto = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const dedos = useRef<Map<number, { x: number; y: number }>>(new Map())
  const distanciaInicial = useRef<number | null>(null)
  const zoomInicial = useRef(1)

  useEffect(() => {
    const url = URL.createObjectURL(ficheiro)
    definirOrigem(url)
    return () => URL.revokeObjectURL(url)
  }, [ficheiro])

  /**
   * O zoom mínimo é o que faz a imagem COBRIR a moldura.
   *
   * Não é 1. Se fosse, uma fotografia mais alta do que larga podia ser
   * afastada até deixar tiras vazias nos lados — precisamente as bordas
   * brancas de que ele se queixou. Assim, por muito que se afaste, a moldura
   * nunca fica a descoberto.
   */
  const [minimo, definirMinimo] = useState(1)

  const aoCarregarImagem = useCallback(() => {
    const img = imagem.current
    const m = moldura.current
    if (!img || !m) return
    const escala = Math.max(m.clientWidth / img.naturalWidth, m.clientHeight / img.naturalHeight)
    definirMinimo(escala)
    definirZoom(escala)
    definirPos({ x: 0, y: 0 })
  }, [])

  /** Impede que o arrasto descubra a moldura, seja qual for o zoom. */
  const limitar = useCallback((p: { x: number; y: number }, z: number) => {
    const img = imagem.current
    const m = moldura.current
    if (!img || !m) return p
    const larg = img.naturalWidth * z
    const alt = img.naturalHeight * z
    const maxX = Math.max(0, (larg - m.clientWidth) / 2)
    const maxY = Math.max(0, (alt - m.clientHeight) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, p.x)),
      y: Math.min(maxY, Math.max(-maxY, p.y)),
    }
  }, [])

  useEffect(() => {
    definirPos((p) => limitar(p, zoom))
  }, [zoom, limitar])

  function aoDescer(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (dedos.current.size === 1) {
      arrasto.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
    } else if (dedos.current.size === 2) {
      const [a, b] = [...dedos.current.values()]
      distanciaInicial.current = Math.hypot(a.x - b.x, a.y - b.y)
      zoomInicial.current = zoom
      arrasto.current = null
    }
  }

  function aoMover(e: React.PointerEvent) {
    if (!dedos.current.has(e.pointerId)) return
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (dedos.current.size >= 2 && distanciaInicial.current) {
      const [a, b] = [...dedos.current.values()]
      const agora = Math.hypot(a.x - b.x, a.y - b.y)
      const z = Math.min(
        minimo * 6,
        Math.max(minimo, (zoomInicial.current * agora) / distanciaInicial.current),
      )
      definirZoom(z)
      return
    }

    const d = arrasto.current
    if (!d) return
    definirPos(limitar({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) }, zoom))
  }

  function aoSubir(e: React.PointerEvent) {
    dedos.current.delete(e.pointerId)
    if (dedos.current.size < 2) distanciaInicial.current = null
    if (dedos.current.size === 0) arrasto.current = null
  }

  /**
   * Desenha o que está dentro da moldura, e só isso.
   *
   * As contas são as mesmas que a moldura usa para mostrar, feitas na escala do
   * ficheiro final. Se fossem outras, a pessoa via uma coisa e gravava outra —
   * que é o defeito que este ecrã existe para acabar.
   */
  async function confirmar() {
    const img = imagem.current
    const m = moldura.current
    if (!img || !m) return
    definirAGravar(true)
    try {
      const fator = LARGURA / m.clientWidth
      const altura = Math.round(LARGURA / proporcaoDaCapa())
      const tela = document.createElement('canvas')
      tela.width = LARGURA
      tela.height = altura
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem canvas')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, LARGURA, altura)

      // As mesmas contas que a moldura usa para mostrar, na escala do ficheiro.
      const larg = img.naturalWidth * zoom * fator
      const alt = img.naturalHeight * zoom * fator
      ctx.drawImage(
        img,
        LARGURA / 2 - larg / 2 + pos.x * fator,
        altura / 2 - alt / 2 + pos.y * fator,
        larg,
        alt,
      )

      const blob = await new Promise<Blob | null>((r) => tela.toBlob(r, 'image/jpeg', 0.9))
      if (!blob) throw new Error('sem imagem')
      aoConfirmar(new File([blob], 'capa-do-perfil.jpg', { type: 'image/jpeg' }))
    } finally {
      definirAGravar(false)
    }
  }

  return (
    <div className="ajustar-foto">
      <p className="nota">
        Isto é exactamente o que vai aparecer no seu perfil. Arraste para mover, use dois dedos ou a
        barra para aproximar.
      </p>

      <div
        ref={moldura}
        className="moldura-foto"
        onPointerDown={aoDescer}
        onPointerMove={aoMover}
        onPointerUp={aoSubir}
        onPointerCancel={aoSubir}
      >
        {origem && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imagem}
            src={origem}
            alt=""
            onLoad={aoCarregarImagem}
            draggable={false}
            style={{
              width: imagem.current ? imagem.current.naturalWidth * zoom : undefined,
              // A altura vai declarada e não deduzida: as contas do recorte
              // usam `naturalHeight * zoom`, e se o CSS decidisse outra altura
              // o que se vê deixava de ser o que se grava.
              height: imagem.current ? imagem.current.naturalHeight * zoom : undefined,
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
            }}
          />
        )}
        {/*
          A FAIXA DE BAIXO É A QUE FICA TAPADA.

          Na página, o nome, a seta e a pega do painel desenham-se por cima do
          fundo da capa. Medi: 35px de 293px, 12%. Sem isto no ecrã, eu teria
          prometido "o que vê é o que sai" e estaria certo a 88% — e os 12% que
          faltavam são precisamente onde a arte dele tem a tira dos selos.

          Não é um recorte: a imagem inteira é gravada e a faixa continua lá.
          É um aviso de que ali por cima passa texto.
        */}
        <span className="faixa-tapada" aria-hidden>
          <span>o painel cobre esta faixa</span>
        </span>
      </div>

      <input
        className="barra-zoom"
        type="range"
        min={minimo}
        max={minimo * 6}
        step={minimo / 100}
        value={zoom}
        onChange={(e) => definirZoom(Number(e.target.value))}
        aria-label="Aproximar ou afastar a fotografia"
      />

      <div className="par-de-botoes">
        <button type="button" className="secundario" onClick={aoCancelar} disabled={aGravar}>
          CANCELAR
        </button>
        <button
          type="button"
          className="botao-acao"
          onClick={() => void confirmar()}
          disabled={aGravar}
        >
          {aGravar ? 'A cortar...' : 'USAR ESTA'}
        </button>
      </div>
    </div>
  )
}
