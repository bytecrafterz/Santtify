/** Ver index.js — a explicação de cada decisão está lá, junto à conta. */

/** Uma moldura ou caixa, em milímetros sobre a folha A4. */
export interface CaixaMm {
  /** Distância à esquerda da folha, em mm. */
  x: number
  /** Distância ao topo da folha, em mm. */
  y: number
  largura: number
  altura: number
}

/** Só as medidas, quando a posição na folha não interessa. */
export interface MedidaMm {
  largura: number
  altura: number
}

/** As medidas de uma imagem, em pixéis. */
export interface MedidaPx {
  largura: number
  altura: number
}

/**
 * O enquadramento escolhido pela mãe, em proporções.
 *
 * `escala` 1 é a fotografia a cobrir a moldura sem zoom; 2 é o dobro.
 * `deslocX` e `deslocY` são fracções da largura e da altura da MOLDURA:
 * 0 é centrado, -0,25 é um quarto de moldura para a esquerda ou para cima.
 */
export interface Ajuste {
  escala: number
  deslocX: number
  deslocY: number
}

/** O rectângulo onde a fotografia inteira é desenhada, relativo à moldura. */
export interface Enquadramento {
  x: number
  y: number
  largura: number
  altura: number
}

export type NivelDeQualidade = 'BOA' | 'ACEITAVEL' | 'INSUFICIENTE'

export interface Veredicto {
  nivel: NivelDeQualidade
  /** Os dpi que a fotografia entrega com o enquadramento actual. */
  dpi: number
  /** Os dpi que entregaria sem zoom nenhum — o melhor que esta foto dá. */
  dpiSemZoom: number
  /** Até que escala ela pode aproximar mantendo os 300 dpi. */
  zoomMaximo: number
  aprovada: boolean
  mensagem: string
}

/** A caixa do nome, com o intervalo de corpo que o modelo permite. */
export interface CaixaDoNome extends MedidaMm {
  corpoMinimo: number
  corpoMaximo: number
}

export interface TabelaDePrecos {
  precoUnitarioCent: number
  descontoPercentagem: number
  /** A partir de quantos conjuntos o desconto entra. O cliente pediu 2. */
  descontoAPartirDe: number
}

export interface Preco {
  quantidade: number
  subtotalCent: number
  descontoCent: number
  totalCent: number
  percentagemAplicada: number
}

export declare const MM_POR_POLEGADA: number
export declare const A4_MM: MedidaMm
export declare const A4_PT: MedidaMm
export declare const DPI_DE_IMPRESSAO: number
export declare const DPI_BOM: number
export declare const DPI_ACEITAVEL: number

export declare function mmParaPx(mm: number, dpi: number): number
export declare function mmParaPt(mm: number): number
export declare function ajusteNeutro(): Ajuste
export declare function enquadrar(
  moldura: MedidaPx,
  foto: MedidaPx,
  ajuste: Ajuste,
): Enquadramento
export declare function dpiEfetivo(
  molduraMm: MedidaMm,
  foto: MedidaPx,
  ajuste: Ajuste,
): number
export declare function avaliarFoto(
  molduraMm: MedidaMm,
  foto: MedidaPx,
  ajuste?: Ajuste | null,
): Veredicto
export declare function minimoDePixeis(molduraMm: MedidaMm): MedidaPx
/** Devolve a largura do texto a corpo 1, na fonte que vai desenhá-lo. */
export type MedidorDeTexto = (texto: string) => number

export declare const FOLGA_DO_NOME: number
export declare function larguraEstimada(texto: string): number
export declare function corpoDoNome(
  caixaMm: CaixaDoNome,
  nome: string,
  tamanho: number,
  medir?: MedidorDeTexto,
): number
export declare function calcularPreco(
  quantidade: number,
  tabela: TabelaDePrecos,
): Preco
export declare function abreviarKM(n: number): string
