'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Bloco } from '@/lib/api'
import { social, type EstadoDaFaixa } from '@/lib/social'
import { rastrear } from '@/lib/track'
import { abreviar } from '@/lib/numeros'
import { useAuth } from './ProvedorDeAuth'
import { PainelDeComentarios } from './PainelDeComentarios'

/**
 * O cartão de uma publicação, segundo o mockup de 20/08.
 *
 * A ordem é dele e resolve um defeito meu: eu tinha posto os indicadores POR
 * CIMA da imagem, em posições fixas. Funcionava com as artes que existiam e
 * partiu-se assim que ele publicou uma imagem de outro formato — os ícones
 * foram parar em cima das caras. Fixar coordenadas sobre uma imagem cujo
 * formato não se controla é uma aposta que se perde na primeira imagem nova.
 *
 * Agora a imagem fica limpa, de lado a lado, e tudo o resto vive por baixo.
 * Serve qualquer proporção sem uma única excepção.
 */

/** Alturas das barras da onda, estáveis para a mesma faixa. */
function ondaDe(id: string, quantas = 42): number[] {
  // Derivadas do id em vez de aleatórias: aleatório mudaria a cada render e a
  // onda tremia sozinha com o áudio parado.
  let semente = 0
  for (let i = 0; i < id.length; i++) semente = (semente * 31 + id.charCodeAt(i)) % 100000
  return Array.from({ length: quantas }, (_, i) => {
    semente = (semente * 1103515245 + 12345) % 2147483648
    const base = (semente / 2147483648) * 0.7 + 0.3
    // Um leve arco ao centro, como têm as ondas verdadeiras.
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

export function CartaoDePublicacao({
  bloco,
  projectId,
  contentId,
  projectSlug,
  titulo,
  descricao,
}: {
  bloco: Bloco
  projectId: string
  contentId: string
  projectSlug: string
  titulo: string
  descricao: string | null
}) {
  const { usuario } = useAuth()
  const audio = useRef<HTMLAudioElement>(null)
  const [tocando, definirTocando] = useState(false)
  const [agora, definirAgora] = useState(0)
  const [total, definirTotal] = useState(0)
  const [expandido, definirExpandido] = useState(false)
  const [comentariosAbertos, definirComentariosAbertos] = useState(false)
  const [aviso, definirAviso] = useState<string | null>(null)
  const [estado, definirEstado] = useState<EstadoDaFaixa>({
    visualizacoes: 0,
    curtidas: 0,
    comentarios: 0,
    compartilhamentos: 0,
    curtidoPorMim: false,
    lista: [],
  })

  const onda = ondaDe(bloco.id)
  const progresso = total > 0 ? agora / total : 0

  useEffect(() => {
    void social.estadoDaFaixa(bloco.id).then(definirEstado).catch(() => {})
  }, [bloco.id])

  function alternar() {
    const el = audio.current
    if (!el) return
    if (el.paused) void el.play().catch(() => definirAviso('Não foi possível tocar agora.'))
    else el.pause()
  }

  async function curtir() {
    if (!usuario) {
      definirAviso('Entre na sua conta para curtir.')
      return
    }
    try {
      const r = await social.curtirFaixa(bloco.id, projectId)
      definirEstado((e) => ({ ...e, curtidoPorMim: r.curtido, curtidas: r.total }))
      definirAviso(null)
    } catch {
      definirAviso('Não foi possível curtir agora.')
    }
  }

  async function partilhar() {
    const url = `${window.location.origin}${window.location.pathname}#faixa-${bloco.id}`
    try {
      if (navigator.share) await navigator.share({ title: titulo, url })
      else {
        await navigator.clipboard?.writeText(url)
        definirAviso('Link copiado.')
      }
    } catch {
      return // cancelar não é partilhar
    }
    try {
      await rastrear({ projectId, type: 'CUSTOM', props: { acao: 'partilhar_faixa', blockId: bloco.id } })
      definirEstado((e) => ({ ...e, compartilhamentos: e.compartilhamentos + 1 }))
    } catch {
      // Falhar a contar não desfaz a partilha.
    }
  }

  const curto = descricao?.trim() ?? ''
  const precisaVerMais = curto.length > 110

  return (
    <article className="cartao-publicacao" id={`faixa-${bloco.id}`}>
      {bloco.label && <span className="chip-categoria">{bloco.label}</span>}

      {/* A imagem fica limpa: nada por cima dela, nunca. */}
      {bloco.arte && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="imagem-publicacao" src={bloco.arte} alt={titulo} />
      )}

      {/* Colado à imagem, sem folga entre os dois. */}
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
              style={{
                height: `${h * 100}%`,
                animationDelay: `${(i % 7) * 0.09}s`,
              }}
            />
          ))}
        </button>

        <span className="tempo">{tempo(total)}</span>

        <a className="menu-player" href={bloco.asset?.url} download aria-label="Baixar áudio">
          ⋮
        </a>

        <audio
          ref={audio}
          preload="metadata"
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
          }}
        >
          <source src={bloco.asset?.url} type={bloco.asset?.mimeType ?? undefined} />
        </audio>
      </div>

      {/* Fora da imagem, grandes e coloridos, com o número em preto por baixo. */}
      <div className="indicadores-publicacao">
        <span className="indicador-grande vista">
          <span className="simbolo" aria-hidden>
            👁
          </span>
          <strong>{abreviar(estado.visualizacoes)}</strong>
        </span>

        <button
          type="button"
          className={estado.curtidoPorMim ? 'indicador-grande coracao activo' : 'indicador-grande coracao'}
          onClick={curtir}
          aria-pressed={estado.curtidoPorMim}
          aria-label="Curtir"
        >
          <span className="simbolo" aria-hidden>
            ♥
          </span>
          <strong>{abreviar(estado.curtidas)}</strong>
        </button>

        <button
          type="button"
          className="indicador-grande balao"
          onClick={() => definirComentariosAbertos(true)}
          aria-label="Comentários"
        >
          <span className="simbolo" aria-hidden>
            💬
          </span>
          <strong>{abreviar(estado.comentarios)}</strong>
        </button>

        <button
          type="button"
          className="indicador-grande seta"
          onClick={partilhar}
          aria-label="Partilhar"
        >
          <span className="simbolo" aria-hidden>
            ➦
          </span>
          <strong>{abreviar(estado.compartilhamentos)}</strong>
        </button>
      </div>

      {aviso && <p className="nota">{aviso}</p>}

      <h3 className="titulo-publicacao">{titulo}</h3>

      {curto && (
        <p className={expandido ? 'descricao-publicacao' : 'descricao-publicacao cortada'}>
          {curto}
        </p>
      )}
      {precisaVerMais && !expandido && (
        <button type="button" className="ver-mais" onClick={() => definirExpandido(true)}>
          ver mais
        </button>
      )}

      <Link className="selo-pv-rodape" href={`/${projectSlug}/produto-vivo`}>
        <span className="marca-pv" aria-hidden>
          PV
        </span>
        Produto Vivo
      </Link>

      {comentariosAbertos && (
        <PainelDeComentarios
          titulo={titulo}
          comentarios={estado.lista}
          usuarioId={usuario?.id ?? null}
          avatarUrl={usuario?.avatarUrl ?? null}
          aoFechar={() => definirComentariosAbertos(false)}
          aoComentar={async (t, parentId) => {
            const novo = await social.comentarNaFaixa(bloco.id, projectId, t, parentId)
            definirEstado((x) => ({ ...x, comentarios: x.comentarios + 1, lista: [novo, ...x.lista] }))
          }}
          aoApagar={async (id) => {
            await social.apagarComentario(id)
            definirEstado((x) => ({
              ...x,
              comentarios: Math.max(0, x.comentarios - 1),
              lista: x.lista.filter((c) => c.id !== id),
            }))
          }}
          aoActualizar={(c) =>
            definirEstado((x) => ({ ...x, lista: x.lista.map((y) => (y.id === c.id ? c : y)) }))
          }
        />
      )}
    </article>
  )
}
