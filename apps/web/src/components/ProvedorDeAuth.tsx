'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { auth, ErroDeApi, renovarSessao, tokens, type Usuario } from '@/lib/auth'

interface ContextoDeAuth {
  usuario: Usuario | null
  carregando: boolean
  /**
   * VISITANTE É "DE CERTEZA NÃO TEM CONTA", e não "ainda não sei".
   *
   * `usuario` é nulo em dois momentos que não têm nada a ver um com o outro:
   * quem nunca se registou, e quem tem sessão mas ela ainda está a ser
   * restaurada. Cinco componentes tratavam os dois da mesma maneira, e por isso
   * a página convidava a criar conta a quem já tinha uma, durante o segundo ou
   * dois que a renovação demora num telemóvel em rede móvel.
   *
   * Ele fotografou isso em 27/08 e escreveu "está sempre acontecendo". Os dados
   * do servidor mostram que a sessão dele nunca se perdeu: a renovação dessa
   * mesma hora correu bem. O que falhou foi o ecrã ter respondido antes de
   * saber.
   *
   * É a terceira vez neste projecto que um defeito diferente se lê como "perdi
   * a minha conta". Por isso a pergunta passa a ter uma resposta só, aqui.
   */
  visitante: boolean
  definirUsuario: (u: Usuario | null) => void
  sair: () => Promise<void>
}

const Contexto = createContext<ContextoDeAuth>({
  usuario: null,
  carregando: true,
  visitante: false,
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
        } catch (erro) {
          /**
           * FALHAR A REDE NÃO É PERDER A SESSÃO. OUTRA VEZ.
           *
           * Isto apagava o token guardado a QUALQUER erro. A renovação já tinha
           * corrido bem um instante antes: a sessão era válida, o servidor tinha
           * acabado de emitir um par novo. Bastava a chamada seguinte falhar por
           * rede, por um 500 ou por o telemóvel acordar a meio, e a aplicação
           * deitava fora uma sessão boa. A pessoa voltava e estava fora.
           *
           * Vê-se nos dados dele: tokens criados e nunca mais usados, sem
           * rotação e sem revogação. Nasceram da renovação e foram abandonados
           * aqui, neste `catch`.
           *
           * Já tinha corrigido exactamente isto dentro de `renovarSessao` e
           * deixei a segunda metade por corrigir. Só um 401 apaga: aí o servidor
           * disse mesmo que a sessão não serve. Tudo o resto é caminho, e o
           * token fica guardado para a próxima tentativa.
           */
          if (erro instanceof ErroDeApi && erro.status === 401) tokens.limpar()
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
    <Contexto.Provider
      value={{ usuario, carregando, visitante: !carregando && !usuario, definirUsuario, sair }}
    >
      {children}
    </Contexto.Provider>
  )
}
