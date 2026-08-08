'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { auth, renovarSessao, tokens, type Usuario } from '@/lib/auth'

interface ContextoDeAuth {
  usuario: Usuario | null
  carregando: boolean
  definirUsuario: (u: Usuario | null) => void
  sair: () => Promise<void>
}

const Contexto = createContext<ContextoDeAuth>({
  usuario: null,
  carregando: true,
  definirUsuario: () => {},
  sair: async () => {},
})

export function useAuth() {
  return useContext(Contexto)
}

/**
 * Restaura a sessão ao abrir o app.
 *
 * Como o access token só vive em memória, toda abertura de aba começa sem ele
 * e precisa trocar o refresh token guardado por um par novo. É esse passo que
 * faz a pessoa continuar logada entre visitas sem deixar um token de longa
 * duração exposto ao JavaScript da página o tempo todo.
 */
export function ProvedorDeAuth({ children }: { children: React.ReactNode }) {
  const [usuario, definirUsuario] = useState<Usuario | null>(null)
  const [carregando, definirCarregando] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function restaurar() {
      if (!tokens.refresh) {
        if (!cancelado) definirCarregando(false)
        return
      }
      const renovou = await renovarSessao()
      if (cancelado) return

      if (renovou) {
        try {
          const eu = await auth.me()
          if (!cancelado) definirUsuario(eu)
        } catch {
          tokens.limpar()
        }
      }
      if (!cancelado) definirCarregando(false)
    }

    void restaurar()
    return () => {
      cancelado = true
    }
  }, [])

  const sair = useCallback(async () => {
    await auth.sair()
    definirUsuario(null)
  }, [])

  return (
    <Contexto.Provider value={{ usuario, carregando, definirUsuario, sair }}>
      {children}
    </Contexto.Provider>
  )
}
