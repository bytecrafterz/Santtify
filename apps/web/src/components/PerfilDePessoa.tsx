'use client'

import { useEffect, useState } from 'react'
import type { PerfilAnfitriao } from '@/lib/api'

/**
 * O perfil de outra pessoa, com a mesma estrutura do perfil do dono.
 *
 * O que aqui estava era um cartão para ler e mais nada: os quatro números eram
 * `<div>` desenhados à mão, não havia como bloquear nem denunciar, e as
 * publicações da pessoa não apareciam. Ele apanhou os três em 24/08 e a frase
 * dele resume o que faltava: "todos os perfis precisam ter a mesma estrutura".
 *
 * A CORREÇÃO NÃO É ACRESCENTAR BOTÕES AQUI. É usar os mesmos componentes que o
 * perfil do dono usa. Esta é a terceira vez que os quatro indicadores nascem
 * mortos num ficheiro novo — capa do projeto, cartão da letra, e agora isto —
 * e as três vezes a causa foi a mesma: mais do que um sítio a desenhar a mesma
 * coisa. Enquanto forem vários, há sempre um que fica para trás.
 */
interface PublicacaoDeAlguem {
  id: string
  body: string | null
  fotoUrl: string | null
  createdAt: string
}

export function PerfilDePessoa({
  pessoa,
  projectId,
  projectSlug,
}: {
  pessoa: PerfilAnfitriao
  projectId: string
  projectSlug: string
}) {
  const [publicacoes, definirPublicacoes] = useState<PublicacaoDeAlguem[]>([])
  const [carregando, definirCarregando] = useState(true)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? ''
    fetch(`${base}/profiles/${pessoa.id}/posts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => definirPublicacoes(Array.isArray(d) ? d : (d?.posts ?? [])))
      .catch(() => {})
      .finally(() => definirCarregando(false))
  }, [pessoa.id])

  return (
    <>
      {/* Os indicadores e o escudo saíram daqui: passaram a vir do mesmo
          cabeçalho que desenha o perfil do anfitrião e o de quem entra. Aqui
          fica só o que é próprio desta pessoa, que são as publicações dela. */}

      {/*
        QUEM É ESTA PESSOA, NA PÁGINA E NÃO DENTRO DE UMA GAVETA.

        Isto faltava, e o que faltava não era decoração. Em 31/08 ele escreveu
        que ao tocar no perfil de outra pessoa aparecia "aquela estrutura
        antiga no meio do caminho". Eu respondi-lhe que as duas páginas eram
        iguais, porque comparei a ESTRUTURA. Comparei a coisa errada. Medido o
        ECRÃ, a diferença é enorme: no perfil dele há 357 pixéis dele próprio
        antes da plataforma começar; no perfil de outra pessoa há 48, e por
        isso "Sobre o Jesus", "letras liberadas" e "Escolha uma letra" caem
        todos dentro do primeiro ecrã. Ele tinha razão e eu não.

        O @identificador, a descrição e quem acompanha o perfil existiam só
        dentro da gaveta que se puxa por cima da fotografia. Uma gaveta é uma
        espreitadela; a página é o registo. Quem abre o perfil de alguém quer
        saber quem é sem ter de descobrir que há ali uma pega para arrastar.
      */}
      <div className="identidade-da-pessoa">
        <h2>{pessoa.displayName}</h2>
        {pessoa.username && <p className="identificador-perfil">@{pessoa.username}</p>}
        {pessoa.guardianName && <p className="responsavel-perfil">{pessoa.guardianName}</p>}
        {pessoa.bio && <p className="bio-perfil">{pessoa.bio}</p>}
        {pessoa.createdAt && (
          <p className="nota">
            Na plataforma desde{' '}
            {new Date(pessoa.createdAt).toLocaleDateString('pt-PT', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      <h2 className="titulo-feed">Publicações</h2>
      {carregando && <p className="nota">A carregar...</p>}
      {!carregando && publicacoes.length === 0 && (
        <p className="nota">Esta pessoa ainda não publicou nada.</p>
      )}

      {publicacoes.map((p) => (
        <article key={p.id} className="publicacao-de-alguem">
          {p.fotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.fotoUrl} alt="" />
          )}
          {p.body && <p>{p.body}</p>}
          <small>{new Date(p.createdAt).toLocaleDateString('pt-PT')}</small>
        </article>
      ))}
    </>
  )
}
