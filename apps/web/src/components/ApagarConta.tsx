'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * Apagar a conta.
 *
 * Vive em ficheiro próprio desde 29/08, quando a edição do perfil passou a ter
 * página só dela. Ele disse que apagar a conta "não está organizado de forma
 * clara dentro da edição", e estava certo: era um botão vermelho no fim de uma
 * página que também mostra o alfabeto inteiro.
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
export function ApagarConta({ projectSlug }: { projectSlug: string }) {
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
            {aApagar ? 'A excluir...' : 'SIM, EXCLUIR'}
          </button>
        </div>
      </form>
    </div>
  )
}
