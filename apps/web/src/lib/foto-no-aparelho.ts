'use client'

import {
  DPI_ACEITAVEL,
  DPI_BOM,
  ajusteNeutro,
  dpiEfetivo,
  mmParaPx,
  nitidezDosPixeis,
  type Ajuste,
} from '@pv/cartoes'
import type { ModeloDeCartao } from './cartoes'

/**
 * A FOTO DA CRIANÇA, SÓ NO TELEMÓVEL (03/10).
 *
 * O cliente escreveu-o em seis pontos, e os que mandam aqui são três:
 *
 *   "A foto não pode ser enviada ao servidor."
 *   "Nada de foto guardada no servidor nem no navegador (sem upload,
 *    IndexedDB, localStorage ou cache). A foto fica só na memória e é
 *    descartada após gerar o PDF."
 *   "Medir os pixels depois do corte. Ideal 300 dpi, mínimo 200 dpi. Abaixo
 *    disso, recusar. Nunca ampliar a foto."
 *
 * Por isso a foto abre-se aqui, a partir do ficheiro que ela escolheu, num
 * endereço `blob:` — que é um nome para um pedaço de memória deste separador,
 * e não um ficheiro em lado nenhum. Não há `fetch`, não há `FormData`, não há
 * armazenamento: quando o separador fecha, ou quando se chama `descartar`,
 * deixa de existir.
 *
 * A rotação do EXIF (a foto tirada de lado) aplica-se sozinha: os navegadores
 * actuais desenham a imagem já direita e dão as medidas já rodadas.
 */
export interface FotoNoAparelho {
  /** `blob:` — memória deste separador, e só dela. */
  url: string
  imagem: HTMLImageElement
  /** Já com a rotação do EXIF aplicada. */
  largura: number
  altura: number
  nitidez: Nitidez
}

export type NivelDeNitidez = 'NITIDA' | 'DUVIDOSA' | 'DESFOCADA'

export interface Nitidez {
  valor: number
  nivel: NivelDeNitidez
}

/**
 * Os limiares da nitidez, medidos em 03/10.
 *
 * Em fotos de retrato reais, medidas como aqui (o recorte da moldura à
 * resolução de impressão): nítidas de câmara e de WhatsApp deram 430 a 1045;
 * um desfoque leve que ainda imprime bem, 350 a 500; um desfoque que já se vê,
 * 68 a 85; fora de foco, 2 a 12. Abaixo de 25 recusa-se; abaixo de 120
 * avisa-se e deixa-se decidir.
 */
const NITIDEZ_MINIMA = 25
const NITIDEZ_DE_AVISO = 120

/** Uma foto que não pode ser usada, com a explicação para a mãe. */
export class FotoRecusada extends Error {}

function ehHeic(ficheiro: File) {
  return /image\/hei[cf]/i.test(ficheiro.type) || /\.hei[cf]$/i.test(ficheiro.name)
}

/** A moldura maior entre os modelos: é a que pede mais da foto. */
function molduraMaior(modelos: ModeloDeCartao[]) {
  return modelos.reduce(
    (maior, m) => (m.moldura.largura * m.moldura.altura > maior.largura * maior.altura ? m.moldura : maior),
    modelos[0].moldura,
  )
}

/**
 * A pior resolução entre os cartões, com este enquadramento.
 *
 * O mesmo ajuste vale para os sete cartões, mas as molduras não são todas do
 * mesmo tamanho: a foto pode ter 300 dpi no Dia 1 e 250 no Dia 7. O que conta
 * é o pior, porque é esse que vai para o papel com menos nitidez.
 */
export function qualidade(
  modelos: ModeloDeCartao[],
  foto: { largura: number; altura: number },
  ajuste: Ajuste,
): { dpi: number; nivel: 'BOA' | 'ACEITAVEL' | 'INSUFICIENTE' } {
  if (modelos.length === 0) return { dpi: 0, nivel: 'INSUFICIENTE' }
  const dpi = Math.min(
    ...modelos.map((m) => dpiEfetivo({ largura: m.moldura.largura, altura: m.moldura.altura }, foto, ajuste)),
  )
  return { dpi: Math.round(dpi), nivel: dpi >= DPI_BOM ? 'BOA' : dpi >= DPI_ACEITAVEL ? 'ACEITAVEL' : 'INSUFICIENTE' }
}

/**
 * Até onde o zoom pode ir sem a foto descer dos 200 dpi em nenhum cartão.
 *
 * "Medir os pixels depois do corte (…) Abaixo disso, recusar." Aproximar usa
 * menos pixéis da foto; a partir de certo ponto o recorte já não chega aos 200
 * dpi. Em vez de deixar aproximar e recusar depois, o zoom pára ali.
 */
export function escalaMaxima(modelos: ModeloDeCartao[], foto: { largura: number; altura: number }): number {
  const semZoom = qualidade(modelos, foto, ajusteNeutro()).dpi
  return Math.max(1, Math.min(6, semZoom / DPI_ACEITAVEL))
}

/** Os pixéis mínimos para a moldura maior, a 300 e a 200 dpi. */
export function pixeisNecessarios(modelos: ModeloDeCartao[]) {
  const m = molduraMaior(modelos)
  const a = (dpi: number) => ({
    largura: Math.ceil(mmParaPx(m.largura, dpi)),
    altura: Math.ceil(mmParaPx(m.altura, dpi)),
  })
  return { ideal: a(DPI_BOM), minimo: a(DPI_ACEITAVEL) }
}

/**
 * A nitidez do que vai ficar na moldura, à resolução de impressão.
 *
 * Mede-se o recorte central na proporção da moldura maior — o que se vê sem
 * zoom —, reduzido no máximo à resolução de 300 dpi dessa moldura. É aí que um
 * desfoque se vai notar no papel.
 */
function medirNitidez(imagem: HTMLImageElement, largura: number, altura: number, modelos: ModeloDeCartao[]): Nitidez {
  const m = molduraMaior(modelos)
  const proporcao = m.largura / m.altura
  let cw = largura
  let ch = Math.round(largura / proporcao)
  if (ch > altura) {
    ch = altura
    cw = Math.round(altura * proporcao)
  }
  const sx = Math.round((largura - cw) / 2)
  const sy = Math.round((altura - ch) / 2)
  const larguraDeImpressao = Math.round(mmParaPx(m.largura, DPI_BOM))
  const ow = Math.max(8, Math.min(cw, larguraDeImpressao))
  const oh = Math.max(8, Math.round(ow / proporcao))

  const tela = document.createElement('canvas')
  tela.width = ow
  tela.height = oh
  const ctx = tela.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { valor: NITIDEZ_DE_AVISO, nivel: 'NITIDA' }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(imagem, sx, sy, cw, ch, 0, 0, ow, oh)
  const valor = nitidezDosPixeis(ctx.getImageData(0, 0, ow, oh).data, ow, oh)
  // Larga a memória do canvas já, e não quando o coletor quiser: no iPhone o
  // limite de canvas é pequeno e partilhado pela página inteira.
  tela.width = 0
  tela.height = 0
  return {
    valor: Math.round(valor),
    nivel: valor < NITIDEZ_MINIMA ? 'DESFOCADA' : valor < NITIDEZ_DE_AVISO ? 'DUVIDOSA' : 'NITIDA',
  }
}

/**
 * Abre a foto escolhida, só em memória, e diz se serve.
 *
 * Recusa (com `FotoRecusada`, e a explicação) o que não serve: um formato que
 * este aparelho não abre, uma foto pequena demais para 200 dpi, uma foto
 * desfocada. O que passa volta com a medida da nitidez, para o ecrã avisar
 * quando ela é duvidosa.
 */
export async function abrirFoto(ficheiro: File, modelos: ModeloDeCartao[]): Promise<FotoNoAparelho> {
  if (modelos.length === 0) throw new FotoRecusada('Os cartões ainda estão carregando. Tente de novo em instantes.')
  if (!/^image\//i.test(ficheiro.type) && !ehHeic(ficheiro)) {
    throw new FotoRecusada('Este arquivo não é uma foto. Escolha uma foto da galeria ou da câmera.')
  }

  const url = URL.createObjectURL(ficheiro)
  const imagem = new Image()
  imagem.decoding = 'async'
  imagem.src = url
  try {
    await imagem.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new FotoRecusada(
      ehHeic(ficheiro)
        ? 'Este aparelho não abre fotos HEIC. Escolha a foto pela galeria (o iPhone converte sozinho) ou salve a foto como JPG.'
        : 'Não foi possível abrir esta foto. Escolha outra, em JPG ou PNG.',
    )
  }

  const largura = imagem.naturalWidth
  const altura = imagem.naturalHeight
  const foto = { largura, altura }

  if (qualidade(modelos, foto, ajusteNeutro()).nivel === 'INSUFICIENTE') {
    URL.revokeObjectURL(url)
    const { ideal, minimo } = pixeisNecessarios(modelos)
    throw new FotoRecusada(
      `Esta foto tem ${largura} × ${altura} pixels e fica sem nitidez no cartão impresso. ` +
        `Precisa de pelo menos ${minimo.largura} × ${minimo.altura} pixels (o ideal é ${ideal.largura} × ${ideal.altura}). ` +
        'Envie a foto original, da galeria, e não uma cópia reduzida.',
    )
  }

  const nitidez = medirNitidez(imagem, largura, altura, modelos)
  if (nitidez.nivel === 'DESFOCADA') {
    URL.revokeObjectURL(url)
    throw new FotoRecusada(
      'Esta foto está desfocada e o cartão sairia borrado. Escolha uma foto em que o rosto esteja nítido.',
    )
  }

  return { url, imagem, largura, altura, nitidez }
}

/**
 * Larga a foto da memória: o endereço `blob:` deixa de valer, e a imagem fica
 * sem nada que a segure. "Descartada após gerar o PDF."
 */
export function descartar(foto: FotoNoAparelho | null) {
  if (!foto) return
  URL.revokeObjectURL(foto.url)
  foto.imagem.removeAttribute('src')
}
