'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
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
  const parametros = useSearchParams()
  const { definirUsuario } = useAuth()
  const [erro, definirErro] = useState<string | null>(null)
  const [enviando, definirEnviando] = useState(false)
  const [senhaAberta, definirSenhaAberta] = useState(false)
  /**
   * "Lembrar meu login" guarda apenas o E-MAIL, nunca a senha.
   *
   * É a diferença entre poupar uma digitação e deixar a conta aberta no
   * telemóvel de quem o encontrar. Guardar senha no aparelho é o género de
   * comodidade que só se percebe como má ideia depois de acontecer.
   */
  const [lembrar, definirLembrar] = useState(true)
  const [emailGuardado, definirEmailGuardado] = useState('')

  useEffect(() => {
    const guardado = window.localStorage.getItem('pv_email')
    if (guardado) definirEmailGuardado(guardado)
    else definirLembrar(false)
  }, [])

  const cadastro = modo === 'cadastrar'
  /** Chegou aqui redirecionado de uma página protegida. */
  const veioDeAreaProtegida = Boolean(parametros.get('voltar'))

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    definirErro(null)
    definirEnviando(true)

    const dados = new FormData(evento.currentTarget)
    const email = String(dados.get('email') ?? '')
    const password = String(dados.get('password') ?? '')

    if (lembrar) window.localStorage.setItem('pv_email', email)
    else window.localStorage.removeItem('pv_email')

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

      // Volta para a página que a pessoa tentou abrir antes de ser mandada
      // para o login. Sem isso, quem clica no painel de métricas entra e cai
      // no perfil, e conclui que o painel não existe — foi exatamente o que
      // aconteceu com o cliente.
      const voltar = parametros.get('voltar')
      const destino =
        voltar && voltar.startsWith(`/${projectSlug}/`)
          ? voltar
          : `/${projectSlug}/perfil`
      router.push(destino)
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
      {veioDeAreaProtegida && (
        <p className="aviso-social">
          Essa área pede login. Entre e você volta direto para ela.
        </p>
      )}
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
               inputMode="email" placeholder="voce@exemplo.com"
                 defaultValue={emailGuardado} key={emailGuardado} />
      </label>

      <label>
        Senha
        <span className="campo-com-olho">
          <input name="password" type={senhaAberta ? 'text' : 'password'} required
                 minLength={cadastro ? 10 : undefined}
                 autoComplete={cadastro ? 'new-password' : 'current-password'}
                 placeholder={cadastro ? 'No mínimo 10 caracteres' : ''} />
          {/* Ver a senha resolve o erro mais comum de todos: escrevê-la certa e
              não notar que o teclado do telemóvel trocou uma letra. */}
          <button
            type="button"
            className="olho"
            onClick={() => definirSenhaAberta((v) => !v)}
            aria-label={senhaAberta ? 'Ocultar a senha' : 'Mostrar a senha'}
            aria-pressed={senhaAberta}
          >
            {senhaAberta ? '🙈' : '👁'}
          </button>
        </span>
        {cadastro && (
          <small>Use pelo menos 10 caracteres. Uma frase curta funciona bem e é fácil de lembrar.</small>
        )}
      </label>

        <div className="linha-lembrar">
          <label className="lembrar">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => definirLembrar(e.target.checked)}
            />
            Lembrar meu login
          </label>
          {!cadastro && <Link href={`/${projectSlug}/recuperar`}>Esqueci minha senha</Link>}
        </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {/* O aceite fica ligado ao próprio botão, e não numa caixinha separada
          que a pessoa marca sem ler. É comunidade infantil: quem cria conta
          precisa ver as regras existirem, no momento em que está entrando. */}
      {cadastro && (
        <p className="aceite">
          Ao criar a conta você concorda com os{' '}
          <Link href="/termos" target="_blank">
            termos de uso
          </Link>{' '}
          e com a{' '}
          <Link href="/privacidade" target="_blank">
            política de privacidade
          </Link>
          . Esta é uma comunidade cristã, infantil e familiar.
        </p>
      )}

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
