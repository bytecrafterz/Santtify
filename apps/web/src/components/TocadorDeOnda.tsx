'use client'

import { useRef, useState } from 'react'
import type { Bloco } from '@/lib/api'
import { rastrear } from '@/lib/track'

/**
 * O tocador escuro com a onda, colado à imagem de cima.
 *
 * Saiu do cartão para viver sozinho porque uma publicação pode ter mais do que
 * um áudio — a Introdução tem a oração e a memorização — e todos têm de caber
 * dentro do mesmo cartão, um por baixo do outro.
 *
 * As alturas das barras vêm do id da faixa e não de aleatório: com aleatório a
 * onda mudava a cada redesenho e parecia tremer com o áudio parado.
 *
 * A onda NÃO é a onda real do ficheiro. Desenhá-la a sério obrigava a
 * descarregar e descodificar o áudio inteiro antes de tocar, e isso gasta os
 * dados de quem está a ouvir e atrasa o play.
 */
function ondaDe(id: string, quantas = 42): number[] {
  let semente = 0
  for (let i = 0; i < id.length; i++) semente = (semente * 31 + id.charCodeAt(i)) % 100000
  return Array.from({ length: quantas }, (_, i) => {
    semente = (semente * 1103515245 + 12345) % 2147483648
    const base = (semente / 2147483648) * 0.7 + 0.3
    const arco = 1 - Math.abs(i - quantas / 2) / (quantas * 1.6)
    return Math.max(0.18, base * arco)
  })
}

function tempo(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '00:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/**
 * As categorias vinham escritas aqui, à mão, e era esse o defeito.
 *
 * Ele criou "Música Alegre" no painel e perguntou-me porque não aparecia no
 * filtro. Não aparecia porque este ficheiro tinha cinco nomes fixos e nunca
 * olhou para as categorias do projecto. Ele assumiu um comportamento que eu
 * nunca construí, e a pergunta ficou sem resposta enquanto eu corria atrás de
 * outras coisas.
 *
 * Agora a lista vem de quem usa o tocador, que a foi buscar ao projecto.
 * "TODOS" continua a ser nosso: não é uma categoria, é a ausência de filtro.
 */
const TODOS = 'TODOS'

export function TocadorDeOnda({
  bloco,
  projectId,
  contentId,
  rotulo,
  aoTerminar,
  categoria,
  categorias = [],
  aoEscolherCategoria,
}: {
  bloco: Bloco
  projectId: string
  contentId: string
  /** Só quando a publicação tem mais de um áudio: aí é preciso distingui-los. */
  rotulo: string | null
  aoTerminar?: () => void
  /** A categoria escolhida, quando quem usa o tocador quer filtrar. */
  categoria?: string | null
  /** As categorias do projeto, tal como ele as criou no painel. */
  categorias?: Array<{ slug: string; name: string }>
  aoEscolherCategoria?: (categoria: string | null) => void
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [tocando, definirTocando] = useState(false)
  const [menuAberto, definirMenuAberto] = useState(false)
  const [agora, definirAgora] = useState(0)
  const [total, definirTotal] = useState(0)

  const onda = ondaDe(bloco.id)
  const progresso = total > 0 ? agora / total : 0

  function alternar() {
    const el = audio.current
    if (!el) return
    if (el.paused) void el.play().catch(() => {})
    else el.pause()
  }

  return (
    <>
      {rotulo && <span className="rotulo-faixa">{rotulo}</span>}

      <div className={tocando ? 'player-onda a-tocar' : 'player-onda'}>
        <button
          type="button"
          className="botao-play"
          onClick={alternar}
          aria-label={tocando ? 'Pausar' : 'Tocar'}
        >
          {tocando ? '❚❚' : '▶'}
        </button>

        <span className="tempo">{tempo(agora)}</span>

        <button
          type="button"
          className="onda"
          aria-label="Avançar no áudio"
          onClick={(e) => {
            const el = audio.current
            if (!el || !total) return
            const caixa = e.currentTarget.getBoundingClientRect()
            el.currentTime = ((e.clientX - caixa.left) / caixa.width) * total
          }}
        >
          {onda.map((h, i) => (
            <span
              key={i}
              className={i / onda.length <= progresso ? 'barra ouvida' : 'barra'}
              style={{ height: `${h * 100}%`, animationDelay: `${(i % 7) * 0.09}s` }}
            />
          ))}
        </button>

        <span className="tempo">{tempo(total)}</span>

        {/* OS TRÊS PONTOS DEIXAM DE DESCARREGAR O FICHEIRO.
            Isto era um link com `download`, e num iPhone o Safari respondia
            com a sua própria caixa a perguntar se queria guardar o MP3 —
            oferecendo o áudio dele a quem tocasse por curiosidade. Ele
            fotografou-a em 24/08 e tem razão: o tocador é para ouvir aqui.
            Fica um botão nosso, que abre o menu das categorias. */}
        <button
          type="button"
          className="menu-player"
          aria-label="Escolher categoria"
          aria-expanded={menuAberto}
          onClick={(ev) => {
            ev.stopPropagation()
            definirMenuAberto((v) => !v)
          }}
        >
          ⋮
        </button>

        {menuAberto && (
          <div className="menu-categorias" role="menu">
            {[TODOS, ...categorias.map((c) => c.name.toUpperCase())].map((c) => (
              <button
                key={c}
                type="button"
                className={categoria === c ? 'activa' : undefined}
                onClick={(ev) => {
                  ev.stopPropagation()
                  definirMenuAberto(false)
                  aoEscolherCategoria?.(c === TODOS ? null : c)
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <audio
          ref={audio}
          preload="metadata"
          // O menu nativo do navegador também oferece "descarregar". Isto
          // tira-lhe essa entrada; não é uma tranca — nada impede alguém de
          // ir buscar o endereço — mas deixa de estar à mão de quem só quer
          // ouvir, que é o que ele pediu.
          controlsList="nodownload"
          onContextMenu={(ev) => ev.preventDefault()}
          onLoadedMetadata={(e) => definirTotal(e.currentTarget.duration)}
          onTimeUpdate={(e) => definirAgora(e.currentTarget.currentTime)}
          onPlay={() => {
            definirTocando(true)
            void rastrear({
              projectId,
              contentId,
              type: 'MEDIA_PLAY',
              props: { bloco: bloco.label, blockId: bloco.id },
            })
          }}
          onPause={() => definirTocando(false)}
          onEnded={() => {
            definirTocando(false)
            void rastrear({
              projectId,
              contentId,
              type: 'MEDIA_COMPLETE',
              props: { bloco: bloco.label, blockId: bloco.id },
            })
            aoTerminar?.()
          }}
        >
          <source src={bloco.asset?.url} type={bloco.asset?.mimeType ?? undefined} />
        </audio>
      </div>
    </>
  )
}
