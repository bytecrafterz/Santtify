'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import type { MosaicoDaArte } from '@/lib/cartoes'
import { LupaContexto } from './ArteEmPdf'

/**
 * A ARTE EM LADRILHOS DESENHADOS NO SERVIDOR — como um mapa.
 *
 * "check again on iphone" — 29/09, com a caixa 1 desfocada a 8×. O iPhone
 * desenhava o PDF do designer no próprio telefone (`ArteEmPdf`), e estas artes
 * são pesadas para isso: 7 a 10 segundos por desenho no motor do Safari. O
 * servidor desenha-as agora uma vez, a 500 e a 1000 dpi, e corta-as em
 * ladrilhos (ver `MosaicoDaArteService` na API).
 *
 * Aqui só se escolhe e se pede: quando um zoom ASSENTA, os ladrilhos que estão
 * à vista, do nível que o zoom pede. Ficam postos nas medidas da folha, dentro
 * da transformação da lupa, e por isso acompanham qualquer gesto sem ser
 * preciso desenhar nada outra vez.
 *
 *   - Enquanto a imagem por baixo chega para o ecrã (`larguraDaBase`), não se
 *     pede nada: a 1× ou 2× a JPEG de 300 dpi já é mais nítida do que o ecrã.
 *   - Cada ladrilho aparece só depois de descodificado, com um esbatido curto,
 *     por cima da imagem — nunca um buraco.
 *   - Ao mudar de nível, os ladrilhos do nível antigo ficam até os novos
 *     estarem todos prontos; os que saem da vista vão-se logo, para a memória
 *     do telefone não crescer com o passeio.
 */
export function ArteEmMosaico({
  mosaico,
  larguraDaBase,
}: {
  mosaico: MosaicoDaArte
  /** Os pixéis de largura que a imagem por baixo já tem. */
  larguraDaBase: number
}) {
  const caixa = useRef<HTMLDivElement | null>(null)
  // Os ladrilhos são postos e tirados à mão, fora do React, pela chave
  // `{dpi}/{coluna}_{linha}`: são dezenas, e mudam a cada gesto.
  const postos = useRef(new Map<string, HTMLImageElement>())
  const lupa = useContext(LupaContexto)
  const naLupa = lupa !== null
  const versao = lupa?.versao ?? 0
  const aMexer = lupa?.aMexer ?? false
  const [largura, definirLargura] = useState(0)

  // A largura da folha no ecrã, sem zoom (ver `ArteEmPdf`).
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const observador = new ResizeObserver(([e]) => definirLargura(Math.round(e.contentRect.width)))
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  // Ao sair, ou com outra arte, a memória volta logo.
  useEffect(() => {
    const mapa = postos.current
    return () => {
      for (const img of mapa.values()) img.remove()
      mapa.clear()
    }
  }, [mosaico])

  useEffect(() => {
    const el = caixa.current
    if (!el || !largura || aMexer) return
    const altura = el.offsetHeight
    if (!altura) return
    const mapa = postos.current

    // A parte à vista, nas medidas da folha sem zoom, e o zoom da lupa.
    let x0 = 0
    let y0 = 0
    let x1 = largura
    let y1 = altura
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
      // Uma margem: um arrasto curto já encontra os ladrilhos à espera.
      const mx = (vx1 - vx0) / 8
      const my = (vy1 - vy0) / 8
      x0 = Math.max(0, vx0 - mx)
      x1 = Math.min(largura, vx1 + mx)
      y0 = Math.max(0, vy0 - my)
      y1 = Math.min(altura, vy1 + my)
    }

    // Os pixéis que o ecrã mostra na largura da folha, com todos os zooms.
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const doNavegador = window.visualViewport?.scale ?? 1
    const precisa = largura * s * dpr * doNavegador
    // O nível mais leve que chega (com 10% de folga, que a olho não se vê), ou
    // o mais pesado que houver.
    const nivel =
      precisa <= larguraDaBase * 1.15
        ? null
        : (mosaico.niveis.find((n) => n.largura >= precisa * 0.9) ??
          mosaico.niveis[mosaico.niveis.length - 1])

    if (!nivel) {
      for (const img of mapa.values()) img.remove()
      mapa.clear()
      return
    }

    const { lado, sobreposicao: ov } = mosaico
    const colunas = Math.ceil(nivel.largura / lado)
    const linhas = Math.ceil(nivel.altura / lado)
    // Pixéis do nível por pixel da folha.
    const f = nivel.largura / largura
    const c0 = Math.max(0, Math.floor((x0 * f) / lado))
    const c1 = Math.min(colunas - 1, Math.floor((x1 * f - 1) / lado))
    const l0 = Math.max(0, Math.floor((y0 * (nivel.altura / altura)) / lado))
    const l1 = Math.min(linhas - 1, Math.floor((y1 * (nivel.altura / altura) - 1) / lado))

    const queridos = new Set<string>()
    const pendentes: Promise<void>[] = []
    for (let l = l0; l <= l1; l++) {
      for (let c = c0; c <= c1; c++) {
        const chave = `${nivel.dpi}/${c}_${l}`
        queridos.add(chave)
        if (mapa.has(chave)) continue
        // O ladrilho traz `ov` pixéis do vizinho de cada lado (menos nas
        // bordas da folha); é posto exactamente por cima deles, e a costura
        // entre dois não deixa passar a imagem de baixo.
        const px0 = Math.max(0, c * lado - ov)
        const px1 = Math.min(nivel.largura, (c + 1) * lado + ov)
        const py0 = Math.max(0, l * lado - ov)
        const py1 = Math.min(nivel.altura, (l + 1) * lado + ov)
        const img = document.createElement('img')
        img.className = 'ce-arte-ladrilho'
        img.alt = ''
        img.draggable = false
        img.decoding = 'async'
        img.style.left = `${(px0 / nivel.largura) * 100}%`
        img.style.top = `${(py0 / nivel.altura) * 100}%`
        img.style.width = `${((px1 - px0) / nivel.largura) * 100}%`
        img.style.height = `${((py1 - py0) / nivel.altura) * 100}%`
        img.src = `${mosaico.url}/${nivel.dpi}/${c}_${l}.jpeg`
        el.appendChild(img)
        mapa.set(chave, img)
        pendentes.push(
          img
            .decode()
            .then(() => img.classList.add('pronto'))
            .catch(() => {}),
        )
      }
    }

    // Do mesmo nível, fora da vista: saem já.
    for (const [chave, img] of mapa) {
      if (!queridos.has(chave) && chave.startsWith(`${nivel.dpi}/`)) {
        img.remove()
        mapa.delete(chave)
      }
    }

    // De outro nível: saem quando os novos estiverem todos à vista.
    let vivo = true
    void Promise.all(pendentes).then(() => {
      if (!vivo) return
      for (const [chave, img] of mapa) {
        if (!queridos.has(chave)) {
          img.remove()
          mapa.delete(chave)
        }
      }
    })
    return () => {
      vivo = false
    }
  }, [mosaico, larguraDaBase, largura, naLupa, versao, aMexer])

  return <div ref={caixa} className="ce-arte-mosaico" aria-hidden="true" />
}
