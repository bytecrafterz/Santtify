'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { auth, ErroDeApi } from '@/lib/auth'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Cadastro e login no mesmo componente — os dois formulários são quase iguais
 * e mantê-los juntos evita que um receba correção e o outro não.
 */
export function FormularioDeAuth({
  modo,
  projectId,
  projectSlug,
}: {
  modo: 'entrar' | 'cadastrar'
  projectId: string
  projectSlug: string
}) {
  const router = useRouter()
  const { definirUsuario } = useAuth()
  const [erro, definirErro] = useState<string | null>(null)
  const [enviando, definirEnviando] = useState(false)

  const cadastro = modo === 'cadastrar'

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    definirErro(null)
    definirEnviando(true)

    const dados = new FormData(evento.currentTarget)
    const email = String(dados.get('email') ?? '')
    const password = String(dados.get('password') ?? '')

    try {
      const usuario = cadastro
        ? await auth.cadastrar({
            projectId,
            email,
            password,
            displayName: String(dados.get('displayName') ?? ''),
          })
        : await auth.entrar({ projectId, email, password })

      definirUsuario(usuario)
      router.push(`/${projectSlug}/perfil`)
      router.refresh()
    } catch (e) {
      definirErro(
        e instanceof ErroDeApi ? e.message : 'Não foi possível concluir. Tente de novo.',
      )
      definirEnviando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      {cadastro && (
        <label>
          Nome
          <input name="displayName" type="text" required minLength={2} maxLength={80}
                 autoComplete="name" placeholder="Como você quer ser chamado" />
        </label>
      )}

      <label>
        E-mail
        <input name="email" type="email" required autoComplete="email"
               inputMode="email" placeholder="voce@exemplo.com" />
      </label>

      <label>
        Senha
        <input name="password" type="password" required
               minLength={cadastro ? 10 : undefined}
               autoComplete={cadastro ? 'new-password' : 'current-password'}
               placeholder={cadastro ? 'No mínimo 10 caracteres' : ''} />
        {cadastro && (
          <small>Use pelo menos 10 caracteres. Uma frase curta funciona bem e é fácil de lembrar.</small>
        )}
      </label>

      {erro && <p className="erro" role="alert">{erro}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? 'Aguarde...' : cadastro ? 'Criar minha conta' : 'Entrar'}
      </button>

      <p className="alternativa">
        {cadastro ? (
          <>Já tem conta? <Link href={`/${projectSlug}/entrar`}>Entrar</Link></>
        ) : (
          <>Ainda não tem conta? <Link href={`/${projectSlug}/cadastrar`}>Criar conta</Link></>
        )}
      </p>
    </form>
  )
}
