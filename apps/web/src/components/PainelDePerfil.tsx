'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
      router.replace(
        `/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname),
      )
      return
    }
    void auth
      .perfil()
      .then(definirPerfil)
      .catch(() => definirPerfil(null))
  }, [usuario, carregando, router, projectSlug])

  if (carregando || !usuario) {
    return <p className="vazio">Carregando...</p>
  }

  return (
    <>
      <div className="perfil-topo">
        {perfil?.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={perfil.user.avatarUrl} alt={perfil.user.displayName} />
        ) : (
          <div className="avatar" aria-hidden>
            {usuario.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1>{perfil?.user.displayName ?? usuario.displayName}</h1>
          {/*
            O @IDENTIFICADOR, E ONDE MUDÁ-LO, NO PRÓPRIO PERFIL.

            Em 01/09 pus o identificador no perfil de toda a gente e disse-lhe
            para escolher o dele em Editar Perfil. Ele respondeu: "no print
            aparece @kadosh, mas preciso entender onde isso fica no meu perfil
            e como eu configuro o meu, porque ainda não encontrei". Mandei-o
            procurar um campo dentro de um formulário que abre noutra página, e
            chamei a isso uma explicação.

            Quem ainda não tem vê o convite no lugar exacto onde o identificador
            vai ficar, e o convite é o link. É o sítio onde ele olhou.
          */}
          {perfil?.user.username ? (
            <p className="identificador-perfil">@{perfil.user.username}</p>
          ) : (
            <Link className="escolher-identificador" href={`/${projectSlug}/perfil/editar`}>
              @ escolher o meu identificador
            </Link>
          )}
          {/* O responsável fica colado ao nome, e não no fim da página: numa
              plataforma usada por crianças, quem acompanha o perfil é a
              primeira coisa que outro pai quer saber. */}
          {perfil?.user.guardianName && (
            <p className="responsavel-perfil">{perfil.user.guardianName}</p>
          )}
          {perfil?.user.bio && <p className="bio-perfil">{perfil.user.bio}</p>}
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
          {/*
            OS RÓTULOS DIZEM DE QUEM É O NÚMERO.

            Diziam "Conteúdos vistos", "Curtidas", "Comentários" e
            "Compartilhamentos", exactamente os mesmos nomes que estão no
            cabeçalho do perfil logo por cima, onde significam outra coisa: lá
            são as curtidas QUE O PERFIL RECEBEU, aqui são as que a pessoa DEU.
            Ele comparou os dois em 26/08 e viu 11 num sítio e 8 noutro, e tinha
            razão em desconfiar dos dois. O número estava certo; o nome é que
            não dizia de quem era.
          */}
          <Numero valor={perfil.estatisticas.conteudosVistos} rotulo="Conteúdos que você abriu" />
          <Numero valor={perfil.estatisticas.curtidas} rotulo="Curtidas que você deu" />
          <Numero valor={perfil.estatisticas.comentarios} rotulo="Comentários que você escreveu" />
          <Numero
            valor={perfil.estatisticas.compartilhamentos}
            rotulo="Vezes que você compartilhou"
          />
        </div>
      )}

      {/* A edição, a troca de senha e o apagar a conta mudaram para uma página
          só delas, em /perfil/editar. Aqui fica só a porta. */}
      <div className="acoes-perfil">
        <Link className="bloco linha atalho-editar" href={`/${projectSlug}/perfil/editar`}>
          <span>Editar perfil</span>
          <small>foto, nome, descrição, senha e exclusão da conta</small>
        </Link>
      </div>

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
