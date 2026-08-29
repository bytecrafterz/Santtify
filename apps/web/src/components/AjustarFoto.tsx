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
   * O AFASTAR VAI ATÉ A ARTE CABER INTEIRA, e não até só cobrir a moldura.
   *
   * Fiz primeiro o contrário: o mínimo era o que cobria a moldura, para nunca
   * haver tiras vazias — as bordas brancas de que ele se queixou no ponto 8.
   * Estava a resolver um problema criando outro. Em 29/08 ele disse o que
   * faltava: "preciso também conseguir afastar a foto, para mostrar uma área
   * maior da imagem".
   *
   * Os dois pedidos são legítimos e parecem opostos: quer ver a arte toda, e
   * não quer faixas vazias. A saída não é escolher um deles, é tirar o vazio
   * da equação. Onde a arte não chega, desenha-se a própria arte esborratada
   * por trás — é o que os leitores de música fazem com as capas. Ele afasta
   * quanto quiser, vê tudo, e nunca aparece uma tira branca.
   *
   * E o borrão fica GRAVADO no ficheiro, não é um efeito do ecrã. Tem de
   * ficar: senão o editor mostrava uma coisa e o perfil publicava outra, que é
   * exactamente o que este ecrã existe para acabar.
   */
  const [minimo, definirMinimo] = useState(1)
  /** O que COBRE a moldura. Não é o mínimo; é onde o borrão deixa de aparecer. */
  const [cobrir, definirCobrir] = useState(1)

  const aoCarregarImagem = useCallback(() => {
    const img = imagem.current
    const m = moldura.current
    if (!img || !m) return
    const cobre = Math.max(m.clientWidth / img.naturalWidth, m.clientHeight / img.naturalHeight)
    // `min` e não `max`: é a escala com que a arte INTEIRA cabe na moldura.
    const cabe = Math.min(m.clientWidth / img.naturalWidth, m.clientHeight / img.naturalHeight)
    definirCobrir(cobre)
    definirMinimo(cabe)
    const escala = cobre
    /*
      COMEÇA UM POUCO ACIMA DO MÍNIMO, PARA HAVER FOLGA NOS DOIS SENTIDOS.

      No mínimo exacto a imagem toca os dois lados da moldura num dos eixos, e
      nesse eixo não sobra nada para arrastar. Com uma arte deitada numa moldura
      4:3, o que não sobra é a altura: ele conseguia mover para os lados e não
      conseguia subir nem descer. Disse-o assim em 29/08, e não era um bloqueio
      escrito por mim, era geometria.

      Começar a 1,12 do mínimo dá folga em ambos desde o primeiro instante. O
      mínimo continua a ser o mínimo: quem quiser a arte inteira, sem nada
      cortado nos lados, puxa a barra até ao fim e volta a tê-la.
    */
    definirZoom(escala * 1.12)
    definirPos({ x: 0, y: 0 })
  }, [])

  /** Impede que o arrasto descubra a moldura, seja qual for o zoom. */
  const limitar = useCallback((p: { x: number; y: number }, z: number) => {
    const img = imagem.current
    const m = moldura.current
    if (!img || !m) return p
    const larg = img.naturalWidth * z
    const alt = img.naturalHeight * z
    /*
      Quando a arte é MENOR do que a moldura, o limite deixava de existir e ela
      ficava presa ao centro. Com o borrão por trás já não há razão para isso:
      ele pode encostá-la onde quiser. O limite passa a ser meia moldura, para
      a arte não poder ser empurrada inteiramente para fora do ecrã.
    */
    const maxX = Math.max(m.clientWidth / 2, (larg - m.clientWidth) / 2)
    const maxY = Math.max(m.clientHeight / 2, (alt - m.clientHeight) / 2)
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
        cobrir * 6,
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

      /*
        O FUNDO ESBORRATADO VAI DENTRO DO FICHEIRO.

        Onde a arte não chega, desenha-se a própria arte ampliada e desfocada.
        Fica gravada aqui, e não aplicada por CSS na página, porque o que sobe
        tem de ser exactamente o que ele viu: um efeito só no ecrã voltava a
        separar o editor do resultado.

        `ctx.filter` não existe em navegadores antigos. Aí o desfoque é
        ignorado e sai a mesma arte ampliada sem borrão — menos bonito, e
        continua a não ser uma tira branca, que era o defeito a evitar.
      */
      const escalaFundo = Math.max(LARGURA / img.naturalWidth, altura / img.naturalHeight)
      const lf = img.naturalWidth * escalaFundo * 1.15
      const af = img.naturalHeight * escalaFundo * 1.15
      ctx.save()
      ctx.filter = 'blur(28px) brightness(0.82)'
      ctx.drawImage(img, LARGURA / 2 - lf / 2, altura / 2 - af / 2, lf, af)
      ctx.restore()

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
        {/* O mesmo fundo que vai ficar gravado, para o ecrã não mentir. */}
        {origem && <img className="fundo-borrado" src={origem} alt="" aria-hidden />}

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
        max={cobrir * 6}
        step={minimo / 200}
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
