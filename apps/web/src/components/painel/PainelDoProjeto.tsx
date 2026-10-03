'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { admin, ROTULO_DO_ESTADO, type MeuProjeto } from '@/lib/admin'
import { ErroDeApi } from '@/lib/auth'
import { plural } from '@/lib/unidade'
import { IconeDoPainel, type NomeDoIconeDoPainel } from './IconesDoPainel'

type Cor = 'azul' | 'ambar' | 'roxo' | 'verde' | 'ciano' | 'cinza'

/** Uma ferramenta do projeto: o ícone na cor dela, o nome e o que se faz lá. */
function Ferramenta({
  href,
  icone,
  cor,
  titulo,
  descricao,
}: {
  href: string
  icone: NomeDoIconeDoPainel
  cor: Cor
  titulo: string
  descricao: string
}) {
  return (
    <Link className={`pp-ferramenta ${cor}`} href={href}>
      <span className="pp-ferramenta-icone">
        <IconeDoPainel nome={icone} />
      </span>
      <span className="pp-ferramenta-texto">
        <strong>{titulo}</strong>
        <small>{descricao}</small>
      </span>
      <span className="pp-ferramenta-seta">
        <IconeDoPainel nome="seta" tamanho={18} />
      </span>
    </Link>
  )
}

/**
 * A ADMINISTRAÇÃO DE UM PROJETO: o que se abre ao tocar num cartão de
 * "Meus Projetos".
 *
 * "PAINEL → PROJETOS → selecionar projeto → administrar conteúdo daquele
 * projeto" (03/10). Aqui só está o que é DESTE projeto — conteúdos, áudios,
 * cartões, configurações. Vendas, afiliados, comunidade, mensagens e análise
 * são de todos e estão no menu, cada um no seu espaço; antes estavam todos
 * nesta página, por baixo uns dos outros, e era isso o "feed infinito".
 */
export function PainelDoProjeto({
  projectSlug,
  acabadoDeCriar,
  incompleto,
}: {
  projectSlug: string
  acabadoDeCriar: boolean
  incompleto: boolean
}) {
  const [projeto, definirProjeto] = useState<MeuProjeto | null>(null)
  const [conteudos, definirConteudos] = useState<{ total: number; publicados: number } | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    admin
      .meusProjetos()
      .then((lista) => {
        const este = lista.find((p) => p.slug === projectSlug)
        if (este) definirProjeto(este)
        else definirErro('Este projeto não existe.')
      })
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível carregar o projeto.'))
    // A contagem entra à parte: se falhar, a página abre na mesma, só sem ela.
    admin
      .listar(projectSlug)
      .then((d) =>
        definirConteudos({
          total: d.contents.length,
          publicados: d.contents.filter((c) => c.status === 'PUBLISHED').length,
        }),
      )
      .catch(() => definirConteudos(null))
  }, [projectSlug])

  if (erro) {
    return (
      <div className="pp">
        <Link className="adm-voltar" href="/admin">
          <IconeDoPainel nome="voltar" tamanho={18} /> Meus Projetos
        </Link>
        <p className="erro">{erro}</p>
      </div>
    )
  }
  if (!projeto) {
    return (
      <div className="pp">
        <div className="pp-topo pp-topo-vazio" aria-label="Carregando" />
      </div>
    )
  }

  const unidade = projeto.unidade ?? 'Bloco'
  const unidades = plural(unidade)
  const casas = projeto.casas
  const base = `/${projectSlug}/admin`
  const percentagem = conteudos?.total ? Math.round((conteudos.publicados / conteudos.total) * 100) : 0

  return (
    <div className="pp">
      <Link className="adm-voltar" href="/admin">
        <IconeDoPainel nome="voltar" tamanho={18} /> Meus Projetos
      </Link>

      {acabadoDeCriar && (
        <p className="pp-aviso ok">
          Projeto criado. Ele está em <strong>Rascunho</strong>: aparece na página inicial do site quando
          você publicar, em Configurações do projeto.
        </p>
      )}
      {incompleto && (
        <p className="pp-aviso">
          A descrição ou a imagem não foi guardada. Pode pô-la em Configurações do projeto.
        </p>
      )}

      <header className="pp-topo">
        <span className="pp-capa">
          {projeto.capa ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="mp-capa-fundo" src={projeto.capa} alt="" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="mp-capa-arte" src={projeto.capa} alt="" />
            </>
          ) : (
            <span className="mp-sem-capa">
              <IconeDoPainel nome="imagem" tamanho={30} />
              <small>Sem imagem</small>
            </span>
          )}
        </span>
        <div className="pp-identidade">
          <span className={`mp-estado ${projeto.estado.toLowerCase()}`}>{ROTULO_DO_ESTADO[projeto.estado]}</span>
          <h1>{projeto.nome}</h1>
          {projeto.descricao && <p>{projeto.descricao}</p>}
          <div className="pp-numeros">
            <span>
              <strong>{casas}</strong> {casas === 1 ? unidade.toLowerCase() : unidades.toLowerCase()}
            </span>
            {conteudos && (
              <span className="pp-publicados">
                <span>
                  <strong>{conteudos.publicados}</strong> de {conteudos.total} conteúdos publicados
                </span>
                <span className="pp-barra" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, percentagem)}%` }} />
                </span>
              </span>
            )}
          </div>
          <div className="pp-accoes">
            <a className="pp-botao" href={`/${projectSlug}`} target="_blank" rel="noreferrer">
              <IconeDoPainel nome="site" tamanho={18} /> Ver no site
            </a>
            <Link className="pp-botao" href={`${base}/configuracoes`}>
              <IconeDoPainel nome="configuracoes" tamanho={18} /> Configurações do projeto
            </Link>
          </div>
        </div>
      </header>

      <section className="pp-grupo" aria-label="Administrar este projeto">
        <h2>Administrar este projeto</h2>
        <div className="pp-grade">
          {/* UMA ENTRADA SÓ PARA PUBLICAR (30/09): a introdução em cima e os
              blocos por baixo, numa sequência. */}
          <Ferramenta
            href={`${base}/alfabeto`}
            icone="sequencia"
            cor="azul"
            titulo={`Introdução e ${unidades.toLowerCase()}`}
            descricao={`A introdução em cima e ${casas} ${unidades.toLowerCase()} por baixo, cada um com foto, áudio, título e texto`}
          />
          <Ferramenta
            href={`${base}/cartoes`}
            icone="cartoes"
            cor="ambar"
            titulo="Cartões personalizados"
            descricao="Os modelos, a moldura da foto, o preço e o desconto"
          />
          <Ferramenta
            href={`${base}/karaoke`}
            icone="karaoke"
            cor="roxo"
            titulo="Modo Karaokê"
            descricao="Palavras em destaque, quem pode cantar e a sincronização de cada música"
          />
          <Ferramenta
            href={`${base}/categorias`}
            icone="categorias"
            cor="ciano"
            titulo="Categorias de áudio"
            descricao="Explicação, música, oração — os filtros da playlist"
          />
          <Ferramenta
            href={`${base}/produto-vivo`}
            icone="produto-vivo"
            cor="verde"
            titulo="Produto Vivo"
            descricao="As imagens e a arte com áudio que as empresas veem"
          />
          <Ferramenta
            href={`${base}/configuracoes`}
            icone="configuracoes"
            cor="cinza"
            titulo="Configurações do projeto"
            descricao="Nome, descrição, imagem, estado, quantidade de blocos e link de compra"
          />
        </div>
      </section>
    </div>
  )
}
