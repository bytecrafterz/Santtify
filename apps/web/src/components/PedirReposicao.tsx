'use client'

import Link from 'next/link'
import { useState } from 'react'

/**
 * O formulário de quem ficou sem entrar.
 *
 * Antes desta página havia um texto a dizer "fale com o responsável no grupo".
 * Era honesto e era um beco: quem chega por um QR Code impresso não conhece o
 * responsável nem está em grupo nenhum. A irmã do cliente bateu exactamente
 * aqui em 23/08, e ele só soube porque ela lhe telefonou.
 *
 * A frase dele é a que manda neste ficheiro: "se acontecesse com dez ou cem
 * pessoas desconhecidas, elas poderiam desistir, e nós nunca saberíamos".
 * Agora o pedido fica registado, e o responsável vê que alguém tentou mesmo
 * que essa pessoa nunca mais volte.
 *
 * A RESPOSTA É SEMPRE A MESMA, exista a conta ou não. Um formulário que diz
 * "esse e-mail não existe" é um formulário que confirma quais e-mails existem,
 * e numa comunidade infantil isso é uma lista de contactos de crianças a ser
 * oferecida a quem perguntar.
 */
export function PedirReposicao({
  projectId,
  projectSlug,
}: {
  projectId: string
  projectSlug: string
}) {
  const [email, definirEmail] = useState('')
  const [enviando, definirEnviando] = useState(false)
  const [pedido, definirPedido] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    definirEnviando(true)
    definirErro(null)
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/auth/recovery-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, projectId }),
      })
      if (!r.ok && r.status !== 204) throw new Error('falhou')
      definirPedido(true)
    } catch {
      definirErro('Não foi possível registar o pedido agora. Tente daqui a pouco.')
    } finally {
      definirEnviando(false)
    }
  }

  if (pedido) {
    return (
      <div className="bloco">
        <p>
          <strong>Pedido registado.</strong>
        </p>
        <p className="nota">
          Se existir uma conta com esse endereço, o responsável vai repor o acesso e enviar-lhe o
          caminho para escolher uma senha nova. Nada mais é preciso da sua parte.
        </p>
        {/* Estava aqui uma frase a pedir à pessoa que voltasse e pedisse de
            novo, para nós sabermos que ela estava à espera. Ele apanhou-a e
            tem razão: pedir a quem já está bloqueado que repita o pedido é pôr
            o trabalho do sistema em cima de quem está à espera dele. O pedido
            ficou registado à primeira; daí para a frente o problema é nosso. */}
        <p className="nota">
          Já sabemos que está à espera. Não precisa de fazer mais nada nem de repetir o pedido.
        </p>
        <Link className="botao-acao largo" href={`/${projectSlug}/entrar`}>
          VOLTAR PARA ENTRAR
        </Link>
      </div>
    )
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <p className="nota">
        Escreva o e-mail com que se registou. O responsável repõe o seu acesso e avisa-o.
      </p>

      <label>
        E-mail
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => definirEmail(e.target.value)}
          placeholder="voce@exemplo.com"
        />
      </label>

      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}

      <button type="submit" disabled={enviando}>
        {enviando ? 'A registar...' : 'PEDIR ACESSO DE NOVO'}
      </button>
    </form>
  )
}
