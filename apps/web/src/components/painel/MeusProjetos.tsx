'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { admin, ROTULO_DO_ESTADO, type EstadoDoProjeto, type MeuProjeto } from '@/lib/admin'
import { ErroDeApi } from '@/lib/auth'
import { IconeDoPainel } from './IconesDoPainel'

/** Sem acentos e em minúsculas, para "historias" encontrar "Histórias". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * "MEUS PROJETOS": a entrada do painel, como no mockup dele de 03/10.
 *
 *   "Ao entrar em Projetos, preciso ver imediatamente uma tela chamada Meus
 *    Projetos, com todos os projetos organizados em cards. No topo deve existir
 *    um botão grande e claramente visível: + NOVO PROJETO."
 *
 * O botão de criar vivia no fundo de "Projetos da página inicial", e ele não o
 * encontrou. Aqui é a primeira coisa da página. Tocar num cartão abre a
 * administração daquele projeto; os três pontos têm o resto (ver no site,
 * configurações, publicar, arquivar) sem ter de entrar.
 */
export function MeusProjetos() {
  const [projetos, definirProjetos] = useState<MeuProjeto[] | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [busca, definirBusca] = useState('')
  const [estado, definirEstado] = useState<EstadoDoProjeto | 'TODOS'>('TODOS')

  useEffect(() => {
    admin
      .meusProjetos()
      .then(definirProjetos)
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível carregar os projetos.'))
  }, [])

  const visiveis = useMemo(() => {
    if (!projetos) return []
    const termo = normalizar(busca.trim())
    return projetos.filter(
      (p) =>
        (estado === 'TODOS' || p.estado === estado) &&
        (!termo || normalizar(`${p.nome} ${p.descricao ?? ''}`).includes(termo)),
    )
  }, [projetos, busca, estado])

  const trocar = (actualizado: MeuProjeto) =>
    definirProjetos((lista) => (lista ?? []).map((p) => (p.slug === actualizado.slug ? actualizado : p)))

  return (
    <div className="mp">
      <header className="mp-cabecalho">
        <h1>Meus Projetos</h1>
        <p>
          Crie, edite e organize os projetos da <strong>Santtify</strong>. Cada projeto é uma jornada de
          aprendizado para as crianças.
        </p>
      </header>

      <div className="mp-barra">
        <Link className="mp-novo" href="/admin/projetos/novo">
          <IconeDoPainel nome="mais" tamanho={26} />
          Novo Projeto
        </Link>
        <label className="mp-busca">
          <IconeDoPainel nome="buscar" />
          <input
            type="search"
            value={busca}
            placeholder="Buscar projetos..."
            aria-label="Buscar projetos"
            onChange={(e) => definirBusca(e.target.value)}
          />
        </label>
        <label className="mp-filtro">
          <span className="apenas-leitor-de-ecra">Estado</span>
          <select value={estado} onChange={(e) => definirEstado(e.target.value as EstadoDoProjeto | 'TODOS')}>
            <option value="TODOS">Todos os status</option>
            <option value="PUBLICADO">Publicados</option>
            <option value="RASCUNHO">Rascunhos</option>
            <option value="ARQUIVADO">Arquivados</option>
          </select>
        </label>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {!projetos && !erro ? (
        <ul className="mp-grade" aria-label="Carregando">
          {[0, 1, 2].map((i) => (
            <li key={i} className="mp-cartao mp-cartao-vazio" />
          ))}
        </ul>
      ) : projetos && visiveis.length === 0 ? (
        <p className="mp-nada">
          {projetos.length === 0
            ? 'Ainda não há projetos. Toque em + Novo Projeto para criar o primeiro.'
            : 'Nenhum projeto encontrado com esta busca.'}
        </p>
      ) : (
        <ul className="mp-grade">
          {visiveis.map((p) => (
            <li key={p.slug}>
              <CartaoDoProjeto projeto={p} aoMudar={trocar} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Um projeto em cartão: capa, nome, descrição e estado.
 *
 * A CAPA APARECE INTEIRA, sobre uma cópia desfocada dela própria. As capas dele
 * não têm todas a mesma forma — a do Jesus Alfabeto é uma faixa 3:1 — e são
 * artes com o título escrito até à borda; cortá-las para caber na caixa cortava
 * o nome do projeto.
 */
function CartaoDoProjeto({ projeto, aoMudar }: { projeto: MeuProjeto; aoMudar: (p: MeuProjeto) => void }) {
  const [menu, definirMenu] = useState(false)
  const [ocupado, definirOcupado] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  // Escape fecha o menu, como qualquer menu no computador.
  useEffect(() => {
    if (!menu) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && definirMenu(false)
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [menu])

  const mudarEstado = async (novo: EstadoDoProjeto) => {
    if (
      novo === 'ARQUIVADO' &&
      !window.confirm(
        `Arquivar "${projeto.nome}"? A página do projeto deixa de abrir no site. Pode desarquivar quando quiser.`,
      )
    ) {
      return
    }
    definirMenu(false)
    definirOcupado(true)
    definirErro(null)
    try {
      aoMudar(await admin.actualizarProjeto(projeto.slug, { estado: novo }))
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível mudar o estado.')
    } finally {
      definirOcupado(false)
    }
  }

  return (
    <article className={`mp-cartao${ocupado ? ' ocupado' : ''}${menu ? ' com-menu' : ''}`}>
      <Link className="mp-abrir" href={`/${projeto.slug}/admin`} aria-label={`Administrar ${projeto.nome}`}>
        <span className="mp-capa">
          {projeto.capa ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="mp-capa-fundo" src={projeto.capa} alt="" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mp-capa-arte"
                src={projeto.capa}
                alt=""
                width={projeto.capaLargura ?? undefined}
                height={projeto.capaAltura ?? undefined}
                loading="lazy"
                decoding="async"
              />
            </>
          ) : (
            <span className="mp-sem-capa">
              <IconeDoPainel nome="imagem" tamanho={34} />
              <small>Sem imagem</small>
            </span>
          )}
        </span>
        <span className="mp-texto">
          <strong>{projeto.nome}</strong>
          {projeto.descricao ? <span>{projeto.descricao}</span> : <span className="mp-sem-descricao">Sem descrição</span>}
          <span className={`mp-estado ${projeto.estado.toLowerCase()}`}>{ROTULO_DO_ESTADO[projeto.estado]}</span>
        </span>
      </Link>

      <button
        type="button"
        className="mp-tres-pontos"
        aria-label={`Mais opções de ${projeto.nome}`}
        aria-expanded={menu}
        onClick={() => definirMenu((v) => !v)}
      >
        <IconeDoPainel nome="tres-pontos" />
      </button>

      {menu && (
        <>
          <button type="button" className="mp-menu-fundo" aria-label="Fechar" onClick={() => definirMenu(false)} />
          <div className="mp-menu" role="menu">
            <Link role="menuitem" href={`/${projeto.slug}/admin`}>
              Administrar
            </Link>
            <Link role="menuitem" href={`/${projeto.slug}/admin/configuracoes`}>
              Configurações do projeto
            </Link>
            <a role="menuitem" href={`/${projeto.slug}`} target="_blank" rel="noreferrer">
              Ver no site
            </a>
            {projeto.estado !== 'PUBLICADO' && (
              <button type="button" role="menuitem" onClick={() => void mudarEstado('PUBLICADO')}>
                Publicar (aparece na página inicial)
              </button>
            )}
            {projeto.estado === 'PUBLICADO' && (
              <button type="button" role="menuitem" onClick={() => void mudarEstado('RASCUNHO')}>
                Voltar a rascunho (esconder da página inicial)
              </button>
            )}
            {projeto.estado !== 'ARQUIVADO' ? (
              <button type="button" role="menuitem" className="perigo" onClick={() => void mudarEstado('ARQUIVADO')}>
                Arquivar
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={() => void mudarEstado('RASCUNHO')}>
                Desarquivar (volta como rascunho)
              </button>
            )}
          </div>
        </>
      )}

      {erro && <p className="mp-erro">{erro}</p>}
    </article>
  )
}
