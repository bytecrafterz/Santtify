'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { karaoke, PrecisaDeConta, type KaraokeParaTocar } from '@/lib/karaoke'
import { rastrear } from '@/lib/track'
import { PalcoDoKaraoke } from './PalcoDoKaraoke'
import { fonteDoKaraoke } from '@/app/fontes/karaoke'

function tempo(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * O relógio do karaokê: o tempo do áudio, lido a cada fotograma.
 *
 * O `timeupdate` do navegador chega umas quatro vezes por segundo, e isso vê-se:
 * o destaque saltava de palavra com atraso nas palavras curtas. Lê-se
 * `currentTime` com `requestAnimationFrame` enquanto toca, mas só se redesenha
 * de 40 em 40 ms — mais do que isso não se vê, e poupa a bateria.
 */
function useTempoDoAudio(audio: React.RefObject<HTMLAudioElement | null>, tocando: boolean) {
  const [tempoMs, definirTempoMs] = useState(0)
  useEffect(() => {
    const el = audio.current
    if (!el) return
    const ler = () => definirTempoMs(Math.floor((el.currentTime * 1000) / 40) * 40)
    if (!tocando) {
      ler()
      return
    }
    let pedido = 0
    const ciclo = () => {
      ler()
      pedido = requestAnimationFrame(ciclo)
    }
    pedido = requestAnimationFrame(ciclo)
    return () => cancelAnimationFrame(pedido)
  }, [audio, tocando])
  return [tempoMs, definirTempoMs] as const
}

export function KaraokeDaFaixa({ projectSlug, blocoId }: { projectSlug: string; blocoId: string }) {
  const [dados, definirDados] = useState<KaraokeParaTocar | null>(null)
  const [erro, definirErro] = useState<'conta' | 'nao-existe' | 'rede' | null>(null)
  const [tocando, definirTocando] = useState(false)
  const [duracaoMs, definirDuracaoMs] = useState(0)
  const [acabou, definirAcabou] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const [tempoMs, definirTempoMs] = useTempoDoAudio(audio, tocando)
  const contouPlay = useRef(false)

  useEffect(() => {
    let vivo = true
    karaoke
      .paraTocar(projectSlug, blocoId)
      .then((d) => {
        if (!vivo) return
        definirDados(d)
        if (d.faixa.duracaoMs) definirDuracaoMs(d.faixa.duracaoMs)
      })
      .catch((e) => {
        if (!vivo) return
        if (e instanceof PrecisaDeConta) definirErro('conta')
        else if ((e as { status?: number })?.status === 404) definirErro('nao-existe')
        else definirErro('rede')
      })
    return () => {
      vivo = false
    }
  }, [projectSlug, blocoId])

  /*
    SAIR DO KARAOKÊ É VOLTAR À FAIXA, e não ao princípio da letra.

    Ele descreveu-o em 21/09: "estou na Letra D, desço até Carta de Amor de
    Deus, entro no karaokê, e quando volto o sistema leva-me outra vez para o
    primeiro áudio da Letra D". A página da letra já dá a cada publicação a
    sua âncora (`cartao-<id>`) — faltava o caminho de volta trazê-la.
  */
  const voltar = dados
    ? `/${projectSlug}/${dados.conteudo.slug}#cartao-${blocoId}`
    : `/${projectSlug}`

  if (erro) {
    return (
      <main className={`karaoke karaoke-aviso ${fonteDoKaraoke.variable}`}>
        <div className="karaoke-fundo" />
        <div className="karaoke-caixa">
          {erro === 'conta' ? (
            <>
              <p className="karaoke-caixa-titulo">Entre para cantar</p>
              <p>O Modo Karaokê é para quem tem conta na Santtify.</p>
              <Link
                className="botao-acao"
                href={`/${projectSlug}/entrar?voltar=${encodeURIComponent(`/${projectSlug}/karaoke/${blocoId}`)}`}
              >
                Entrar
              </Link>
            </>
          ) : erro === 'nao-existe' ? (
            <>
              <p className="karaoke-caixa-titulo">Karaokê indisponível</p>
              <p>Esta música ainda não tem karaokê.</p>
            </>
          ) : (
            <>
              <p className="karaoke-caixa-titulo">Sem ligação</p>
              <p>Não foi possível carregar o karaokê. Tente outra vez.</p>
              <button type="button" className="botao-acao" onClick={() => window.location.reload()}>
                Tentar outra vez
              </button>
            </>
          )}
          <Link className="karaoke-sair" href={`/${projectSlug}`}>
            Voltar
          </Link>
        </div>
      </main>
    )
  }

  if (!dados) {
    return (
      <main className={`karaoke ${fonteDoKaraoke.variable}`}>
        <div className="karaoke-fundo" />
        <p className="karaoke-a-carregar">A preparar o karaokê…</p>
      </main>
    )
  }

  const tocarOuPausar = () => {
    const el = audio.current
    if (!el) return
    if (el.paused) {
      if (acabou) {
        el.currentTime = 0
        definirAcabou(false)
      }
      void el.play().catch(() => definirTocando(false))
    } else {
      el.pause()
    }
  }

  const progresso = duracaoMs > 0 ? Math.min(1, tempoMs / duracaoMs) : 0

  return (
    <main className={`karaoke ${fonteDoKaraoke.variable}`}>
      {/* A arte da faixa, desfocada, dá a cada música a sua cor de fundo. A
          URL é da própria faixa, e por isso vai no estilo e não no CSS. */}
      <div
        className="karaoke-fundo"
        style={dados.faixa.arte ? { backgroundImage: `url("${dados.faixa.arte}")` } : undefined}
      />

      <header className="karaoke-topo">
        <Link className="karaoke-sair" href={voltar} aria-label="Sair do karaokê">
          ✕
        </Link>
        <div>
          <p className="karaoke-marca">Modo Karaokê</p>
          <p className="karaoke-titulo">{dados.faixa.titulo}</p>
        </div>
      </header>

      <PalcoDoKaraoke
        frases={dados.frases}
        destaques={dados.destaques}
        tempoMs={tempoMs}
        titulo={dados.faixa.titulo}
      />

      {/*
        SEM BARRINHAS. Pedido expresso dele: neste modo a letra é o elemento
        em movimento. Fica só o essencial para tocar e saber onde se vai.
      */}
      <footer className="karaoke-controlos">
        <button
          type="button"
          className={`karaoke-play${tocando ? ' a-tocar' : ''}`}
          onClick={tocarOuPausar}
          aria-label={tocando ? 'Pausar' : acabou ? 'Cantar outra vez' : 'Tocar'}
        >
          {tocando ? '❚❚' : acabou ? '↻' : '▶'}
        </button>
        <div className="karaoke-linha-do-tempo">
          <input
            type="range"
            min={0}
            max={Math.max(1, duracaoMs)}
            step={100}
            value={Math.min(tempoMs, duracaoMs)}
            aria-label="Posição na música"
            style={{ '--k-progresso': `${progresso * 100}%` } as React.CSSProperties}
            onChange={(e) => {
              const el = audio.current
              if (!el) return
              el.currentTime = Number(e.target.value) / 1000
              definirTempoMs(Number(e.target.value))
              definirAcabou(false)
            }}
          />
          <span className="karaoke-tempos">
            <span>{tempo(tempoMs)}</span>
            <span>{tempo(duracaoMs)}</span>
          </span>
        </div>
      </footer>

      <audio
        ref={audio}
        src={dados.faixa.audio}
        preload="auto"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d)) definirDuracaoMs(Math.round(d * 1000))
        }}
        onPlay={() => {
          definirTocando(true)
          // Tocar no karaokê é ouvir a faixa: conta nas métricas dela, uma vez
          // por visita, com a marca de onde veio.
          if (!contouPlay.current) {
            contouPlay.current = true
            void rastrear({
              projectId: dados.projeto.id,
              contentId: dados.conteudo.id,
              type: 'MEDIA_PLAY',
              props: { blockId: dados.faixa.id, modo: 'karaoke' },
            })
          }
        }}
        onPause={() => definirTocando(false)}
        onEnded={() => {
          definirTocando(false)
          definirAcabou(true)
          contouPlay.current = false
          void rastrear({
            projectId: dados.projeto.id,
            contentId: dados.conteudo.id,
            type: 'MEDIA_COMPLETE',
            props: { blockId: dados.faixa.id, modo: 'karaoke' },
          })
        }}
      />
    </main>
  )
}
