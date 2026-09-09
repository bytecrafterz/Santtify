import sharp from 'sharp'
import { A4_MM, enquadrar, mmParaPx, type Ajuste } from '@pv/cartoes'
import { FormatoDaMoldura } from '@pv/db'

/**
 * Compõe UM cartão: a arte do modelo com a fotografia da criança encaixada na
 * moldura, à resolução que se pedir.
 *
 * O NOME NÃO É DESENHADO AQUI. Vai como texto vectorial no PDF, em
 * `pdf-dos-cartoes.ts`. A razão é prática e mordeu-me a sério: desenhar texto
 * com o sharp passa pelo SVG, que precisa do fontconfig e de tipos de letra
 * instalados no sistema — e esta máquina não tem nenhum. Um tipo de letra em
 * falta não dá erro: o texto sai vazio ou noutra letra qualquer, e só se dá por
 * isso quando o PDF já está impresso. Texto vectorial no PDF não depende de
 * nada instalado, sai nítido em qualquer ampliação, e é o que a gráfica prefere.
 *
 * A fotografia entra POR CIMA da arte, recortada ao formato da moldura. É o que
 * corresponde às artes: a moldura oval com o tracejado está desenhada na arte, à
 * volta do espaço, e a fotografia preenche o espaço por dentro.
 */

export interface MolduraDoModelo {
  fotoX: number
  fotoY: number
  fotoLargura: number
  fotoAltura: number
  fotoFormato: FormatoDaMoldura
}

/**
 * O recorte da moldura, como máscara.
 *
 * Só formas — nenhum texto — por isso não precisa de tipos de letra nenhuns.
 */
function mascara(largura: number, altura: number, formato: FormatoDaMoldura): Buffer {
  const cx = largura / 2
  const cy = altura / 2

  let forma: string
  if (formato === FormatoDaMoldura.CIRCULO) {
    const r = Math.min(largura, altura) / 2
    forma = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>`
  } else {
    forma = `<ellipse cx="${cx}" cy="${cy}" rx="${cx}" ry="${cy}" fill="#fff"/>`
  }

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">${forma}</svg>`,
  )
}

/**
 * A fotografia já enquadrada e recortada, do tamanho exacto da moldura.
 *
 * O enquadramento vem de `enquadrar`, a conta partilhada com o navegador. Aqui
 * só se resolve o que o sharp exige e o navegador não: ele não aceita compor
 * numa posição negativa, e a posição É negativa sempre que a mãe aproxima — que
 * é quase sempre. Por isso corta-se a parte visível da fotografia já esticada e
 * coloca-se essa parte na posição não negativa correspondente.
 */
async function fotoNaMoldura(
  foto: Buffer,
  fotoLargura: number,
  fotoAltura: number,
  molduraLargura: number,
  molduraAltura: number,
  formato: FormatoDaMoldura,
  ajuste: Ajuste,
): Promise<Buffer> {
  const rect = enquadrar(
    { largura: molduraLargura, altura: molduraAltura },
    { largura: fotoLargura, altura: fotoAltura },
    ajuste,
  )

  const largura = Math.max(1, Math.round(rect.largura))
  const altura = Math.max(1, Math.round(rect.altura))
  const x = Math.round(rect.x)
  const y = Math.round(rect.y)

  const esticada = await sharp(foto)
    // Sem isto, a fotografia do telemóvel entra deitada: a máquina grava-a na
    // horizontal e põe a rotação no EXIF. Vem antes de tudo, de propósito.
    .rotate()
    .resize(largura, altura, { fit: 'fill' })
    .toBuffer()

  // A intersecção entre a fotografia esticada e a moldura.
  const origemX = Math.max(0, -x)
  const origemY = Math.max(0, -y)
  const destinoX = Math.max(0, x)
  const destinoY = Math.max(0, y)
  const recorteLargura = Math.min(largura - origemX, molduraLargura - destinoX)
  const recorteAltura = Math.min(altura - origemY, molduraAltura - destinoY)

  const tela = sharp({
    create: {
      width: molduraLargura,
      height: molduraAltura,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })

  if (recorteLargura > 0 && recorteAltura > 0) {
    const visivel = await sharp(esticada)
      .extract({
        left: origemX,
        top: origemY,
        width: recorteLargura,
        height: recorteAltura,
      })
      .toBuffer()

    tela.composite([{ input: visivel, left: destinoX, top: destinoY }])
  }

  const composta = await tela.png().toBuffer()

  if (formato === FormatoDaMoldura.RETANGULO) return composta

  return sharp(composta)
    .composite([
      {
        input: mascara(molduraLargura, molduraAltura, formato),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer()
}

/**
 * A folha inteira, à resolução pedida.
 *
 * `dpi` 300 dá 2480x3508 — a folha A4 que a gráfica quer. O mesmo código com
 * `dpi` 96 dá uma prévia leve, e é de propósito que seja o mesmo: uma prévia
 * gerada por outro caminho é uma prévia que pode mentir.
 */
export async function comporCartao(opcoes: {
  arte: Buffer
  foto: Buffer | null
  fotoLargura: number
  fotoAltura: number
  moldura: MolduraDoModelo
  ajuste: Ajuste
  dpi: number
}): Promise<Buffer> {
  const { arte, foto, moldura, ajuste, dpi } = opcoes

  const larguraFolha = Math.round(mmParaPx(A4_MM.largura, dpi))
  const alturaFolha = Math.round(mmParaPx(A4_MM.altura, dpi))

  // `cover` e não `fill`: se a arte vier com uma proporção que não é A4, o
  // `fill` estica-a e ninguém repara até ao papel. O `cover` corta, que é
  // visível de imediato e portanto corrigível.
  const folha = sharp(arte).resize(larguraFolha, alturaFolha, { fit: 'cover' })

  if (!foto) return folha.jpeg({ quality: 92 }).toBuffer()

  const molduraLargura = Math.max(1, Math.round(mmParaPx(moldura.fotoLargura, dpi)))
  const molduraAltura = Math.max(1, Math.round(mmParaPx(moldura.fotoAltura, dpi)))

  const recorte = await fotoNaMoldura(
    foto,
    opcoes.fotoLargura,
    opcoes.fotoAltura,
    molduraLargura,
    molduraAltura,
    moldura.fotoFormato,
    ajuste,
  )

  return folha
    .composite([
      {
        input: recorte,
        left: Math.round(mmParaPx(moldura.fotoX, dpi)),
        top: Math.round(mmParaPx(moldura.fotoY, dpi)),
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()
}
