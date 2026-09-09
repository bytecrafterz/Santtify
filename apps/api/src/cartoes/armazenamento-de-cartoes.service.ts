import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

/**
 * As fotografias das crianças e os PDFs, enquanto duram.
 *
 * Vive à parte do `StorageService` de propósito, e a diferença é a que
 * interessa: aquele guarda material do cliente para ficar — música, arte das
 * letras — numa pasta servida estaticamente. Este guarda material de FAMÍLIAS
 * para ser apagado, numa pasta que não é servida por ninguém.
 *
 * REGRA QUE NÃO SE PARTE: nada aqui dentro sai por URL directo. Sai por rota
 * que confere o pedido, ou não sai. É a diferença entre uma fotografia de uma
 * criança estar protegida e estar apenas com um endereço difícil de adivinhar.
 */

/** 12 MB, o mesmo que o painel aceita numa fotografia. */
export const TAMANHO_MAXIMO_FOTO = 12 * 1024 * 1024

const TIPOS_ACEITES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])

/**
 * O tecto do lado maior da fotografia guardada.
 *
 * A folha A4 a 300 dpi tem 2480x3508. Uma moldura ocupa uma parte dela, por
 * isso 4000px cobre com folga qualquer enquadramento a 300 dpi, e trava a
 * fotografia de 48 megapixéis que só serve para encher o disco. Não se reduz
 * abaixo disto: reduzir é exactamente o erro que faz o cartão sair borrado.
 */
const LADO_MAXIMO = 4000

export interface FotoGuardada {
  caminho: string
  largura: number
  altura: number
}

@Injectable()
export class ArmazenamentoDeCartoesService {
  private readonly logger = new Logger(ArmazenamentoDeCartoesService.name)
  private readonly pasta: string

  constructor(config: ConfigService) {
    this.pasta = resolve(
      config.get<string>('CARTOES_DIR') ?? join(process.cwd(), '..', '..', 'cartoes-temporarios'),
    )
  }

  /**
   * Guarda a fotografia normalizada e devolve as medidas REAIS.
   *
   * `rotate()` sem argumento aplica a orientação do EXIF e é a primeira coisa a
   * acontecer. A máquina do telemóvel grava quase sempre na horizontal e diz no
   * EXIF que está de lado; quem ler as medidas antes de rodar fica com a
   * largura e a altura trocadas, e o enquadramento inteiro sai errado — a
   * fotografia aparece deitada dentro da moldura e ninguém percebe porquê.
   *
   * Os metadados são retirados a seguir. Uma fotografia de telemóvel traz o
   * GPS de onde foi tirada, e isso é a casa da criança. Não há razão nenhuma
   * para essa coordenada continuar viagem até à gráfica.
   */
  async guardarFoto(pedidoId: string, criancaId: string, ficheiro: Express.Multer.File): Promise<FotoGuardada> {
    if (!ficheiro?.buffer?.length) throw new BadRequestException('Nenhuma foto recebida.')
    if (ficheiro.size > TAMANHO_MAXIMO_FOTO) {
      throw new BadRequestException('A foto passa de 12 MB. Envie uma versão menor.')
    }
    if (!TIPOS_ACEITES.has(ficheiro.mimetype)) {
      throw new BadRequestException('Formato não aceite. Envie JPG, PNG ou WEBP.')
    }

    let normalizada: Buffer
    let largura: number
    let altura: number
    try {
      const trabalho = sharp(ficheiro.buffer).rotate()
      const medidas = await trabalho.metadata()
      const maior = Math.max(medidas.width ?? 0, medidas.height ?? 0)

      normalizada = await (maior > LADO_MAXIMO
        ? trabalho.resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside' })
        : trabalho
      )
        .jpeg({ quality: 95 })
        .toBuffer()

      const finais = await sharp(normalizada).metadata()
      largura = finais.width ?? 0
      altura = finais.height ?? 0
    } catch {
      throw new BadRequestException('Não foi possível ler esta imagem. Tente outra foto.')
    }

    if (!largura || !altura) {
      throw new BadRequestException('Não foi possível ler as medidas desta imagem.')
    }

    const destino = join(this.pastaDoPedido(pedidoId), `${criancaId}-${randomUUID()}.jpg`)
    await mkdir(this.pastaDoPedido(pedidoId), { recursive: true })
    await writeFile(destino, normalizada)

    return { caminho: destino, largura, altura }
  }

  async guardarPdf(pedidoId: string, criancaId: string, conteudo: Buffer): Promise<string> {
    await mkdir(this.pastaDoPedido(pedidoId), { recursive: true })
    const destino = join(this.pastaDoPedido(pedidoId), `${criancaId}.pdf`)
    await writeFile(destino, conteudo)
    return destino
  }

  /**
   * Lê um ficheiro desta pasta e só desta pasta.
   *
   * A confirmação do prefixo não é paranóia decorativa: o caminho vem da base
   * de dados, e o dia em que alguém conseguir escrever `../../.env` numa
   * coluna, esta linha é a que impede que o ficheiro seja servido.
   */
  async ler(caminho: string | null | undefined): Promise<Buffer | null> {
    if (!caminho) return null
    const absoluto = resolve(caminho)
    if (!absoluto.startsWith(this.pasta)) {
      this.logger.warn(`Caminho fora da pasta de cartões recusado: ${caminho}`)
      return null
    }
    try {
      return await readFile(absoluto)
    } catch {
      return null
    }
  }

  async apagar(caminho: string | null | undefined): Promise<void> {
    if (!caminho) return
    const absoluto = resolve(caminho)
    if (!absoluto.startsWith(this.pasta)) return
    await rm(absoluto, { force: true })
  }

  /** Apaga tudo o que pertence a um pedido: fotos, PDFs e a própria pasta. */
  async apagarPedido(pedidoId: string): Promise<void> {
    await rm(this.pastaDoPedido(pedidoId), { recursive: true, force: true })
  }

  private pastaDoPedido(pedidoId: string): string {
    return join(this.pasta, pedidoId)
  }
}
