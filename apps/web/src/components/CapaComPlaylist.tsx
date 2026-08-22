'use client'

import type { ItemIndice, Projeto } from '@/lib/api'
import { abreviar } from '@/lib/numeros'
import { OlhoGrande, CoracaoGrande, BalaoGrande, SetaGrande } from './IconesGrandes'

/**
 * A capa do projeto, como um cartão e nada mais.
 *
 * Já teve aqui um botão de tocar ao centro, cinco filtros e a lista das
 * faixas. Saíram todos a pedido dele em 21/08: quer a página feita só de
 * cartões, cada áudio um cartão inteiro, sem estrutura fragmentada por baixo.
 *
 * Os filtros tinham sido pedidos por ele no dia anterior. Ficam mencionados
 * aqui para não voltarem por engano — e para quem ler isto amanhã saber que
 * não foram esquecidos, foram retirados.
 */
export function CapaComPlaylist({
  project,
  contents,
}: {
  project: Projeto
  contents: ItemIndice[]
}) {
  const totais = contents.reduce(
    (acc, c) => ({
      views: acc.views + (c.stats?.views ?? 0),
      likes: acc.likes + (c.stats?.likes ?? 0),
      comments: acc.comments + (c.stats?.comments ?? 0),
      shares: acc.shares + (c.stats?.shares ?? 0),
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  )

  const logo = project.branding?.logoUrl
  const capa =
    (typeof logo === 'string' && logo) || contents.find((c) => c.coverUrl)?.coverUrl || null

  if (!capa) return null

  return (
    <article className="cartao-publicacao">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="imagem-publicacao" src={capa} alt={project.name} />

      <div className="indicadores-publicacao">
        <span className="indicador-grande">
          <span className="simbolo">
            <OlhoGrande />
          </span>
          <strong>{abreviar(totais.views)}</strong>
        </span>
        <span className="indicador-grande">
          <span className="simbolo">
            <CoracaoGrande />
          </span>
          <strong>{abreviar(totais.likes)}</strong>
        </span>
        <span className="indicador-grande">
          <span className="simbolo">
            <BalaoGrande />
          </span>
          <strong>{abreviar(totais.comments)}</strong>
        </span>
        <span className="indicador-grande">
          <span className="simbolo">
            <SetaGrande />
          </span>
          <strong>{abreviar(totais.shares)}</strong>
        </span>
      </div>

      <h3 className="titulo-publicacao">{project.name}</h3>
    </article>
  )
}
