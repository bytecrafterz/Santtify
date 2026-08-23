'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { tokens } from '@/lib/auth'
import { useAuth } from './ProvedorDeAuth'

/**
 * A escolha da senha nova, a partir do link de uso único.
 *
 * O link serve UMA vez e vale 24 horas. Se for reencaminhado sem querer — num
 * grupo, por exemplo — quem o ler depois de usado não entra em conta nenhuma.
 * E ao repor, todas as sessões antigas caem: se a senha estava a ser reposta
 * porque alguém entrou na conta, deixar a sessão dessa pessoa aberta não
 * resolvia nada.
 */
export function ReporSenha({ token, projectSlug }: { token: string; projectSlug: string }) {
  const router = useRouter()
  const { definirUsuario } = useAuth()
  const [senha, definirSenha] = useState('')
  const [aberta, definirAberta] = useState(false)
  const [enviando, definirEnviando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    definirEnviando(true)
    definirErro(null)
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: senha }),
      })
      const dados = await r.json()
      if (!r.ok) throw new Error(dados?.message ?? 'falhou')
      tokens.access = dados.accessToken
      tokens.refresh = dados.refreshToken
      definirUsuario(dados.user)
      router.push(`/${projectSlug}`)
    } catch (e) {
      definirErro(
        e instanceof Error && e.message !== 'falhou'
          ? e.message
          : 'Não foi possível repor a senha. O link pode ter expirado.',
      )
      definirEnviando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <p className="nota">Escolha uma senha nova. Precisa de ter pelo menos 10 caracteres.</p>

      <label>
        Senha nova
        <span className="campo-com-olho">
          <input
            name="password"
            type={aberta ? 'text' : 'password'}
            required
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => definirSenha(e.target.value)}
          />
          <button
            type="button"
            className="olho"
            aria-label={aberta ? 'Esconder a senha' : 'Mostrar a senha'}
            onClick={() => definirAberta((v) => !v)}
          >
            👁
          </button>
        </span>
      </label>

      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}

      <button type="submit" disabled={enviando}>
        {enviando ? 'A guardar...' : 'GUARDAR E ENTRAR'}
      </button>
    </form>
  )
}
