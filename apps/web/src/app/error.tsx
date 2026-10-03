'use client'

import { useEffect } from 'react'
import { relatarErro } from '@/lib/erros'

/**
 * Quando uma página cai (03/10).
 *
 * Em vez do "Application error: a client-side exception has occurred" em
 * inglês, num ecrã branco e sem saída — foi o que o cliente recebeu no iPhone
 * —, diz-se em português o que aconteceu e oferece-se tentar de novo. E o erro
 * vai para o registo, para se saber o que foi.
 */
export default function ErroDaPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    relatarErro({ tipo: 'render', mensagem: `${error.name}: ${error.message}`, pilha: error.stack, digest: error.digest })
  }, [error])

  return (
    <main className="envoltorio estreito erro-da-pagina">
      <h1>Algo deu errado nesta tela</h1>
      <p className="subtitulo">
        Já recebemos o aviso do problema. Tente de novo; se continuar, volte ao início.
      </p>
      <button type="button" className="cartoes-accao" onClick={reset}>
        Tentar de novo
      </button>
      <a className="cartoes-ligacao" href="/">
        Voltar ao início
      </a>
    </main>
  )
}
