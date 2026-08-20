'use client'

import { useRef } from 'react'
import type { Bloco } from '@/lib/api'
import { rastrear } from '@/lib/track'
import { CartaoDePublicacao } from './CartaoDePublicacao'

/**
 * Renderiza os blocos que o admin montou no painel.
 *
 * Não existe "bloco da música" nem "bloco da letra": existe AUDIO, TEXT,
 * IMAGE. O rótulo é texto livre que o cliente escreve. É isso que permite o
 * próximo projeto ter uma página com outra composição sem código novo.
 */
export function BlocosDeConteudo({
  blocos,
  projectId,
  contentId,
  projectSlug,
}: {
  blocos: Bloco[]
  projectId: string
  contentId: string
  projectSlug: string
}) {
  if (blocos.length === 0) {
    return (
      <div className="bloco">
        <p className="bloco-vazio">Este conteúdo ainda não foi preenchido.</p>
      </div>
    )
  }

  return (
    <>
      {blocos.map((bloco) => {
        // O audio traz o seu proprio cartao, com moldura e rotulo la dentro.
        // Embrulha-lo outra vez dava duas caixas e a categoria repetida.
        const proprioCartao = bloco.type === 'AUDIO' && Boolean(bloco.asset?.url)
        const corpo = (
          <CorpoDoBloco
            bloco={bloco}
            projectId={projectId}
            contentId={contentId}
            projectSlug={projectSlug}
          />
        )
        return proprioCartao ? (
          <div key={bloco.id}>{corpo}</div>
        ) : (
          <div className="bloco" key={bloco.id}>
            {bloco.label && <span className="bloco-rotulo">{bloco.label}</span>}
            {corpo}
          </div>
        )
      })}
    </>
  )
}

function CorpoDoBloco({
  bloco,
  projectId,
  contentId,
  projectSlug,
}: {
  bloco: Bloco
  projectId: string
  contentId: string
  projectSlug: string
}) {
  switch (bloco.type) {
    case 'TEXT':
    case 'RICH_TEXT':
      return bloco.text ? (
        <p className="bloco-texto">{bloco.text}</p>
      ) : (
        <p className="bloco-vazio">Texto ainda não cadastrado.</p>
      )

    case 'AUDIO':
      return bloco.asset?.url ? (
        <CartaoDePublicacao
          bloco={bloco}
          projectId={projectId}
          contentId={contentId}
          projectSlug={projectSlug}
          titulo={bloco.label ?? 'Faixa'}
          descricao={bloco.text ?? null}
        />
      ) : (
        <p className="bloco-vazio">Áudio ainda não enviado.</p>
      )

    case 'VIDEO':
      return bloco.asset?.url ? (
        <MidiaRastreada
          bloco={bloco}
          projectId={projectId}
          contentId={contentId}
          elemento="video"
        />
      ) : (
        <p className="bloco-vazio">Vídeo ainda não enviado.</p>
      )

    case 'IMAGE':
      return bloco.asset?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bloco.asset.url} alt={bloco.asset.altText ?? bloco.label ?? ''} loading="lazy" />
      ) : (
        <p className="bloco-vazio">Imagem ainda não enviada.</p>
      )

    case 'EMBED':
      return bloco.url ? (
        <iframe
          src={bloco.url}
          title={bloco.label ?? 'Conteúdo incorporado'}
          style={{ width: '100%', aspectRatio: '16/9', border: 0, borderRadius: 10 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          allowFullScreen
        />
      ) : (
        <p className="bloco-vazio">Link ainda não cadastrado.</p>
      )

    case 'LINK':
      return bloco.url ? (
        <a href={bloco.url} target="_blank" rel="noopener noreferrer">
          {bloco.text ?? bloco.url}
        </a>
      ) : (
        <p className="bloco-vazio">Link ainda não cadastrado.</p>
      )

    default:
      return null
  }
}

/**
 * Áudio e vídeo com eventos de reprodução.
 *
 * MEDIA_PLAY e MEDIA_COMPLETE são coletados agora mesmo sem tela que os mostre:
 * "qual conteúdo prende mais" é uma das perguntas da segunda etapa, e ela só
 * pode ser respondida depois se o dado existir desde o começo.
 */
function MidiaRastreada({
  bloco,
  projectId,
  contentId,
  elemento,
}: {
  bloco: Bloco
  projectId: string
  contentId: string
  elemento: 'audio' | 'video'
}) {
  const jaTocou = useRef(false)
  // blockId vai junto porque é por ele que se contam as visualizações de cada
  // faixa. Sem isto, os quatro áudios da letra partilhariam um número só — que
  // é exactamente o que o cliente pediu para deixar de acontecer.
  const props = { bloco: bloco.label ?? bloco.type, assetId: bloco.asset?.id, blockId: bloco.id }

  const aoTocar = () => {
    if (jaTocou.current) return
    jaTocou.current = true
    void rastrear({ projectId, contentId, type: 'MEDIA_PLAY', props })
  }

  const aoTerminar = () => {
    void rastrear({ projectId, contentId, type: 'MEDIA_COMPLETE', props })
  }

  const Tag = elemento
  return (
    <Tag controls preload="metadata" onPlay={aoTocar} onEnded={aoTerminar}>
      <source src={bloco.asset!.url} type={bloco.asset?.mimeType ?? undefined} />
      Seu navegador não consegue reproduzir este arquivo.
    </Tag>
  )
}
