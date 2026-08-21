'use client'

import { useState } from 'react'
import type { CategoriaDeAudio, Faixa, ItemIndice, Projeto } from '@/lib/api'
import { abreviar, plural } from '@/lib/numeros'
import { OlhoGrande, CoracaoGrande, BalaoGrande, SetaGrande } from './IconesGrandes'
import { Playlist } from './Playlist'

/**
 * A capa do projeto e o que ela toca, sem sair da página.
 *
 * Antes, o play da capa e os cinco filtros levavam a pessoa à página da
 * playlist. Era exactamente o que o cliente proibiu em 20/08: o utilizador
 * entra no perfil e fica lá.
 *
 * Os filtros vivem aqui, e não dentro da playlist, porque são a mesma decisão
 * que o play: "o que é que eu quero ouvir". Tê-los em dois sítios a dizer o
 * mesmo é como se perde a confiança numa tela.
 *
 * Trocar de filtro remonta a playlist de propósito (é o que a `key` faz). A
 * numeração das faixas muda com o filtro, e continuar no índice antigo cairia
 * numa faixa qualquer — a pessoa escolhe "só orações" e ouve uma explicação.
 */
export function CapaComPlaylist({
  projectSlug,
  project,
  contents,
  categorias,
  faixas,
}: {
  projectSlug: string
  project: Projeto
  contents: ItemIndice[]
  categorias: CategoriaDeAudio[]
  faixas: Faixa[]
}) {
  const [filtro, definirFiltro] = useState<string | null>(null)
  const [aberta, definirAberta] = useState(false)

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

  function escolherFiltro(novo: string | null) {
    definirFiltro(novo)
    definirAberta(true)
  }

  return (
    <>
      <div className="card-capa sangria">
        

        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="capa" src={capa} alt={project.name} />
        ) : (
          <div className="capa capa-vazia">
            <span>Adicione aqui a capa, imagem ou vídeo</span>
          </div>
        )}

        <button
          type="button"
          className="botao-tocar-capa"
          aria-label={aberta ? 'Fechar o tocador' : 'Ouvir todas as músicas'}
          onClick={() => definirAberta((v) => !v)}
        >
          {aberta ? '❚❚' : '▶'}
        </button>

        
      </div>

      {/* Nada por cima da capa: imagem limpa, e os quatro indicadores
          organizados por baixo, como nos cartões que ele aprovou. */}
      <div className="indicadores-publicacao">
        <span className="indicador-grande">
          <span className="simbolo">
            <OlhoGrande />
          </span>
          <strong>{abreviar(totais.views)}</strong>
        </span>
        <span className="indicador-grande">
          <span className="simbolo">
            <CoracaoGrande cheio />
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

      <div className="filtros-linha" role="group" aria-label="O que ouvir">
        <button
          type="button"
          className={filtro === null && aberta ? 'filtro-link destaque' : 'filtro-link'}
          onClick={() => escolherFiltro(null)}
        >
          ▶ Ouvir tudo
        </button>
        {categorias.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={filtro === c.slug ? 'filtro-link destaque' : 'filtro-link'}
            onClick={() => escolherFiltro(c.slug)}
          >
            Só {plural(c.nome).toLocaleLowerCase('pt')}
          </button>
        ))}
      </div>

      {aberta && faixas.length > 0 && (
        <div className="tocador-embutido">
          <Playlist
            key={filtro ?? 'tudo'}
            projectId={project.id}
            projectSlug={projectSlug}
            categorias={categorias}
            faixas={faixas}
            filtroInicial={filtro}
            mostrarFiltros={false}
            autoIniciar
          />
        </div>
      )}
    </>
  )
}
