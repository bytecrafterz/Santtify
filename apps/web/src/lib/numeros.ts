/**
 * Números como os mockups os mostram: 512, 2,4 mil, 10 mil.
 *
 * Abreviar não é enfeite. O trilho de indicadores tem 42 pixels de largura, e
 * "2412" ali dentro sai do círculo ou encolhe a ponto de não se ler. Além
 * disso, a partir de certo tamanho o número exacto deixa de informar: entre
 * 2412 e 2415 visualizações não há decisão nenhuma a tomar.
 *
 * Vírgula decimal e "mil" por extenso porque o público é de língua portuguesa,
 * e "2.4K" é a forma como um site inglês escreve, não como uma mãe lê.
 */
export function abreviar(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(n)

  const milhares = n / 1000
  if (n < 10_000) {
    // Uma casa decimal só até 9,9 mil: acima disso a casa decimal ocupa
    // espaço sem acrescentar significado.
    const texto = milhares.toFixed(1).replace('.', ',')
    return `${texto.endsWith(',0') ? texto.slice(0, -2) : texto} mil`
  }
  if (n < 1_000_000) return `${Math.round(milhares)} mil`
  return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`
}
