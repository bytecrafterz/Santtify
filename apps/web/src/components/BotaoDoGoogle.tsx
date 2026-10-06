'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/auth'

/** O "G" de quatro cores, como as regras de marca do Google o pedem. */
function LogoDoGoogle() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** O que aconteceu no regresso do Google, dito por palavras (`?google=`). */
const MOTIVOS: Record<string, string> = {
  cancelado: 'A entrada com o Google foi cancelada. Tente de novo ou entre com e-mail.',
  email: 'Esta conta Google não tem o e-mail confirmado. Use outra conta ou entre com e-mail.',
  erro: 'Não foi possível entrar com o Google agora. Tente de novo ou entre com e-mail.',
}

/**
 * "CONTINUAR COM GOOGLE" (06/10), por cima do formulário de e-mail.
 *
 * Pedido do cliente: criar a conta ou entrar "com poucos toques, sem precisar
 * preencher cadastro e criar senha", mantendo o login por e-mail. O botão é
 * uma ligação de página inteira para a API, que segue para o Google — ver
 * `EntradaComGoogle` no servidor. Só aparece quando o servidor tem as chaves.
 *
 * Serve para entrar e para criar conta: quem ainda não tem conta passa a ter
 * uma, e por isso os termos ficam à vista aqui também.
 */
export function BotaoDoGoogle({
  projectId,
  projectSlug,
  voltar,
  motivo,
}: {
  projectId: string
  projectSlug: string
  voltar: string | null
  /** O `?google=` do regresso, quando algo não correu bem. */
  motivo: string | null
}) {
  const [ativo, definirAtivo] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/auth/google/estado`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ativo?: boolean } | null) => definirAtivo(Boolean(d?.ativo)))
      .catch(() => definirAtivo(false))
  }, [])

  if (!ativo) return null

  const q = new URLSearchParams({ projectId, projeto: projectSlug, ...(voltar ? { voltar } : {}) })
  return (
    <div className="entrar-com-google">
      {motivo && MOTIVOS[motivo] && (
        <p className="erro" role="alert">
          {MOTIVOS[motivo]}
        </p>
      )}
      <a className="botao-google" href={`${API_URL}/auth/google?${q}`}>
        <LogoDoGoogle />
        <span>Continuar com Google</span>
      </a>
      <p className="aceite">
        Ao continuar com o Google você concorda com os{' '}
        <Link href="/termos" target="_blank">
          termos de uso
        </Link>{' '}
        e com a{' '}
        <Link href="/privacidade" target="_blank">
          política de privacidade
        </Link>
        .
      </p>
      <p className="separador-ou">
        <span>ou com e-mail</span>
      </p>
    </div>
  )
}
