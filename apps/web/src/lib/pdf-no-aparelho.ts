'use client'

import {
  A4_PT,
  DPI_DE_IMPRESSAO,
  corpoDoNome,
  enquadrar,
  mmParaPt,
  mmParaPx,
  type Ajuste,
} from '@pv/cartoes'
import type { PDFFont, PDFPage } from 'pdf-lib'
import type { AlinhamentoDoNome, ArteLiberada, ModeloDeCartao } from './cartoes'
import type { FotoNoAparelho } from './foto-no-aparelho'

/**
 * O PDF DOS CARTÕES, MONTADO NO TELEMÓVEL (03/10).
 *
 * Era o servidor que o montava (`pdf-dos-cartoes.ts` na API), com a foto que a
 * mãe tinha enviado. O cliente pediu o contrário: "O PDF é montado no celular
 * do usuário (PWA) (…) a foto não pode ser enviada ao servidor."
 *
 * A folha sai igual à que o servidor fazia, porque a conta é a mesma:
 *   - a arte é o PDF do designer, embutido em vectorial (`embedPdf`), na A4
 *     inteira — nada é rasterizado;
 *   - a foto vai por cima, no rectângulo da moldura, com o mesmo `enquadrar`
 *     que o ecrã usa enquanto ela arrasta;
 *   - o nome vai por cima de tudo, em Helvetica Bold, com o mesmo
 *     `corpoDoNome` e a mesma linha de base.
 *
 * DUAS DIFERENÇAS, AMBAS PEDIDAS:
 *
 *   1. "Nunca ampliar a foto." O servidor esticava o recorte até aos 300 dpi.
 *      Aqui o recorte vai com os pixéis que a foto tem — reduzido a 300 dpi se
 *      tiver mais, nunca aumentado se tiver menos. Quem o põe no tamanho do
 *      papel é a impressora, que é para isso que o PDF existe.
 *   2. O corte oval é um caminho de recorte do próprio PDF, e não uma máscara
 *      desenhada na imagem: a borda fica perfeita a qualquer ampliação, e a
 *      foto vai em JPEG (bem mais leve do que o PNG que a máscara obrigava).
 */

export interface Personalizacao {
  nome: string
  ajuste: Ajuste
  tamanhoDoNome: number
  nomeAlinhamento: AlinhamentoDoNome
  /** Nula = a cor que o modelo traz. */
  nomeCorHex: string | null
}

/**
 * Os caracteres que a Helvetica do PDF sabe escrever (WinAnsi): o alfabeto
 * português inteiro, acentos e cedilha incluídos, e pouco mais. Um emoji ou
 * uma letra de outro alfabeto fazia a geração falhar no fim — já depois de
 * pago. O editor tira-os enquanto ela escreve (ver `nomeImprimivel`).
 */
const FORA_DO_WINANSI = /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu

/** O nome só com o que pode ser impresso. */
export function nomeImprimivel(texto: string): string {
  return texto.replace(FORA_DO_WINANSI, '')
}

function corDoHex(hex: string, rgb: typeof import('pdf-lib').rgb) {
  const limpo = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!limpo) return rgb(0.15, 0.15, 0.15)
  const n = parseInt(limpo[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/**
 * A medida do nome com a fonte do PDF, para o ecrã e o papel concordarem.
 *
 * O ecrã media em Arial e o PDF escreve em Helvetica Bold; quase iguais, mas
 * não iguais — e "quase" é o nome que cabe no ecrã e sai encolhido no papel.
 * Com isto o editor usa a mesma régua da impressão.
 */
let medidorPronto: Promise<(texto: string) => number> | null = null
export function medidorDoNome(): Promise<(texto: string) => number> {
  medidorPronto ??= (async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    const fonte = await doc.embedFont(StandardFonts.HelveticaBold)
    return (texto: string) => fonte.widthOfTextAtSize(nomeImprimivel(texto), 1)
  })()
  return medidorPronto
}

/** O nome na caixa do modelo — a mesma conta de `escreverNome` no servidor. */
function escreverNome(
  pagina: PDFPage,
  fonte: PDFFont,
  modelo: ModeloDeCartao,
  p: Personalizacao,
  rgb: typeof import('pdf-lib').rgb,
) {
  const caixa = modelo.nomeCaixa
  const limpo = nomeImprimivel(p.nome).trim()
  const nome = caixa.maiusculas ? limpo.toLocaleUpperCase('pt-BR') : limpo
  if (!nome) return

  const caixaLargura = mmParaPt(caixa.largura)
  const caixaAltura = mmParaPt(caixa.altura)
  const corpo = mmParaPt(
    corpoDoNome(
      { largura: caixa.largura, altura: caixa.altura, corpoMinimo: caixa.corpoMinimo, corpoMaximo: caixa.corpoMaximo },
      nome,
      p.tamanhoDoNome,
      (t) => fonte.widthOfTextAtSize(t, 1),
    ),
  )
  const largura = fonte.widthOfTextAtSize(nome, corpo)
  const altura = fonte.heightAtSize(corpo)

  const folga = caixaLargura - largura
  const margem = caixaLargura * 0.02
  const deslocamento =
    p.nomeAlinhamento === 'ESQUERDA'
      ? Math.min(margem, folga)
      : p.nomeAlinhamento === 'DIREITA'
        ? Math.max(folga - margem, 0)
        : folga / 2
  const topo = A4_PT.altura - mmParaPt(caixa.y)
  pagina.drawText(nome, {
    x: mmParaPt(caixa.x) + deslocamento,
    y: topo - caixaAltura + (caixaAltura - altura) / 2 + fonte.heightAtSize(corpo) * 0.21,
    size: corpo,
    font: fonte,
    color: corDoHex(p.nomeCorHex ?? caixa.corHex, rgb),
  })
}

/**
 * O recorte da foto para uma moldura, com os pixéis que a foto tem.
 *
 * `enquadrar` corre na régua dos 300 dpi, como no servidor, e diz que parte da
 * foto cai na moldura. Esse pedaço é copiado para um canvas do tamanho que ele
 * TEM na foto — ou do tamanho dos 300 dpi, se tiver mais. Nunca maior.
 */
async function recortar(foto: FotoNoAparelho, moldura: ModeloDeCartao['moldura'], ajuste: Ajuste): Promise<ArrayBuffer> {
  const W = Math.max(1, Math.round(mmParaPx(moldura.largura, DPI_DE_IMPRESSAO)))
  const H = Math.max(1, Math.round(mmParaPx(moldura.altura, DPI_DE_IMPRESSAO)))
  const r = enquadrar({ largura: W, altura: H }, { largura: foto.largura, altura: foto.altura }, ajuste)
  // Pixéis da moldura a 300 dpi por pixel da foto. Acima de 1, a foto tem
  // menos de 300 dpi aqui — e é aí que o servidor ampliava.
  const fator = r.largura / foto.largura
  const sx = -r.x / fator
  const sy = -r.y / fator
  const sw = W / fator
  const sh = H / fator
  const larguraDeSaida = fator >= 1 ? Math.max(1, Math.round(sw)) : W
  const alturaDeSaida = fator >= 1 ? Math.max(1, Math.round(sh)) : H

  const tela = document.createElement('canvas')
  tela.width = larguraDeSaida
  tela.height = alturaDeSaida
  const ctx = tela.getContext('2d')
  if (!ctx) throw new Error('Este aparelho não conseguiu preparar a foto.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(foto.imagem, sx, sy, sw, sh, 0, 0, larguraDeSaida, alturaDeSaida)
  const blob = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, 'image/jpeg', 0.92))
  tela.width = 0
  tela.height = 0
  if (!blob) throw new Error('Este aparelho não conseguiu preparar a foto.')
  return blob.arrayBuffer()
}

/** Uma elipse em quatro curvas de Bézier — o caminho de recorte da moldura oval. */
function caminhoDaElipse(
  ops: typeof import('pdf-lib'),
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  const k = 0.5522847498
  return [
    ops.moveTo(cx + rx, cy),
    ops.appendBezierCurve(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry),
    ops.appendBezierCurve(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy),
    ops.appendBezierCurve(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry),
    ops.appendBezierCurve(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy),
    ops.closePath(),
  ]
}

/**
 * Monta o PDF: uma folha A4 por cartão, na ordem dos modelos.
 *
 * `artes` vem do servidor com o código de liberação (é o que só existe depois
 * de pago); cada arte é descarregada do endereço público dela. A foto não sai
 * daqui: entra no PDF, e o PDF fica neste aparelho.
 */
export async function gerarPdfNoAparelho({
  modelos,
  artes,
  foto,
  personalizacao,
  aoAvancar,
}: {
  modelos: ModeloDeCartao[]
  artes: ArteLiberada[]
  foto: FotoNoAparelho
  personalizacao: Personalizacao
  aoAvancar?: (feitos: number, total: number) => void
}): Promise<Blob> {
  const ops = await import('pdf-lib')
  const { PDFDocument, StandardFonts, rgb } = ops
  const doc = await PDFDocument.create()
  doc.setTitle('Cartões personalizados')
  doc.setProducer('Santtify')
  doc.setCreator('Santtify')
  const fonte = await doc.embedFont(StandardFonts.HelveticaBold)

  const porModelo = new Map(artes.map((a) => [a.modeloId, a.arte]))
  const comArte = modelos.filter((m) => porModelo.get(m.id))
  if (comArte.length === 0) throw new Error('Os cartões ainda não têm arte de impressão. Fale com o suporte.')

  let feitos = 0
  aoAvancar?.(0, comArte.length)
  for (const modelo of comArte) {
    const arte = porModelo.get(modelo.id)!
    const resposta = await fetch(arte.url, { cache: 'no-store' })
    if (!resposta.ok) throw new Error('Não foi possível baixar a arte de um dos cartões. Verifique a internet e tente de novo.')
    const dados = await resposta.arrayBuffer()

    const pagina = doc.addPage([A4_PT.largura, A4_PT.altura])
    if (arte.tipo === 'pdf') {
      const [embutida] = await doc.embedPdf(dados, [0])
      pagina.drawPage(embutida, { x: 0, y: 0, width: A4_PT.largura, height: A4_PT.altura })
    } else {
      const ehPng = /\.png($|\?)/i.test(arte.url)
      const imagem = ehPng ? await doc.embedPng(dados) : await doc.embedJpg(dados)
      pagina.drawImage(imagem, { x: 0, y: 0, width: A4_PT.largura, height: A4_PT.altura })
    }

    // A foto, recortada pela moldura do próprio PDF.
    const m = modelo.moldura
    const x = mmParaPt(m.x)
    const largura = mmParaPt(m.largura)
    const altura = mmParaPt(m.altura)
    const y = A4_PT.altura - mmParaPt(m.y) - altura
    const retrato = await doc.embedJpg(await recortar(foto, m, personalizacao.ajuste))
    if (m.formato === 'RETANGULO') {
      pagina.drawImage(retrato, { x, y, width: largura, height: altura })
    } else {
      const raio = Math.min(largura, altura) / 2
      const [rx, ry] = m.formato === 'CIRCULO' ? [raio, raio] : [largura / 2, altura / 2]
      pagina.pushOperators(
        ops.pushGraphicsState(),
        ...caminhoDaElipse(ops, x + largura / 2, y + altura / 2, rx, ry),
        ops.clip(),
        ops.endPath(),
      )
      pagina.drawImage(retrato, { x, y, width: largura, height: altura })
      pagina.pushOperators(ops.popGraphicsState())
    }

    escreverNome(pagina, fonte, modelo, personalizacao, rgb)
    aoAvancar?.(++feitos, comArte.length)
  }

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
