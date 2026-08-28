/**
 * A ordem das publicações do Produto Vivo.
 *
 * Ele especificou-a em 28/08: "as imagens primeiro, e a arte com áudio ou vídeo
 * sempre por último". E, no mesmo pedido, que o número de imagens fosse livre —
 * a especificação anterior falava de três artes fixas e essa deixou de valer.
 *
 * A ORDEM É CALCULADA NA LEITURA, e não gravada em `position`. As duas
 * alternativas foram pesadas:
 *
 *   Gravar significaria reordenar as linhas sempre que um cartão ganha ou perde
 *   o áudio, em cada sítio onde isso pode acontecer: gravar o cartão, apagar o
 *   áudio, duplicar, importar. Cada um desses sítios é uma oportunidade de
 *   esquecer, e o que se esquece diverge onde ninguém está a olhar.
 *
 *   Calcular na leitura significa que a regra vive numa função só, e que o
 *   painel e a página pública chamam a mesma. Foi assim que se resolveram os
 *   comentários em 26/08, quando o contador vinha de uma consulta e a lista de
 *   outra, e os dois discordavam à frente dele.
 *
 * `position` continua a ser a ordem que ele escolheu; esta função só decide
 * quem é imagem e quem é a peça final, e é estável dentro de cada grupo.
 */

/** O mínimo que esta função precisa de saber sobre um cartão. */
export interface CartaoOrdenavel {
  position?: number
  /** O áudio do cartão. É a presença dele que manda a peça para o fim. */
  asset?: { id?: string } | null
  assetId?: string | null
}

function temSom(c: CartaoOrdenavel): boolean {
  return Boolean(c.assetId ?? c.asset?.id ?? c.asset)
}

/**
 * Devolve uma cópia ordenada: primeiro as imagens, e a peça com som no fim.
 *
 * Não muda a lista recebida. Uma função de ordenação que ordena por efeito
 * colateral parece igual à que não o faz, até ao dia em que alguém contava com
 * a lista original logo a seguir.
 */
export function ordemDoProdutoVivo<T extends CartaoOrdenavel>(cartoes: T[]): T[] {
  return [...cartoes].sort((a, b) => {
    const somA = temSom(a) ? 1 : 0
    const somB = temSom(b) ? 1 : 0
    if (somA !== somB) return somA - somB
    // Dentro do mesmo grupo manda a ordem dele. Empate resolvido pela ordem de
    // chegada, para o resultado não bailar entre dois pedidos iguais.
    return (a.position ?? 0) - (b.position ?? 0)
  })
}
