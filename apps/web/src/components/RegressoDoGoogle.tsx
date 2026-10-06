'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { auth, ErroDeApi } from '@/lib/auth'
import { useAuth } from './ProvedorDeAuth'

/**
 * O FIM DO "CONTINUAR COM GOOGLE" (06/10).
 *
 * O servidor devolve a pessoa aqui com um código de entrega de uso único — a
 * sessão nunca viaja no endereço. Troca-se o código, guarda-se a sessão como
 * no login por e-mail, e segue-se para onde ela ia; quem acabou de criar a
 * conta vai ao perfil, onde vê o nome e a foto que vieram do Google.
 */
export function RegressoDoGoogle({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const parametros = useSearchParams()
  const { definirUsuario } = useAuth()
  const [erro, definirErro] = useState<string | null>(null)
  // O código serve uma vez: no StrictMode o efeito corre duas, e a segunda
  // gastava um código já gasto e mostrava erro a quem entrou bem.
  const trocado = useRef(false)

  useEffect(() => {
    if (trocado.current) return
    trocado.current = true
    const codigo = parametros.get('codigo')
    if (!codigo) {
      definirErro('A entrada pelo Google não chegou completa. Tente de novo.')
      return
    }
    auth
      .entrarComGoogle(codigo)
      .then(({ usuario, novo }) => {
        definirUsuario(usuario)
        const voltar = parametros.get('voltar')
        const destino =
          !novo && voltar && voltar.startsWith(`/${projectSlug}/`) ? voltar : `/${projectSlug}/perfil`
        router.replace(destino)
        router.refresh()
      })
      .catch((e) =>
        definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível entrar com o Google. Tente de novo.'),
      )
  }, [parametros, projectSlug, router, definirUsuario])

  if (!erro) return <p className="subtitulo">Entrando com o Google…</p>
  return (
    <>
      <h1>Não foi possível entrar</h1>
      <p className="erro" role="alert">
        {erro}
      </p>
      <Link href={`/${projectSlug}/entrar`}>Voltar ao login</Link>
    </>
  )
}
