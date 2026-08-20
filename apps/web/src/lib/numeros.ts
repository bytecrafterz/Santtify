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

/**
 * Plural das categorias, para os filtros lerem como o cliente os escreveu:
 * "Só orações" e não "Só oração".
 *
 * O nome da categoria é singular porque é assim que ele a escreve no painel e
 * é assim que ela aparece colada a cada faixa. No filtro, porém, a pessoa está
 * a escolher um conjunto, e um conjunto no singular soa a erro.
 *
 * A regra do -ão para -ões cobre exactamente os casos deste projeto — oração,
 * explicação, memorização — e é a regra certa para substantivos terminados em
 * -ção, que são a maioria esmagadora dos -ão em português.
 */
export function plural(palavra: string): string {
  const p = palavra.trim()
  if (!p) return p
  if (/ção$/i.test(p)) return p.replace(/ção$/i, 'ções')
  if (/[rzs]$/i.test(p)) return `${p}es`
  if (/m$/i.test(p)) return p.replace(/m$/i, 'ns')
  return `${p}s`
}
