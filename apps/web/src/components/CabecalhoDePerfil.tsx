'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { auth, type PerfilResposta } from '@/lib/auth'
import { useAuth } from './ProvedorDeAuth'
import { abreviar } from '@/lib/numeros'

/**
 * O cartão de perfil no topo da página, como nos mockups de 19/08.
 *
 * Aparece a toda a gente, com ou sem conta. Quem ainda não tem conta vê os
 * espaços por preencher — "coloque a sua foto aqui" — e é isso que faz o
 * convite: um lugar vazio com o nome dela à espera convence mais do que um
 * botão a dizer "registe-se".
 *
 * Os números do trilho são os da própria pessoa, e não os do projeto. É o
 * perfil dela; o que ela quer ver ali é o que ela fez.
 */
export function CabecalhoDePerfil({
  projectSlug,
  perfisCriados,
}: {
  projectSlug: string
  perfisCriados: number
}) {
  const { usuario, carregando } = useAuth()
  const [perfil, definirPerfil] = useState<PerfilResposta | null>(null)

  useEffect(() => {
    if (carregando || !usuario) {
      definirPerfil(null)
      return
    }
    void auth.perfil().then(definirPerfil).catch(() => definirPerfil(null))
  }, [usuario, carregando])

  const temConta = Boolean(usuario)
  const e = perfil?.estatisticas

  return (
    <>
      <div className="perfil-capa">
        {perfil?.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-capa" src={perfil.user.avatarUrl} alt={perfil.user.displayName} />
        ) : (
          <div className="foto-capa capa-vazia">
            <span>📷</span>
            <span>Coloque sua foto aqui</span>
          </div>
        )}

        <span className="selo-pv-capa" aria-hidden>
          PV
        </span>

        <div className="veu">
          <div className="identidade">
            <h1>
              {perfil?.user.displayName ?? usuario?.displayName ?? 'Escreva seu nome aqui'}
              {temConta && (
                <span className="verificado" aria-label="Perfil confirmado">
                  ✓
                </span>
              )}
            </h1>
            {perfil?.user.guardianName && (
              <p className="responsavel-perfil">{perfil.user.guardianName}</p>
            )}
            <p className="bio-perfil">
              {perfil?.user.bio ?? 'Faça o seu descritivo pessoal'}
            </p>
          </div>
        </div>

        <div className="trilho">
          <span className="indicador contagem">
            <span className="bolha" aria-hidden>
              👁
            </span>
            {abreviar(e?.conteudosVistos ?? 0)}
          </span>
          <span className="indicador contagem">
            <span className="bolha" aria-hidden>
              ♥
            </span>
            {abreviar(e?.curtidas ?? 0)}
          </span>
          <span className="indicador contagem">
            <span className="bolha" aria-hidden>
              💬
            </span>
            {abreviar(e?.comentarios ?? 0)}
          </span>
          <span className="indicador contagem">
            <span className="bolha" aria-hidden>
              ↗
            </span>
            {abreviar(e?.compartilhamentos ?? 0)}
          </span>
        </div>
      </div>

      <div className="linha-acoes">
        <span className="escudo" title="Segurança e denúncia" aria-hidden>
          🛡
        </span>

        <span className="nota-monitor">
          {perfil?.user.guardianName ?? 'Descreva quem monitora este perfil'}
        </span>

        <Link className="botao-acao" href={temConta ? `/${projectSlug}/perfil` : `/${projectSlug}/cadastrar`}>
          👤 {temConta ? 'EDITAR MEU PERFIL' : 'CRIAR MEU PERFIL'}
        </Link>

        <span className="pilula-contador" title="Perfis criados">
          👥 {abreviar(perfisCriados)}
        </span>
      </div>
    </>
  )
}
