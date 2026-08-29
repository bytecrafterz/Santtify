'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, type PerfilResposta } from '@/lib/auth'
import { useAuth } from './ProvedorDeAuth'
import { EditarPerfil } from './EditarPerfil'
import { TrocarSenha } from './TrocarSenha'
import { ApagarConta } from './ApagarConta'

/**
 * Tudo o que se faz à própria conta, num sítio só.
 *
 * Editar, trocar a senha, e apagar a conta. As três estavam espalhadas pelo
 * perfil, entre os conteúdos, e ele disse em 29/08 que apagar a conta "não está
 * organizado de forma clara dentro da edição". Estava certo: era um botão
 * vermelho no fim de uma página que também mostra o alfabeto inteiro.
 *
 * A ordem é a do risco: primeiro o que se faz todos os dias, por último o que
 * não tem volta.
 */
export function PaginaDeEdicaoDoPerfil({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [perfil, definirPerfil] = useState<PerfilResposta | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  const voltarAoPerfil = useCallback(() => {
    router.push(`/${projectSlug}/perfil`)
  }, [router, projectSlug])

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(
        `/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname),
      )
      return
    }
    void auth
      .perfil()
      .then(definirPerfil)
      .catch(() => definirErro('Não foi possível carregar o seu perfil.'))
  }, [usuario, carregando, router, projectSlug])

  if (carregando || !usuario) return <p className="vazio">Carregando...</p>

  return (
    <>
      <button type="button" className="voltar-do-perfil" onClick={voltarAoPerfil}>
        <span aria-hidden>←</span> VOLTAR AO PERFIL
      </button>

      <h1 className="titulo-da-edicao">Editar perfil</h1>

      {erro && <p className="erro">{erro}</p>}
      {!perfil && !erro && <p className="vazio">Carregando...</p>}

      {perfil && (
        <>
          {/*
            Gravar devolve a pessoa ao perfil sozinho. Antes o formulário
            fechava-se e ela ficava onde estava, a olhar para o sítio de onde
            tinha vindo. "Ao salvar, a edição deve fechar e voltar
            automaticamente para o perfil público."
          */}
          <EditarPerfil
            perfil={perfil}
            projectSlug={projectSlug}
            sempreAberto
            aoSair={voltarAoPerfil}
            aoGravar={(novo) => {
              definirPerfil(novo)
              voltarAoPerfil()
            }}
          />

          <TrocarSenha />

          <ApagarConta projectSlug={projectSlug} />
        </>
      )}
    </>
  )
}
