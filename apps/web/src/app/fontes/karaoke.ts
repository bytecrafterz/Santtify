import localFont from 'next/font/local'

/**
 * A letra grossa e redonda do Modo Karaokê.
 *
 * Lilita One, com licença livre (OFL, o texto vai ao lado). Escolhida por ser
 * a mais próxima das letras das artes da Santtify — gordas, arredondadas, a
 * pedir contorno e relevo — e por ter os acentos do português todos.
 *
 * O ficheiro vive no repositório e não vem do Google na altura da compilação:
 * assim a imagem do site compila num servidor sem acesso à internet, e quem
 * abre o karaokê não pede nada a terceiros.
 *
 * Só as páginas do karaokê a carregam; o resto da plataforma continua com a
 * letra do sistema.
 */
export const fonteDoKaraoke = localFont({
  src: './LilitaOne-Regular.ttf',
  variable: '--fonte-karaoke',
  display: 'swap',
  fallback: ['Arial Rounded MT Bold', 'Trebuchet MS', 'system-ui', 'sans-serif'],
})
