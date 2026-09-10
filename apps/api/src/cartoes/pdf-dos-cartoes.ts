import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { A4_MM, A4_PT, corpoDoNome, mmParaPt } from '@pv/cartoes'

/**
 * O PDF final: uma folha A4 por modelo, num único ficheiro.
 *
 * TRÊS CAMADAS, E CADA UMA NA SUA NATUREZA.
 *
 *   1. A arte do designer, embutida COMO VECTOR quando vem em PDF.
 *   2. A fotografia da criança, em pixéis, porque foi assim que nasceu.
 *   3. O nome, como texto vectorial.
 *
 * A primeira camada é a razão de este ficheiro ter sido reescrito. A versão
 * anterior compunha a folha inteira numa imagem e embutia essa imagem — o que
 * funcionava, e destruía a arte vectorial no processo. O cliente escreveu
 * "mantenha 100% da qualidade" e tem toda a razão: uma arte vectorial
 * rasterizada a 300 dpi já não volta atrás, e nota-se nos contornos das letras
 * grandes e dos ícones. Agora só a fotografia é feita de pixéis.
 *
 * O nome em vector, e não em pixéis, pela mesma razão e mais uma: desenhar
 * texto com o sharp passaria pelo SVG, que precisa do fontconfig e de tipos de
 * letra instalados — e a imagem de produção não tem nenhum. Um tipo de letra em
 * falta não dá erro: o texto sai vazio, e só se dá por isso no papel.
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

/** Onde a fotografia entra na folha, em mm. */
export interface MolduraMm {
  fotoX: number
  fotoY: number
  fotoLargura: number
  fotoAltura: number
}

export interface FolhaDoPdf {
  /**
   * A arte do modelo, tal como o designer a entregou.
   *
   * `pdf` mantém-se vectorial. `imagem` é o caminho para quem ainda entregar
   * JPEG ou PNG — funciona, com a qualidade que a imagem tiver.
   */
  arte: { tipo: 'pdf' | 'imagem'; dados: Buffer }
  /** A fotografia já recortada à moldura, em PNG com transparência. */
  foto: Buffer | null
  moldura: MolduraMm
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

    if (folha.arte.tipo === 'pdf') {
      /**
       * A arte entra como VECTOR.
       *
       * `embedPdf` traz a primeira página do ficheiro do designer como um
       * objecto reutilizável, com os contornos e o texto dela intactos. É a
       * diferença entre o cartão sair com a nitidez do ficheiro original e sair
       * com a nitidez de uma fotocópia a 300 dpi.
       */
      const [embutida] = await pdf.embedPdf(folha.arte.dados, [0])
      pagina.drawPage(embutida, {
        x: 0,
        y: 0,
        width: A4_PT.largura,
        height: A4_PT.altura,
      })
    } else {
      const imagem = await pdf.embedJpg(folha.arte.dados)
      pagina.drawImage(imagem, { x: 0, y: 0, width: A4_PT.largura, height: A4_PT.altura })
    }

    if (folha.foto) {
      /**
       * A fotografia, em PNG com transparência, já recortada ao formato da
       * moldura. Vai por cima da arte, e o recorte oval é o alfa do próprio
       * PNG — não é preciso mexer no estado gráfico do PDF para o obter.
       */
      const retrato = await pdf.embedPng(folha.foto)
      const alturaMm = folha.moldura.fotoAltura
      pagina.drawImage(retrato, {
        x: mmParaPt(folha.moldura.fotoX),
        // De cima para baixo nos modelos, de baixo para cima no PDF.
        y: A4_PT.altura - mmParaPt(folha.moldura.fotoY) - mmParaPt(alturaMm),
        width: mmParaPt(folha.moldura.fotoLargura),
        height: mmParaPt(alturaMm),
      })
    }

    escreverNome(pagina, fonte, folha)
  }

  return Buffer.from(await pdf.save())
}

/** As medidas da folha, para quem precisar de as conferir. */
export const FOLHA = { mm: A4_MM, pt: A4_PT }
