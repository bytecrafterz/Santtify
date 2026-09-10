import { BadRequestException, Logger } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { PDFDocument } from 'pdf-lib'
import { A4_MM, mmParaPt } from '@pv/cartoes'

const correr = promisify(execFile)
const logger = new Logger('ArteEmPdf')

/**
 * As artes do designer vêm em PDF vectorial, e é assim que devem ficar.
 *
 * O PDF vai inteiro para o ficheiro de impressão, sem passar por pixel nenhum.
 * Mas o EDITOR precisa de mostrar a arte à mãe enquanto ela enquadra a
 * fotografia, e um `<img>` não desenha um PDF. Por isso, e só por isso, faz-se
 * também uma cópia rasterizada — que serve o ecrã e nunca a impressão.
 *
 * É a mesma ideia das duas cópias que já existiam para as letras: uma leve para
 * o telemóvel, outra pesada para o papel. A diferença é que aqui a de papel é a
 * original e a de ecrã é a derivada, e não ao contrário.
 */

/** A largura da cópia de ecrã. Chega para o editor e não pesa na ligação. */
const LARGURA_DE_ECRA = 1240

export interface ArteConferida {
  /** As medidas da folha, em milímetros. */
  larguraMm: number
  alturaMm: number
  /** Verdadeiro quando a folha é A4 dentro de meio milímetro. */
  ehA4: boolean
  paginas: number
}

/**
 * Confere a folha antes de a aceitar.
 *
 * Uma arte que não é A4 não dá erro nenhum ao ser embutida: sai esticada ou
 * cortada, e só se vê no papel. Melhor recusar aqui, com o número exacto para o
 * designer corrigir.
 */
export async function conferirPdf(dados: Buffer): Promise<ArteConferida> {
  let pdf: PDFDocument
  try {
    pdf = await PDFDocument.load(dados)
  } catch {
    throw new BadRequestException('Não foi possível ler este PDF. Confira o arquivo.')
  }

  const paginas = pdf.getPageCount()
  if (paginas === 0) throw new BadRequestException('Este PDF não tem nenhuma página.')

  const { width, height } = pdf.getPage(0).getSize()
  const emMm = (pt: number) => (pt / 72) * 25.4

  const larguraMm = Number(emMm(width).toFixed(1))
  const alturaMm = Number(emMm(height).toFixed(1))

  // Meio milímetro de tolerância: os exportadores arredondam o ponto e uma arte
  // A4 legítima chega muitas vezes como 595.276 em vez de 595.28.
  const ehA4 =
    Math.abs(width - mmParaPt(A4_MM.largura)) < 1.5 &&
    Math.abs(height - mmParaPt(A4_MM.altura)) < 1.5

  return { larguraMm, alturaMm, ehA4, paginas }
}

/**
 * A primeira página do PDF, como JPEG, para o editor mostrar.
 *
 * Usa o `pdftoppm` do poppler, que está na imagem da API. Se um dia não
 * estiver, esta função diz-o em português em vez de falhar com um erro de
 * processo — e o painel pede a arte também em imagem.
 */
export async function rasterizarPrimeiraPagina(dados: Buffer): Promise<Buffer> {
  const pasta = await mkdtemp(join(tmpdir(), 'arte-'))
  const entrada = join(pasta, `${randomUUID()}.pdf`)
  const saida = join(pasta, 'pagina')

  try {
    await writeFile(entrada, dados)
    await correr('pdftoppm', [
      '-jpeg',
      '-r',
      // A resolução que dá aproximadamente LARGURA_DE_ECRA numa folha A4.
      String(Math.round((LARGURA_DE_ECRA / A4_MM.largura) * 25.4)),
      '-f',
      '1',
      '-l',
      '1',
      '-singlefile',
      entrada,
      saida,
    ])
    return await readFile(`${saida}.jpg`)
  } catch (erro) {
    const mensagem = String((erro as Error)?.message ?? erro)
    if (mensagem.includes('ENOENT')) {
      logger.error('pdftoppm não encontrado — a imagem da API precisa do poppler-utils.')
      throw new BadRequestException(
        'O servidor não consegue converter PDF em imagem neste momento. ' +
          'Envie a arte também em JPG ou PNG, ou avise o suporte.',
      )
    }
    logger.error(`Falha ao rasterizar a arte: ${mensagem}`)
    throw new BadRequestException('Não foi possível gerar a pré-visualização deste PDF.')
  } finally {
    await rm(pasta, { recursive: true, force: true })
  }
}
