'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A VOZ DELE, POR BAIXO DO CARTAZ.
 *
 * "Estou fazendo o audio paga colocar abaixo da arte" — 24/09.
 *
 * NÃO é o `TocadorDeOnda`. Aquele pede um `Bloco`, um `projectId` e um
 * `contentId`, e conta visualizações numa publicação: é peça do módulo do
 * conteúdo. Usá-lo aqui era pôr o módulo dos dias a servir o módulo dos
 * cartões, que foi exactamente a queixa dele de 23/09. Este toca um endereço e
 * mais nada.
 *
 * Um só de cada vez também não é problema aqui: há um áudio por categoria, e a
 * página do projeto mostra um ou dois.
 */
export function VozDaOferta({ src, titulo }: { src: string; titulo: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [tocando, definirTocando] = useState(false)
  const [decorrido, definirDecorrido] = useState(0)
  const [total, definirTotal] = useState(0)

  useEffect(() => {
    const a = audio.current
    if (!a) return
    const andar = () => definirDecorrido(a.currentTime)
    const medir = () => definirTotal(Number.isFinite(a.duration) ? a.duration : 0)
    const parar = () => definirTocando(false)
    a.addEventListener('timeupdate', andar)
    a.addEventListener('loadedmetadata', medir)
    a.addEventListener('ended', parar)
    a.addEventListener('pause', parar)
    a.addEventListener('play', () => definirTocando(true))
    return () => {
      a.removeEventListener('timeupdate', andar)
      a.removeEventListener('loadedmetadata', medir)
      a.removeEventListener('ended', parar)
      a.removeEventListener('pause', parar)
    }
  }, [])

  const relogio = (s: number) => {
    const m = Math.floor(s / 60)
    const r = Math.floor(s % 60)
    return `${m}:${String(r).padStart(2, '0')}`
  }

  return (
    <div className="voz-oferta">
      {/* `metadata` e não `none`: são megabytes e ninguém os deve descarregar sem
          pedir, mas com `none` a barra dizia "0:00" sozinho até alguém tocar —
          parecia um tocador avariado. `metadata` traz a duração e mais nada. */}
      <audio ref={audio} src={src} preload="metadata" />

      <button
        type="button"
        className="voz-oferta-botao"
        aria-label={tocando ? `Pausar — ${titulo}` : `Ouvir — ${titulo}`}
        onClick={() => {
          const a = audio.current
          if (!a) return
          if (a.paused) void a.play()
          else a.pause()
        }}
      >
        <span aria-hidden="true">{tocando ? '❚❚' : '▶'}</span>
      </button>

      <div className="voz-oferta-corpo">
        <strong>{titulo}</strong>
        <input
          className="voz-oferta-barra"
          type="range"
          min={0}
          max={total || 0}
          step={0.1}
          value={decorrido}
          aria-label="Avançar no áudio"
          disabled={!total}
          onChange={(e) => {
            const a = audio.current
            if (!a) return
            a.currentTime = Number(e.target.value)
            definirDecorrido(a.currentTime)
          }}
        />
        <small>
          {relogio(decorrido)}
          {total > 0 && ` / ${relogio(total)}`}
        </small>
      </div>
    </div>
  )
}
