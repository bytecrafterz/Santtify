'use client'

import { useEffect, useState } from 'react'
import { TrocarSenha } from './TrocarSenha'
import { useRouter } from 'next/navigation'
import { auth, type PerfilResposta } from '@/lib/auth'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Perfil do usuário — simples, como o cliente pediu em 12/08.
 *
 * Mostra quem é a pessoa e o que ela fez na plataforma. Não publica nada: My
 * Post saiu da interface junto com foto, vídeo e publicação própria, para o
 * MVP caber no que dá para lançar agora.
 *
 * Quarta mudança de direção em quatro dias, e a regra segue a mesma das
 * anteriores: **a tela sai, o servidor fica.** Minha Jornada (`/me/record`),
 * Meus Lançamentos e agora o My Post continuam construídos, testados e sem
 * nenhuma tela apontando para eles. Apagar tabela e migration seria destrutivo
 * e irreversível por uma decisão que já voltou atrás antes. Sem tela não custa
 * nada manter; reconstruir custaria.
 */
export function PainelDePerfil({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando, sair } = useAuth()
  const [perfil, definirPerfil] = useState<PerfilResposta | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(`/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
      return
    }
    void auth.perfil().then(definirPerfil).catch(() => definirPerfil(null))
  }, [usuario, carregando, router, projectSlug])

  if (carregando || !usuario) {
    return <p className="vazio">Carregando...</p>
  }

  return (
    <>
      <div className="perfil-topo">
        <div className="avatar" aria-hidden>
          {usuario.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1>{usuario.displayName}</h1>
          <p className="subtitulo">
            Na plataforma desde{' '}
            {new Date(perfil?.user.createdAt ?? usuario.createdAt).toLocaleDateString('pt-PT', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {perfil && (
        <div className="numeros">
          <Numero valor={perfil.estatisticas.conteudosVistos} rotulo="Conteúdos vistos" />
          <Numero valor={perfil.estatisticas.curtidas} rotulo="Curtidas" />
          <Numero valor={perfil.estatisticas.comentarios} rotulo="Comentários" />
          <Numero valor={perfil.estatisticas.compartilhamentos} rotulo="Compartilhamentos" />
        </div>
      )}

      <TrocarSenha />

      <div className="acoes-perfil">
        <button
          type="button"
          className="secundario"
          onClick={async () => {
            await sair()
            router.push(`/${projectSlug}`)
          }}
        >
          Sair da conta
        </button>
      </div>
    </>
  )
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="numero">
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  )
}
