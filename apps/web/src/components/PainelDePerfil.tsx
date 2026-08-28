'use client'

import { useEffect, useState } from 'react'
import { TrocarSenha } from './TrocarSenha'
import { EditarPerfil } from './EditarPerfil'
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

      {perfil && <EditarPerfil perfil={perfil} aoGravar={definirPerfil} />}

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

      <ApagarConta projectSlug={projectSlug} />
    </>
  )
}

/**
 * Apagar a conta.
 *
 * Duas portas, como ele pediu que se testasse tudo em 27/08: entrar, apagar,
 * concluir; e entrar, cancelar, voltar. O CANCELAR fecha e não deixa nada para
 * trás, nem sequer a senha escrita.
 *
 * A senha é a confirmação. Um "tem a certeza?" é uma pergunta que se responde
 * sem ler, e este é o único botão da plataforma que não tem volta. A senha
 * obriga a parar. Também impede que a conta de uma criança seja apagada por
 * outra pessoa num telemóvel que ficou destrancado em cima da mesa.
 */
function ApagarConta({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const [aberto, definirAberto] = useState(false)
  const [senha, definirSenha] = useState('')
  const [erro, definirErro] = useState<string | null>(null)
  const [aApagar, definirAApagar] = useState(false)

  function fechar() {
    definirAberto(false)
    definirSenha('')
    definirErro(null)
  }

  if (!aberto) {
    return (
      <div className="acoes-perfil zona-de-risco">
        <button type="button" className="apagar-conta" onClick={() => definirAberto(true)}>
          EXCLUIR MINHA CONTA
        </button>
      </div>
    )
  }

  return (
    <div className="acoes-perfil zona-de-risco aberta">
      <h2>Excluir minha conta</h2>
      <p>Isto não tem volta. Ao confirmar:</p>
      <ul>
        <li>o seu perfil deixa de existir e deixa de aparecer para as outras pessoas</li>
        <li>o seu nome, a sua foto e o seu email são apagados</li>
        <li>os seus comentários e curtidas deixam de aparecer</li>
        <li>não é possível entrar outra vez com este email</li>
      </ul>

      <form
        className="formulario"
        onSubmit={async (evento) => {
          evento.preventDefault()
          definirErro(null)
          definirAApagar(true)
          try {
            await auth.apagarConta(senha)
            // A sessão já foi limpa dentro de `apagarConta`. `replace` e não
            // `push` porque voltar atrás traria a pessoa a um perfil que já
            // não existe, e a página tentaria carregá-lo e falharia.
            router.replace(`/${projectSlug}`)
          } catch (e) {
            definirErro(e instanceof Error ? e.message : 'Não foi possível excluir a conta.')
            definirAApagar(false)
          }
        }}
      >
        <label>
          Escreva a sua senha para confirmar
          <input
            type="password"
            value={senha}
            autoComplete="current-password"
            onChange={(e) => definirSenha(e.target.value)}
            required
          />
        </label>

        {erro && <p className="erro">{erro}</p>}

        <div className="par-de-botoes">
          <button type="button" className="secundario" onClick={fechar} disabled={aApagar}>
            CANCELAR
          </button>
          <button type="submit" className="apagar-conta" disabled={aApagar || senha.length === 0}>
            {aApagar ? 'A excluir...' : 'EXCLUIR DEFINITIVAMENTE'}
          </button>
        </div>
      </form>
    </div>
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
