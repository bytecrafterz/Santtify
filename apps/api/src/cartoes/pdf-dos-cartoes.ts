import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { A4_MM, A4_PT, corpoDoNome, mmParaPt } from '@pv/cartoes'

/**
 * O PDF final: uma folha A4 por modelo, num único ficheiro.
 *
 * O cliente pediu, no ponto 8, "um único PDF contendo os 7 cartões
 * personalizados, preparado para impressão". É isso, por esta ordem: a arte
 * composta com a fotografia entra como imagem à resolução de impressão, e o
 * NOME é escrito por cima como TEXTO VECTORIAL.
 *
 * O nome em vector e não em pixéis porque é a única parte da folha cuja
 * nitidez depende de nós. A arte chega com a resolução que o designer lhe deu e
 * a fotografia com a que a mãe tinha; o nome podemos entregá-lo perfeito em
 * qualquer ampliação, e uma letra desenhada em pixéis a 300 dpi mostra os
 * dentes ao lado de uma arte vectorial. Além disso poupa a dependência do
 * fontconfig, que esta máquina não tem — ver `desenho-do-cartao.ts`.
 */

/** A caixa reservada ao nome no modelo, em mm sobre a folha. */
export interface CaixaDoNomeMm {
  nomeX: number
  nomeY: number
  nomeLargura: number
  nomeAltura: number
  nomeCorHex: string
  nomeCorpoMinimo: number
  nomeCorpoMaximo: number
  nomeMaiusculas: boolean
}

export interface FolhaDoPdf {
  /** A arte já composta com a fotografia, em JPEG. */
  imagem: Buffer
  nome: string
  /** O que a mãe escolheu no cursor do tamanho, de 0 a 1. */
  tamanhoDoNome: number
  caixa: CaixaDoNomeMm
}

/** "#12356B" para o rgb do pdf-lib. Cinzento escuro se vier lixo. */
function corDoHex(hex: string) {
  const limpo = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!limpo) return rgb(0.15, 0.15, 0.15)
  const n = parseInt(limpo[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** Escreve o nome centrado na caixa que o modelo reservou. */
function escreverNome(pagina: PDFPage, fonte: PDFFont, folha: FolhaDoPdf) {
  const nome = folha.caixa.nomeMaiusculas
    ? folha.nome.trim().toLocaleUpperCase('pt-BR')
    : folha.nome.trim()
  if (!nome) return

  const caixaLargura = mmParaPt(folha.caixa.nomeLargura)
  const caixaAltura = mmParaPt(folha.caixa.nomeAltura)

  /**
   * O corpo sai da MESMA função que o navegador chama, com o medidor certo.
   *
   * `widthOfTextAtSize(texto, 1)` dá a largura exacta em Helvetica-Bold; o
   * navegador passa o `measureText` do canvas sobre Arial-Bold, que é
   * metricamente compatível. Mesma conta, mesma folga, mesmo resultado — que é
   * a única forma de o nome não mudar de tamanho entre o ecrã e o papel.
   */
  const corpo = mmParaPt(
    corpoDoNome(
      {
        largura: folha.caixa.nomeLargura,
        altura: folha.caixa.nomeAltura,
        corpoMinimo: folha.caixa.nomeCorpoMinimo,
        corpoMaximo: folha.caixa.nomeCorpoMaximo,
      },
      nome,
      folha.tamanhoDoNome,
      (texto) => fonte.widthOfTextAtSize(texto, 1),
    ),
  )

  const largura = fonte.widthOfTextAtSize(nome, corpo)
  const altura = fonte.heightAtSize(corpo)

  const x = mmParaPt(folha.caixa.nomeX) + (caixaLargura - largura) / 2

  /**
   * O PDF conta o Y de baixo para cima; os modelos, como toda a gente, contam
   * de cima para baixo. A conversão é aqui, uma vez, e é por isso que o resto
   * do código pode pensar em milímetros a partir do topo da folha.
   */
  const topo = A4_PT.altura - mmParaPt(folha.caixa.nomeY)
  const y = topo - caixaAltura + (caixaAltura - altura) / 2 + fonte.heightAtSize(corpo) * 0.21

  pagina.drawText(nome, {
    x,
    y,
    size: corpo,
    font: fonte,
    color: corDoHex(folha.caixa.nomeCorHex),
  })
}

/**
 * Junta as folhas num PDF.
 *
 * Helvetica-Bold é um dos tipos de letra que TODO o leitor de PDF tem por
 * obrigação, por isso não vai ficheiro nenhum embutido e o PDF fica leve. A
 * codificação WinAnsi cobre o alfabeto português inteiro — á, ã, ç, é, õ — que
 * é o que interessa aqui: um nome de criança brasileira leva acentos quase
 * sempre, e um cartão com "JOAO" em vez de "JOÃO" é um cartão estragado.
 */
export async function montarPdf(folhas: FolhaDoPdf[]): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Cartões personalizados')
  pdf.setProducer('Santtify')

  const fonte = await pdf.embedFont(StandardFonts.HelveticaBold)

  for (const folha of folhas) {
    const pagina = pdf.addPage([A4_PT.largura, A4_PT.altura])
    const imagem = await pdf.embedJpg(folha.imagem)

    // A imagem ocupa a folha inteira. Já foi composta em proporção A4.
    pagina.drawImage(imagem, {
      x: 0,
      y: 0,
      width: A4_PT.largura,
      height: A4_PT.altura,
    })

    escreverNome(pagina, fonte, folha)
  }

  return Buffer.from(await pdf.save())
}

/** As medidas da folha, para quem precisar de as conferir. */
export const FOLHA = { mm: A4_MM, pt: A4_PT }
