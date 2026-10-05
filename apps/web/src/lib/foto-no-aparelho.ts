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
  /** `blob:` — memória deste separador, e só dela. A foto inteira: lupa e PDF. */
  url: string
  /**
   * Uma cópia mais leve (até 2400px), para o cartão no ecrã.
   *
   * O editor desenha a foto em cada um dos cartões da faixa; com a foto de 24 ou
   * 48 megapixéis de um iPhone, eram várias imagens enormes na memória de um
   * telemóvel. A lupa e o PDF continuam a usar a inteira.
   */
  urlDaPrevia: string
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
  // O nível vai pelo número arredondado, o mesmo de que `escalaMaxima` parte:
  // no zoom máximo o recorte dá 199,9 — e não podia ser "não aprovada" ali.
  const arredondado = Math.round(dpi)
  return {
    dpi: arredondado,
    nivel: arredondado >= DPI_BOM ? 'BOA' : arredondado >= DPI_ACEITAVEL ? 'ACEITAVEL' : 'INSUFICIENTE',
  }
}

export interface Veredito {
  nivel: 'APROVADA' | 'ACEITAVEL' | 'RECUSADA'
  texto: string
  /** Só para quem quiser conferir (fica no `title`); à vista não aparece. */
  dpi: number
}

/**
 * Um veredito só, com a resolução E a nitidez (05/10).
 *
 * O ecrã dizia "Qualidade de impressão: boa (200 dpi)" e logo abaixo que a
 * foto estava desfocada. O cliente: "para o usuário, isso pode parecer
 * contraditório". E são mesmo duas medidas diferentes — uma foto pode ter 300
 * dpi e estar desfocada. A regra dele:
 *
 *   300 dpi ou mais = excelente; 200 a 299 = boa; abaixo de 200 = não aprovada.
 *   Aprovada só se passar nos dois: 200 dpi no tamanho real E nitidez mínima.
 *   Resolução boa e levemente desfocada → aceitável, recomenda-se outra.
 *   Muito desfocada, mesmo com resolução → não aprovada.
 *
 * As frases são as dele. Abaixo de 200 dpi e "muito desfocada" já se recusam
 * ao abrir (`abrirFoto`) e o zoom não desce dos 200 (`escalaMaxima`); ficam
 * aqui na mesma, para o veredito nunca dizer "aprovada" ao que não passa.
 */
export function veredito(modelos: ModeloDeCartao[], foto: FotoNoAparelho, ajuste: Ajuste): Veredito {
  const q = qualidade(modelos, foto, ajuste)
  if (q.nivel === 'INSUFICIENTE') {
    return { nivel: 'RECUSADA', dpi: q.dpi, texto: 'Foto não aprovada — diminua o zoom ou envie uma foto maior.' }
  }
  if (foto.nitidez.nivel === 'DESFOCADA') {
    return { nivel: 'RECUSADA', dpi: q.dpi, texto: 'Foto não aprovada — envie outra foto mais nítida.' }
  }
  if (foto.nitidez.nivel === 'DUVIDOSA') {
    return {
      nivel: 'ACEITAVEL',
      dpi: q.dpi,
      texto: 'Qualidade aceitável, mas recomendamos uma foto mais nítida para obter um resultado melhor.',
    }
  }
  return {
    nivel: 'APROVADA',
    dpi: q.dpi,
    texto:
      q.nivel === 'BOA'
        ? 'Foto aprovada — qualidade excelente para impressão.'
        : 'Foto aprovada — qualidade adequada para impressão.',
  }
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

  // "O cliente não precisa entender nada de pixels, DPI ou resolução" — 05/10.
  // As recusas dizem o veredito e o que fazer, e mais nada. Ver `veredito`.
  if (qualidade(modelos, foto, ajusteNeutro()).nivel === 'INSUFICIENTE') {
    URL.revokeObjectURL(url)
    throw new FotoRecusada(
      '❌ Foto não aprovada — ela é pequena demais para imprimir com nitidez. ' +
        'Envie a foto original, da galeria, e não uma cópia reduzida.',
    )
  }

  const nitidez = medirNitidez(imagem, largura, altura, modelos)
  if (nitidez.nivel === 'DESFOCADA') {
    URL.revokeObjectURL(url)
    throw new FotoRecusada('❌ Foto não aprovada — envie outra foto mais nítida.')
  }

  return { url, urlDaPrevia: await copiaLeve(imagem, largura, altura, url), imagem, largura, altura, nitidez }
}

/** A cópia leve para o ecrã; se o aparelho não a conseguir fazer, usa-se a inteira. */
async function copiaLeve(imagem: HTMLImageElement, largura: number, altura: number, original: string): Promise<string> {
  const LADO = 2400
  if (Math.max(largura, altura) <= LADO) return original
  try {
    const f = LADO / Math.max(largura, altura)
    const tela = document.createElement('canvas')
    tela.width = Math.round(largura * f)
    tela.height = Math.round(altura * f)
    const ctx = tela.getContext('2d')
    if (!ctx) return original
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(imagem, 0, 0, tela.width, tela.height)
    const blob = await new Promise<Blob | null>((r) => tela.toBlob(r, 'image/jpeg', 0.9))
    tela.width = 0
    tela.height = 0
    return blob ? URL.createObjectURL(blob) : original
  } catch {
    return original
  }
}

/**
 * Larga a foto da memória: o endereço `blob:` deixa de valer, e a imagem fica
 * sem nada que a segure. "Descartada após gerar o PDF."
 */
export function descartar(foto: FotoNoAparelho | null) {
  if (!foto) return
  URL.revokeObjectURL(foto.url)
  if (foto.urlDaPrevia !== foto.url) URL.revokeObjectURL(foto.urlDaPrevia)
  foto.imagem.removeAttribute('src')
}
