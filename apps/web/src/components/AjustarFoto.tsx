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
 * imagem enquadrada, quadrada, e é por isso que não foi preciso mexer em nada do
 * lado de lá: o servidor continua a receber uma fotografia e a guardá-la. Também
 * poupa a ligação dele: sobe 800x800 em vez dos vários megabytes que uma câmara
 * moderna produz.
 *
 * QUADRADO PORQUE O AVATAR É REDONDO. Um círculo desenha-se cortando um
 * quadrado, e uma fonte quadrada nunca dá bordas: seja qual for a proporção da
 * arte que ele gerar, o que sai daqui encaixa.
 *
 * TRÊS MANEIRAS DE FAZER A MESMA COISA, de propósito: arrastar, dois dedos, e a
 * barra de aproximar. A barra existe porque é a única que se vê. Quem não sabe
 * que pode arrastar descobre pela barra; quem já sabe, arrasta.
 */
const LADO = 800

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
    const lado = m.clientWidth
    const escala = Math.max(lado / img.naturalWidth, lado / img.naturalHeight)
    definirMinimo(escala)
    definirZoom(escala)
    definirPos({ x: 0, y: 0 })
  }, [])

  /** Impede que o arrasto descubra a moldura, seja qual for o zoom. */
  const limitar = useCallback((p: { x: number; y: number }, z: number) => {
    const img = imagem.current
    const m = moldura.current
    if (!img || !m) return p
    const lado = m.clientWidth
    const larg = img.naturalWidth * z
    const alt = img.naturalHeight * z
    const maxX = Math.max(0, (larg - lado) / 2)
    const maxY = Math.max(0, (alt - lado) / 2)
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
      const lado = m.clientWidth
      const fator = LADO / lado
      const tela = document.createElement('canvas')
      tela.width = LADO
      tela.height = LADO
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem canvas')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, LADO, LADO)

      const larg = img.naturalWidth * zoom * fator
      const alt = img.naturalHeight * zoom * fator
      ctx.drawImage(
        img,
        LADO / 2 - larg / 2 + pos.x * fator,
        LADO / 2 - alt / 2 + pos.y * fator,
        larg,
        alt,
      )

      const blob = await new Promise<Blob | null>((r) => tela.toBlob(r, 'image/jpeg', 0.9))
      if (!blob) throw new Error('sem imagem')
      aoConfirmar(new File([blob], 'foto-de-perfil.jpg', { type: 'image/jpeg' }))
    } finally {
      definirAGravar(false)
    }
  }

  return (
    <div className="ajustar-foto">
      <p className="nota">Arraste para mover. Use dois dedos ou a barra para aproximar.</p>

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
              transform: `translate(${pos.x}px, ${pos.y}px)`,
            }}
          />
        )}
        {/* O círculo mostra exactamente o que vai ficar no perfil. */}
        <span className="guia-circulo" aria-hidden />
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
