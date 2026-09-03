'use client'

/**
 * Qual categoria está a tocar AGORA, em toda a página.
 *
 * Pedido dele em 02/09: "quero que a categoria que estiver tocando fique
 * destacada com uma faixa azul de fora a fora, e não apenas com uma pequena
 * alteração no botão", e o que fecha o pedido: "quando o áudio avançar
 * automaticamente para outro conteúdo, essa indicação também precisa
 * acompanhar o que estiver efetivamente tocando".
 *
 * PORQUE É UM SÍTIO SÓ E NÃO ESTADO DE CADA TOCADOR. Cada publicação tem o seu
 * tocador e o seu menu, e são componentes irmãos que não se conhecem. Quando a
 * faixa 3 começa sozinha, quem tem de mudar de cor é o menu da faixa 3 e
 * também o da 1, que estava aceso. Sem um sítio comum, cada menu só saberia de
 * si e ficariam dois acesos ao mesmo tempo — que é pior do que nenhum, porque
 * mente sobre o que se está a ouvir.
 *
 * É um `useSyncExternalStore` e não um contexto: um contexto obrigaria a
 * envolver quatro páginas diferentes num provedor, e cada uma seria um sítio
 * para esquecer.
 */

let aTocar: string | null = null
const ouvintes = new Set<() => void>()

/*
  A ESCOLHA DELE E O QUE ESTÁ A TOCAR SÃO DUAS COISAS, e confundi-las custou-me
  uma volta inteira.

  Eu tinha um valor só. Ele escolhia ORAÇÃO no menu, carregava no play de uma
  Explicação, e o `onPlay` escrevia por cima da escolha dele com a categoria da
  faixa que acabara de começar. A sequência seguia depois a Explicação, e a
  escolha dele desaparecia no instante em que ele carregava no play — que é o
  gesto seguinte, sempre.

  A FAIXA AZUL mostra o que aconteceu por último, seja o dedo dele ou a faixa
  seguinte a começar: é o que ele aprovou e não muda.

  A SEQUÊNCIA segue a ESCOLHA, que só muda quando ele toca no menu.
*/
let escolhida: string | null = null

/** A categoria que ele escolheu no menu. `null` é TODOS. */
export function definirCategoriaEscolhida(nome: string | null) {
  escolhida = nome?.trim().toUpperCase() || null
}

export function lerCategoriaEscolhida() {
  return escolhida
}

/** O nome da categoria que está a tocar, em maiúsculas, ou `null`. */
export function definirCategoriaATocar(nome: string | null) {
  const novo = nome?.trim().toUpperCase() || null
  if (novo === aTocar) return
  aTocar = novo
  for (const o of ouvintes) o()
}

export function assinarCategoriaATocar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

export function lerCategoriaATocar() {
  return aTocar
}

/* No servidor não há nada a tocar, e devolver `null` mantém o primeiro desenho
   igual dos dois lados. */
export function lerCategoriaNoServidor() {
  return null
}
