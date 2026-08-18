'use client'

import { useState } from 'react'
import { auth, ErroDeApi } from '@/lib/auth'

/**
 * Troca de senha, dentro do perfil.
 *
 * Fica fechado por padrão. É uma ação rara, e um formulário de senha sempre
 * aberto na página do perfil convida a digitar senha por engano no aparelho
 * errado — além de empurrar para baixo o que a pessoa veio ver.
 *
 * A confirmação existe porque aqui não há como recuperar: sem e-mail de
 * redefinição configurado, uma senha nova digitada com um erro de teclado
 * tranca a conta até alguém mexer no servidor. Pedir duas vezes é barato
 * perto disso.
 */
export function TrocarSenha() {
  const [aberto, definirAberto] = useState(false)
  const [atual, definirAtual] = useState('')
  const [nova, definirNova] = useState('')
  const [confirmacao, definirConfirmacao] = useState('')
  const [enviando, definirEnviando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const [pronto, definirPronto] = useState(false)

  function limpar() {
    definirAtual('')
    definirNova('')
    definirConfirmacao('')
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    definirErro(null)

    if (nova.length < 10) {
      definirErro('A senha nova precisa ter pelo menos 10 caracteres.')
      return
    }
    if (nova !== confirmacao) {
      definirErro('As duas senhas novas não são iguais.')
      return
    }

    definirEnviando(true)
    try {
      await auth.trocarSenha({ senhaAtual: atual, senhaNova: nova })
      limpar()
      definirPronto(true)
      definirAberto(false)
    } catch (e) {
      definirErro(
        e instanceof ErroDeApi ? e.message : 'Não foi possível trocar a senha agora.',
      )
    } finally {
      definirEnviando(false)
    }
  }

  if (!aberto) {
    return (
      <div className="acoes-perfil">
        {pronto && <p className="aviso-ok">Senha trocada. Use a nova da próxima vez que entrar.</p>}
        <button type="button" className="secundario" onClick={() => definirAberto(true)}>
          Trocar senha
        </button>
      </div>
    )
  }

  return (
    <form className="bloco formulario troca-senha" onSubmit={enviar}>
      <span className="bloco-rotulo">Trocar senha</span>

      <label htmlFor="senha-atual">Senha atual</label>
      <input
        id="senha-atual"
        type="password"
        autoComplete="current-password"
        value={atual}
        onChange={(e) => definirAtual(e.target.value)}
        required
      />

      <label htmlFor="senha-nova">Senha nova</label>
      <input
        id="senha-nova"
        type="password"
        autoComplete="new-password"
        minLength={10}
        value={nova}
        onChange={(e) => definirNova(e.target.value)}
        required
      />
      <p className="nota">
        Pelo menos 10 caracteres. Três palavras que só você ligaria funcionam melhor do que
        símbolos difíceis de lembrar.
      </p>

      <label htmlFor="senha-confirmacao">Repita a senha nova</label>
      <input
        id="senha-confirmacao"
        type="password"
        autoComplete="new-password"
        value={confirmacao}
        onChange={(e) => definirConfirmacao(e.target.value)}
        required
      />

      {erro && <p className="erro">{erro}</p>}

      <p className="nota">
        Ao trocar, todos os aparelhos onde você entrou são desconectados. Este continua ligado.
      </p>

      <div className="tocador-controles">
        <button
          type="button"
          className="secundario"
          onClick={() => {
            limpar()
            definirErro(null)
            definirAberto(false)
          }}
        >
          Cancelar
        </button>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Trocando...' : 'Trocar senha'}
        </button>
      </div>
    </form>
  )
}
