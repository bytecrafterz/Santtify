'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { ProjetoNoCarrossel } from '@/lib/carrossel'
import { Voltar } from './Voltar'

/**
 * O TOPO DA PÁGINA DE UM PROJETO: a saída no canto e todos os projetos ao lado.
 *
 * "Quando a pessoa entra no Jesus Alfabeto Saudável, ela fica presa naquele
 * projeto e pode nem descobrir Minha Identidade e Poder em Jesus ou os
 * próximos projetos" — 29/09. O cabeçalho que aqui estava era só o nome do
 * projeto e uma seta para a entrada: para ir a outro projeto era preciso sair,
 * encontrar o carrossel e entrar de novo.
 *
 * Agora os projetos vivem numa faixa que rola para o lado, presa ao topo e
 * sempre à vista. Com dois projetos cabem os dois; com dez continuam todos na
 * mesma faixa, e o aberto fica sempre à vista, realçado. Tocar noutro troca de
 * projeto logo; tocar no aberto leva ao princípio dele (na página do projeto,
 * sobe até lá sem recarregar).
 *
 * O mesmo topo em cada página de letra ou de dia, desde 29/09 — aí a seta volta
 * ao projeto, e não à entrada.
 *
 * É meio transparente, com o vidro fosco do iPhone: o conteúdo passa por baixo
 * e a página não perde altura para uma barra opaca. Ganha corpo (mais fundo e
 * uma sombra) só depois de a página rolar, quando há coisas a passar por baixo.
 */
export function TopoDosProjetos({
  projetos,
  atual,
  nomeAtual,
  voltarPara = '/',
  rotuloDeVolta = 'Voltar ao início',
}: {
  projetos: Pick<ProjetoNoCarrossel, 'slug' | 'nome' | 'capa'>[]
  atual: string
  /** Para o caso de o aberto não estar na lista (um projeto ainda por publicar). */
  nomeAtual: string
  /** Para onde vai a seta do canto: a entrada, ou o projeto numa página de letra. */
  voltarPara?: string
  rotuloDeVolta?: string
}) {
  const naPaginaDoProjeto = usePathname() === `/${atual}`
  const faixa = useRef<HTMLElement | null>(null)
  const [rolado, definirRolado] = useState(false)

  const lista = projetos.some((p) => p.slug === atual)
    ? projetos
    : [{ slug: atual, nome: nomeAtual, capa: null }, ...projetos]

  useEffect(() => {
    const ver = () => definirRolado(window.scrollY > 6)
    ver()
    window.addEventListener('scroll', ver, { passive: true })
    return () => window.removeEventListener('scroll', ver)
  }, [])

  // O projeto aberto ao meio da faixa, mesmo que seja o décimo.
  useEffect(() => {
    const f = faixa.current
    const aberto = f?.querySelector<HTMLElement>('[aria-current]')
    if (!f || !aberto) return
    f.scrollLeft = aberto.offsetLeft - (f.clientWidth - aberto.offsetWidth) / 2
  }, [atual])

  return (
    <header className={rolado ? 'topo-projetos rolado' : 'topo-projetos'}>
      <div className="topo-projetos-dentro">
        <Voltar href={voltarPara} rotulo={rotuloDeVolta} />
        <nav ref={faixa} className="topo-projetos-faixa" aria-label="Projetos">
          <ul>
            {lista.map((p) => {
              const aqui = p.slug === atual
              return (
                <li key={p.slug}>
                  <Link
                    href={`/${p.slug}`}
                    className="topo-projeto"
                    aria-current={aqui ? (naPaginaDoProjeto ? 'page' : 'true') : undefined}
                    onClick={(ev) => {
                      if (!aqui || !naPaginaDoProjeto) return
                      ev.preventDefault()
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <span className="topo-projeto-capa" aria-hidden="true">
                      {p.capa ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.capa} alt="" decoding="async" draggable={false} />
                      ) : (
                        p.nome.charAt(0)
                      )}
                    </span>
                    <span className="topo-projeto-nome">{p.nome}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
