/** Ver index.js — a razão de cada regra está escrita junto dela. */

export type NivelDeDestaque = 0 | 1 | 2 | 3

export interface PalavraCantada {
  texto: string
  inicioMs: number | null
  fimMs: number | null
  /** Marca manual, feita no painel. Ausente = decide a lista do projeto. */
  destaque?: NivelDeDestaque | null
  /** O começo desta palavra foi marcado à mão (é uma âncora). */
  marcada?: boolean
}

export interface Frase {
  texto: string
  inicioMs: number | null
  fimMs: number | null
  palavras: PalavraCantada[]
}

export interface Destaque {
  /** Normalizada: maiúsculas, sem acentos. Pode ter duas palavras. */
  palavra: string
  nivel: 1 | 2 | 3
}

export type TipoDeComposicao = 'cartaz' | 'faixa' | 'degrau' | 'pilula' | 'pilha' | 'inclinado'

export interface Composicao {
  tipo: TipoDeComposicao
  paleta: string
}

export interface Posicao {
  /** -1 antes da primeira frase (a introdução). */
  frase: number
  /** A palavra a ser cantada agora, ou -1 entre palavras. */
  palavra: number
  /** Quantas palavras da frase já acabaram. */
  cantadas: number
  msAteProxima: number | null
}

export declare const COMPOSICOES: TipoDeComposicao[]
export declare const PALETAS: string[]
export declare const MS_POR_PESO: number

export declare function normalizarPalavra(texto: string): string
export declare function separarPalavras(linha: string): string[]
export declare function frasesDoTexto(texto: string, anteriores?: Frase[] | null): Frase[]

/** O que o transcritor ouviu (tiradas com as palavras e os tempos delas). */
export interface TiradaOuvida {
  texto: string
  inicioMs: number
  fimMs: number
  palavras: Array<{ texto: string; inicioMs: number; fimMs: number }>
}

/** As tiradas ouvidas no áudio, arrumadas em frases de karaokê. */
export declare function frasesDeTranscricao(tiradas: TiradaOuvida[]): Frase[]
export declare function pesoDaPalavra(texto: string): number
export declare function fimDaFrase(
  frase: Frase,
  inicioMs: number,
  proximoInicioMs: number | null,
  duracaoMs?: number | null,
): number
export declare function distribuirTempos(
  palavras: PalavraCantada[],
  inicioMs: number,
  fimMs: number,
): PalavraCantada[]
/** Por frase: o começo dela, ou o começo de cada palavra marcada. */
export type Marca = number | Array<number | null> | null

export declare function aplicarMarcas(
  frases: Frase[],
  marcas: Marca[],
  duracaoMs?: number | null,
): Frase[]
export declare function marcasDasFrases(frases: Frase[]): Marca[]
export declare function niveisDaFrase(palavras: PalavraCantada[], destaques: Destaque[]): NivelDeDestaque[]
export declare function composicaoDaFrase(indice: number): Composicao
export declare function posicaoNoTempo(frases: Frase[], tempoMs: number): Posicao
export declare function estaSincronizada(frases: Frase[]): boolean
export declare function validarFrases(
  frases: unknown,
  duracaoMs: number | null | undefined,
  paraPublicar: boolean,
): string[]
