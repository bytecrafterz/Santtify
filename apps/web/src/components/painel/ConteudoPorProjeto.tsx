'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { admin, ROTULO_DO_ESTADO, type MeuProjeto } from '@/lib/admin'
import { ErroDeApi } from '@/lib/auth'
import { plural } from '@/lib/unidade'
import { IconeDoPainel, type NomeDoIconeDoPainel } from './IconesDoPainel'

/**
 * A ÁREA "CONTEÚDO": os conteúdos de todos os projetos, a um toque.
 *
 * Os projetos administram-se em Projetos; aqui chega-se direto ao que se
 * publica — a sequência, os cartões, o karaokê, as categorias e o Produto Vivo
 * — sem passar pela página de cada projeto. A ordem dos projetos na página
 * inicial está na aba ao lado.
 */
export function ConteudoPorProjeto() {
  const [projetos, definirProjetos] = useState<MeuProjeto[] | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    admin
      .meusProjetos()
      .then((lista) => definirProjetos(lista.filter((p) => p.estado !== 'ARQUIVADO')))
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível carregar.'))
  }, [])

  return (
    <div className="cpp">
      <header className="mp-cabecalho">
        <h1>Conteúdo</h1>
        <p>Os conteúdos de cada projeto: a sequência, os cartões, o karaokê, as categorias e o Produto Vivo.</p>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {!projetos && !erro && <p className="vazio">Carregando...</p>}

      <ul className="cpp-lista">
        {(projetos ?? []).map((p) => {
          const base = `/${p.slug}/admin`
          const atalhos: Array<{ href: string; icone: NomeDoIconeDoPainel; rotulo: string }> = [
            { href: `${base}/alfabeto`, icone: 'sequencia', rotulo: `Introdução e ${plural(p.unidade ?? 'Bloco').toLowerCase()}` },
            { href: `${base}/cartoes`, icone: 'cartoes', rotulo: 'Cartões' },
            { href: `${base}/karaoke`, icone: 'karaoke', rotulo: 'Karaokê' },
            { href: `${base}/categorias`, icone: 'categorias', rotulo: 'Categorias de áudio' },
            { href: `${base}/produto-vivo`, icone: 'produto-vivo', rotulo: 'Produto Vivo' },
          ]
          return (
            <li key={p.slug} className="cpp-projeto">
              <Link className="cpp-cabeca" href={base}>
                <span className="cpp-miniatura">
                  {p.capa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.capa} alt="" loading="lazy" />
                  ) : (
                    <IconeDoPainel nome="imagem" />
                  )}
                </span>
                <span>
                  <strong>{p.nome}</strong>
                  <span className={`mp-estado ${p.estado.toLowerCase()}`}>{ROTULO_DO_ESTADO[p.estado]}</span>
                </span>
              </Link>
              <nav className="cpp-atalhos" aria-label={`Conteúdos de ${p.nome}`}>
                {atalhos.map((a) => (
                  <Link key={a.href} href={a.href}>
                    <IconeDoPainel nome={a.icone} tamanho={18} />
                    {a.rotulo}
                  </Link>
                ))}
              </nav>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
