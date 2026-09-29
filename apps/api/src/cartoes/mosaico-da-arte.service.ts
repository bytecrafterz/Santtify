import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../admin/storage.service'

const correr = promisify(execFile)

/** Os níveis, em dpi: o meio caminho e o do iPhone a 8×. */
const NIVEIS_DPI = [500, 1000]
/** O lado de cada ladrilho, em pixéis. */
const LADO = 512
/**
 * Um pixel de cada ladrilho repetido no vizinho. Sem ele, o Safari deixa às
 * vezes uma linha fina entre dois ladrilhos quando a lupa está ampliada.
 */
const SOBREPOSICAO = 1

export interface MosaicoDaArte {
  /** A pasta pública: cada ladrilho está em `{url}/{dpi}/{coluna}_{linha}.jpeg`. */
  url: string
  lado: number
  sobreposicao: number
  niveis: { dpi: number; largura: number; altura: number }[]
}

/**
 * A ARTE EM LADRILHOS, PARA A LUPA — como um mapa.
 *
 * "check again on iphone" — 29/09, com a caixa 1 desfocada a 8×. O iPhone
 * desenhava o PDF do designer no próprio telefone, e estas artes são pesadas
 * para isso: 283 grupos de transparência por página. Medido no motor do
 * Safari, 7 a 10 segundos por desenho, fosse qual fosse o tamanho; no Chrome
 * do computador, 3. Não há maneira de o telefone o fazer depressa.
 *
 * Então o servidor desenha uma vez, com o poppler (o mesmo que faz a JPEG de
 * 300 dpi da lupa, e por isso as mesmas cores), a 500 e a 1000 dpi, e corta em
 * ladrilhos de 512. A lupa pede só os que estão à vista, ao nível que o zoom
 * pede — é o que um mapa faz, e abre em fracções de segundo. 1000 dpi é a
 * nitidez de um iPhone (3 pixéis por ponto) a 8×.
 *
 * Custa, por arte, cerca de um minuto de processador e 14 MB, uma vez só. Corre
 * com a prioridade mais baixa, uma de cada vez: o servidor tem um núcleo, e o
 * site vem primeiro.
 *
 * NADA NA BASE DE DADOS. Os ladrilhos ficam ao lado do PDF, com o mesmo nome e
 * `-mosaico` no fim; um PDF novo tem um nome novo e faz a sua pasta. Uma pasta
 * sem o `mosaico.json` não conta: o trabalho é feito ao lado e só muda de nome
 * quando está completo.
 */
@Injectable()
export class MosaicoDaArteService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MosaicoDaArteService.name)
  private readonly prontos = new Map<string, MosaicoDaArte>()
  private readonly fila: string[] = []
  /** Os que falharam não voltam a ser tentados até a API reiniciar. */
  private readonly falhados = new Set<string>()
  private aTrabalhar = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * As artes que ainda não têm ladrilhos — as carregadas antes disto existir,
   * ou uma que falhou antes de reiniciar. Um minuto depois de arrancar, para
   * não disputar o processador com o próprio arranque.
   */
  onApplicationBootstrap() {
    setTimeout(() => void this.porEmDia().catch(() => {}), 60_000).unref()
  }

  async porEmDia() {
    const modelos = await this.prisma.modeloDeCartao.findMany({
      where: { arteImpressaoUrl: { endsWith: '.pdf', mode: 'insensitive' } },
      select: { arteImpressaoUrl: true },
    })
    for (const { arteImpressaoUrl: url } of modelos) {
      if (url && !this.de(url)) this.pedir(url)
    }
  }

  /** Os ladrilhos deste PDF, se já estão prontos. */
  de(pdfUrl: string | null | undefined): MosaicoDaArte | null {
    if (!pdfUrl || !/\.pdf$/i.test(pdfUrl)) return null
    const guardado = this.prontos.get(pdfUrl)
    if (guardado) return guardado
    const pdf = this.storage.caminhoDaUrl(pdfUrl)
    if (!pdf) return null
    try {
      const info = JSON.parse(readFileSync(join(pastaDe(pdf), 'mosaico.json'), 'utf8'))
      const mosaico: MosaicoDaArte = {
        url: pastaDe(pdfUrl),
        lado: info.lado,
        sobreposicao: info.sobreposicao,
        niveis: info.niveis,
      }
      this.prontos.set(pdfUrl, mosaico)
      return mosaico
    } catch {
      return null
    }
  }

  /** Põe um PDF na fila. Volta logo; o trabalho corre por trás. */
  pedir(pdfUrl: string) {
    if (this.falhados.has(pdfUrl) || this.fila.includes(pdfUrl) || this.de(pdfUrl)) return
    this.fila.push(pdfUrl)
    void this.andar()
  }

  private async andar() {
    if (this.aTrabalhar) return
    this.aTrabalhar = true
    try {
      for (let url = this.fila.shift(); url; url = this.fila.shift()) {
        try {
          await this.gerar(url)
        } catch (erro) {
          this.falhados.add(url)
          this.logger.error(`Ladrilhos de ${url} falharam: ${String((erro as Error)?.message ?? erro)}`)
        }
      }
    } finally {
      this.aTrabalhar = false
    }
  }

  private async gerar(pdfUrl: string) {
    const pdf = this.storage.caminhoDaUrl(pdfUrl)
    if (!pdf || !existsSync(pdf)) return
    const destino = pastaDe(pdf)
    if (existsSync(join(destino, 'mosaico.json'))) return

    const t0 = Date.now()
    // A obra fica na pasta dos uploads (mudar de nome é instantâneo no mesmo
    // disco); a página desenhada, que chega a 280 MB, fica na temporária.
    const obra = `${destino}.a-fazer`
    const rascunho = await mkdtemp(join(tmpdir(), 'mosaico-'))
    try {
      await rm(obra, { recursive: true, force: true })
      await mkdir(obra, { recursive: true })
      const niveis: MosaicoDaArte['niveis'] = []
      for (const dpi of NIVEIS_DPI) {
        const pagina = join(rascunho, 'pagina')
        // TIFF sem compressão: comprimir 97 milhões de pixéis para os ler logo
        // a seguir seria trabalho deitado fora.
        const desenhar = ['pdftoppm', '-r', String(dpi), '-f', '1', '-l', '1', '-singlefile',
          '-tiff', '-tiffcompression', 'none', pdf, pagina]
        // O `nice` não existe no Windows de quem desenvolve.
        const comando = process.platform === 'win32' ? desenhar : ['nice', '-n', '19', ...desenhar]
        await correr(comando[0], comando.slice(1), { timeout: 10 * 60_000 })
        const info = await sharp(`${pagina}.tif`, { limitInputPixels: false })
          .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
          .tile({ size: LADO, overlap: SOBREPOSICAO, layout: 'dz', depth: 'one' })
          .toFile(join(obra, `n${dpi}.dz`))
        // O libvips escreve `n{dpi}_files/0/{coluna}_{linha}.jpeg`; fica `{dpi}/`.
        await rename(join(obra, `n${dpi}_files`, '0'), join(obra, String(dpi)))
        await rm(join(obra, `n${dpi}_files`), { recursive: true, force: true })
        await rm(join(obra, `n${dpi}.dzi`), { force: true })
        await rm(`${pagina}.tif`, { force: true })
        niveis.push({ dpi, largura: info.width, altura: info.height })
      }
      await writeFile(
        join(obra, 'mosaico.json'),
        JSON.stringify({ lado: LADO, sobreposicao: SOBREPOSICAO, niveis }),
      )
      await rm(destino, { recursive: true, force: true })
      await rename(obra, destino)
      this.logger.log(`Ladrilhos de ${pdfUrl} prontos em ${Math.round((Date.now() - t0) / 1000)} s.`)
    } finally {
      await rm(rascunho, { recursive: true, force: true })
      await rm(obra, { recursive: true, force: true })
    }
  }
}

function pastaDe(pdf: string) {
  return pdf.replace(/\.pdf$/i, '-mosaico')
}
