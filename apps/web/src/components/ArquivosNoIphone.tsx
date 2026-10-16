'use client'

import { useEffect } from 'react'

/**
 * NO IPHONE, TODOS OS ARQUIVOS DA PASTA SE PODEM ESCOLHER (16/10).
 *
 * "Os arquivos aparecem na pasta Downloads, mas ficam desativados e não
 * consigo tocar neles." O iPhone apaga no app Arquivos tudo o que não
 * reconhece como um dos tipos do `accept` — e não reconhece um arquivo
 * descarregado de um link sem extensão (o ChatGPT, alguns designers), mesmo
 * sendo uma imagem perfeita. O Firefox sabia que era imagem porque foi ele que
 * o descarregou; o seletor do site não.
 *
 * No iPhone tira-se o filtro no momento do toque: o menu continua a oferecer
 * a Fototeca, a câmara e os Arquivos, e nos Arquivos tudo se pode tocar. Quem
 * diz se serve é o servidor, que reconhece o arquivo pelos primeiros bytes
 * (`StorageService.identificar`) e explica quando não serve.
 *
 * Só no iPhone e no iPad. No Android o filtro abre o seletor de fotos, que é
 * o melhor caminho lá, e no computador a janela já deixa escolher "Todos".
 */
export function ArquivosNoIphone() {
  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (!ios) return
    const aoTocar = (ev: Event) => {
      const alvo = ev.target
      if (alvo instanceof HTMLInputElement && alvo.type === 'file' && alvo.hasAttribute('accept')) {
        alvo.removeAttribute('accept')
      }
    }
    // Na captura: corre antes de o seletor abrir, também quando o campo está
    // escondido e é um botão do site que lhe chama `click()`.
    document.addEventListener('click', aoTocar, true)
    return () => document.removeEventListener('click', aoTocar, true)
  }, [])
  return null
}
