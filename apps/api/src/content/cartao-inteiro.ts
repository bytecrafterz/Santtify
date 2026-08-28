/**
 * Quando é que um cartão está inteiro.
 *
 * ESTA REGRA VIVE AQUI E SÓ AQUI. Estava escrita em três sítios — duas vezes no
 * serviço do painel e uma vez no editor, no navegador — e em 28/08 mudei uma
 * delas e as três passaram a discordar: o botão PUBLICAR acendia, a pessoa
 * carregava, e o servidor punha o cartão de volta em rascunho sem dizer nada.
 * É o defeito de sempre neste projecto, o mesmo dos comentários de 26/08, em
 * que o número vinha de uma consulta e a lista de outra.
 *
 * O SOM NÃO É EXIGIDO EM TODA A PARTE, e essa é a razão de isto ter um
 * parâmetro em vez de ser uma constante:
 *
 *   Nas LETRAS é exigido. Um cartão é imagem, som, título e descrição numa peça
 *   só, e foi esse o trabalho de 23/08: impedir que meio cartão fosse para o ar
 *   depois de ele passar quatro dias a ver fotografias aparecerem sozinhas.
 *
 *   No PRODUTO VIVO não é. Ele pediu em 28/08 várias imagens primeiro e só a
 *   última com som ou vídeo. Exigir som a todas mantinha as imagens em rascunho
 *   para sempre, com o cadeado no PUBLICAR a dizer "falta o áudio", e a função
 *   que ele pediu ficava impossível de usar.
 *
 * É o mesmo raciocínio que já estava escrito para o cartão de impressão, que
 * também não tem som e também nunca chegaria à página se fosse medido pela
 * régua das letras.
 */
export interface CartaoParaMedir {
  assetId?: string | null
  imageAssetId?: string | null
  titulo?: string | null
  text?: string | null
}

/** O `slug` do conteúdo onde o som é opcional. */
export const PRODUTO_VIVO = 'produto-vivo'

export function somEhOpcional(contentSlug: string | null | undefined): boolean {
  return contentSlug === PRODUTO_VIVO
}

/**
 * Devolve o que falta, pelos nomes das coisas.
 *
 * Devolve a LISTA e não um sim/não porque é a lista que o ecrã mostra: "falta o
 * título" resolve-se, "complete o cartão" obriga a adivinhar qual das quatro
 * coisas é. Quem só quer saber se está inteiro pergunta pelo comprimento.
 */
export function faltaNoCartao(c: CartaoParaMedir, somOpcional = false): string[] {
  return [
    !c.imageAssetId && 'a foto',
    !somOpcional && !c.assetId && 'o áudio',
    !c.titulo?.trim() && 'o título',
    !c.text?.trim() && 'a descrição',
  ].filter(Boolean) as string[]
}

export function cartaoEstaInteiro(c: CartaoParaMedir, somOpcional = false): boolean {
  return faltaNoCartao(c, somOpcional).length === 0
}
