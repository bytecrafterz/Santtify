'use client'

import { useEffect } from 'react'

/**
 * Recarrega UMA vez, e só uma, quando se cai num 404.
 *
 * Um endereço que existe pode dar 404 no navegador de quem tem a aplicação
 * aberta desde antes da última publicação: a navegação vai buscar ficheiros da
 * versão anterior, que já não existem. Recarregar traz a versão nova e o
 * endereço passa a abrir.
 *
 * A MARCA NO `sessionStorage` É O QUE IMPEDE UM CICLO. Sem ela, um endereço
 * que não existe mesmo recarregaria para sempre, e um ecrã que pisca sem parar
 * é muito pior do que um 404 honesto. Com ela, tenta uma vez; se voltar aqui,
 * mostra a página e fica quieto.
 *
 * `sessionStorage` e não `localStorage`: a marca morre com o separador. Amanhã,
 * noutra publicação, a rede de segurança volta a estar armada.
 */
export function RecuperarDeVersaoAntiga() {
  useEffect(() => {
    const chave = `pv_404_${window.location.pathname}`
    try {
      if (sessionStorage.getItem(chave)) return
      sessionStorage.setItem(chave, '1')
    } catch {
      // Sem armazenamento (janela privada, por exemplo) não se tenta nada: o
      // risco de ciclo é pior do que o benefício.
      return
    }
    window.location.reload()
  }, [])

  return null
}
