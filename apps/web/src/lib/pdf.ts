'use client'

import type { PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'

/**
 * O PDF DO DESIGNER, DESENHADO NO PRÓPRIO NAVEGADOR.
 *
 * "a qualidade das artes precisa ser exatamente a qualidade original enviada
 * pelo designer" — 28/09. O ecrã mostrava uma fotografia do PDF: rasterizada,
 * comprimida em JPEG, e comprimida outra vez pelo armazenamento. O texto das
 * caixas, que no PDF é vectorial, chegava como pixéis, e a 3× desfazia-se.
 * Um leitor de PDF no telemóvel volta a desenhar o texto a cada zoom; é o que
 * isto passa a fazer, com o PDF.js (o motor de PDF do Firefox).
 *
 * A versão "legacy" é a que traz o que falta aos telemóveis mais antigos. O
 * motor carrega-se só quando um cartão o pede, uma vez por visita, e cada PDF
 * uma vez só.
 */

type MotorDePdf = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let motor: Promise<MotorDePdf> | null = null
const paginas = new Map<string, Promise<PDFPageProxy>>()

function carregarMotor(): Promise<MotorDePdf> {
  if (!motor) {
    motor = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      // O `new Worker(new URL(...))` é o que o empacotador reconhece: sai um
      // ficheiro próprio para o trabalhador, que lê o PDF fora do ecrã.
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url),
        { type: 'module' },
      )
      return pdfjs
    })
    // Uma falha de rede não fica guardada: a próxima tentativa volta a pedir.
    motor.catch(() => {
      motor = null
    })
  }
  return motor
}

/** A primeira (e única) página do PDF de uma arte. */
export function paginaDoPdf(url: string): Promise<PDFPageProxy> {
  let pagina = paginas.get(url)
  if (!pagina) {
    pagina = carregarMotor()
      .then((pdfjs) => pdfjs.getDocument({ url }).promise)
      .then((documento) => documento.getPage(1))
    pagina.catch(() => paginas.delete(url))
    paginas.set(url, pagina)
  }
  return pagina
}

/**
 * Até onde se deixa ir um canvas. O Safari do iPhone recusa acima de 16,7
 * milhões de pixéis — e recusa em silêncio, com um canvas vazio.
 */
export const MAXIMO_DE_PIXEIS_POR_CANVAS = 12_000_000
