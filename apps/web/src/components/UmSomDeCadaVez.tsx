'use client'

import { useEffect } from 'react'

/**
 * Só um áudio toca de cada vez em toda a plataforma.
 *
 * Numa letra existem quatro faixas, cada uma com o seu tocador. Sem isto,
 * tocar a explicação e a seguir a oração deixava as duas a tocar por cima uma
 * da outra — o cliente apanhou-o em 20/08, e a criança que estiver do outro
 * lado ouve duas vozes ao mesmo tempo.
 *
 * Vive no layout e não em cada tocador porque a regra é da página inteira: a
 * playlist, os quatro áudios da letra e a pré-visualização do painel não se
 * conhecem uns aos outros, e não deviam ter de conhecer.
 *
 * O ouvinte é registado na fase de CAPTURA. O evento `play` não borbulha, e um
 * ouvinte normal no documento nunca chegaria a vê-lo — a página parecia
 * corrigida e continuava com dois sons ao mesmo tempo.
 */
export function UmSomDeCadaVez() {
  useEffect(() => {
    function aoTocar(evento: Event) {
      const quemComecou = evento.target
      if (!(quemComecou instanceof HTMLMediaElement)) return

      document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((outro) => {
        if (outro !== quemComecou && !outro.paused) outro.pause()
      })
    }

    document.addEventListener('play', aoTocar, true)
    return () => document.removeEventListener('play', aoTocar, true)
  }, [])

  return null
}
