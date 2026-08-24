'use client'

import { useEffect, useState } from 'react'
import type { PerfilAnfitriao } from '@/lib/api'
import { IndicadoresDaPublicacao } from './IndicadoresDaPublicacao'
import { BotaoDenunciar } from './BotaoDenunciar'

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
      <IndicadoresDaPublicacao
        alvo={{ tipo: 'perfil', userId: pessoa.id }}
        projectId={projectId}
        projectSlug={projectSlug}
        titulo={pessoa.displayName}
        ligacao={`/${projectSlug}/pessoa/${pessoa.id}`}
      />

      {/* Bloquear e denunciar existe em todos os perfis, e não só no do dono.
          Num sítio para crianças, o perfil de um estranho é justamente onde
          isto tem de estar mais à mão. */}
      <div className="linha-acoes">
        <BotaoDenunciar
          projectId={projectId}
          targetType="PROFILE"
          targetId={pessoa.id}
          podeBloquear
        />
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
