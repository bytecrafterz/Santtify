import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { MediaKind } from '@pv/db'

/**
 * Armazenamento de mídia.
 *
 * Hoje grava em disco local. A interface existe para que trocar por S3,
 * Cloudflare R2 ou similar seja substituir esta classe, não caçar caminhos de
 * arquivo espalhados pelo código.
 *
 * ATENÇÃO OPERACIONAL: disco local não sobrevive a recriação de container nem
 * escala para mais de uma máquina. Para 26 letras com música e áudio isso
 * funciona, mas a pasta precisa ser volume persistente com backup. Está
 * anotado no README como decisão a revisitar antes de crescer.
 */

/** Tipos aceitos, por extensão e MIME. Nada fora desta lista entra. */
const PERMITIDOS: Record<string, { kind: MediaKind; exts: string[] }> = {
  'audio/mpeg': { kind: MediaKind.AUDIO, exts: ['.mp3'] },
  'audio/mp4': { kind: MediaKind.AUDIO, exts: ['.m4a', '.mp4'] },
  'audio/x-m4a': { kind: MediaKind.AUDIO, exts: ['.m4a'] },
  'audio/aac': { kind: MediaKind.AUDIO, exts: ['.aac', '.m4a'] },
  'audio/ogg': { kind: MediaKind.AUDIO, exts: ['.ogg', '.oga'] },
  'audio/wav': { kind: MediaKind.AUDIO, exts: ['.wav'] },
  'audio/x-wav': { kind: MediaKind.AUDIO, exts: ['.wav'] },
  'video/mp4': { kind: MediaKind.VIDEO, exts: ['.mp4', '.m4v'] },
  'video/quicktime': { kind: MediaKind.VIDEO, exts: ['.mov'] },
  'video/webm': { kind: MediaKind.VIDEO, exts: ['.webm'] },
  'image/jpeg': { kind: MediaKind.IMAGE, exts: ['.jpg', '.jpeg'] },
  'image/png': { kind: MediaKind.IMAGE, exts: ['.png'] },
  'image/webp': { kind: MediaKind.IMAGE, exts: ['.webp'] },
  'image/heic': { kind: MediaKind.IMAGE, exts: ['.heic'] },
  // O PDF do cartão que a família imprime em casa. Entra como está: é material
  // para impressão, então reduzir ou recomprimir estragaria justamente o que
  // ele serve para fazer.
  'application/pdf': { kind: MediaKind.DOCUMENT, exts: ['.pdf'] },
}

/** 100 MB. Música de qualidade gravada no iPhone passa fácil de 20 MB. */
export const TAMANHO_MAXIMO = 100 * 1024 * 1024

/**
 * 12 MB para foto enviada por usuário.
 *
 * Foto de celular moderno fica entre 2 e 8 MB; 12 dá folga sem deixar alguém
 * ocupar o disco com um arquivo enorme. O limite de 100 MB continua valendo
 * para o painel, onde quem envia é o próprio cliente mandando música.
 */
export const TAMANHO_MAXIMO_IMAGEM = 12 * 1024 * 1024

/**
 * Largura da imagem servida no site.
 *
 * 1200px cobre com folga a maior tela de celular em densidade dupla, que é onde
 * o produto é usado. A arte que o cliente manda vem do arquivo de impressão,
 * com 4419px de largura e quase 10 MB — 27 vezes maior do que o necessário para
 * ser vista num telefone.
 */
const LARGURA_WEB = 1200

/**
 * A largura para papel: 2480px é uma folha A4 a 300 dpi.
 *
 * A redução para 1200px é certa para o telemóvel e errada para a impressora.
 * A arte dele chega com 4419px de largura porque vem do ficheiro de impressão;
 * guardada só a 1200px, sai em A4 a cerca de 100 dpi, e nota-se no papel. Fica
 * uma segunda cópia, mais pesada, que só é lida quando alguém pede o PDF —
 * quem abre a página continua a receber a de 1200px.
 *
 * Só se escreve quando há resolução a preservar. Uma fotografia de perfil de
 * 800px não ganha nada em ser guardada duas vezes.
 */
const LARGURA_IMPRESSAO = 2480

/** O nome da cópia para papel, a partir do nome da que vai para o ecrã. */
export function nomeParaImpressao(nomeWeb: string): string {
  return nomeWeb.replace(/\.[^.]+$/, '') + '-impressao.jpg'
}

/**
 * Cartão de compartilhamento: 1200x630, a proporção que WhatsApp, Facebook e
 * Instagram usam na prévia do link.
 *
 * Existe separado porque a arte das letras é retrato A4, e o recorte que essas
 * plataformas fazem numa imagem alta corta justamente a marca no topo e o selo
 * embaixo. Aqui a imagem inteira é encaixada dentro do cartão, com o fundo
 * preenchido pela cor média da própria arte, e nada é perdido.
 */
const CARTAO = { largura: 1200, altura: 630 }

export interface ArquivoSalvo {
  url: string
  kind: MediaKind
  mimeType: string
  sizeBytes: number
  nomeOriginal: string
  /** Cartão 1200x630 para a prévia do link, só quando é imagem. */
  urlCartao?: string
  largura?: number
  altura?: number
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly pasta: string
  private readonly baseUrl: string

  constructor(config: ConfigService) {
    this.pasta = config.get<string>('UPLOAD_DIR') ?? join(process.cwd(), '..', '..', 'uploads')
    this.baseUrl = (config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3333').replace(
      /\/$/,
      '',
    )
  }

  tipoDe(mimeType: string): MediaKind | null {
    return PERMITIDOS[mimeType]?.kind ?? null
  }

  /**
   * Conserta o nome do arquivo enviado.
   *
   * O Multer entrega `originalname` interpretado como latin1, então um arquivo
   * chamado "diário.jpg" chega como "diÃ¡rio.jpg". Esse nome vira o título da
   * mídia e aparece na tela do painel — e o cliente escreve em português, com
   * acento, em praticamente todos os 26 arquivos.
   */
  private nomeLegivel(bruto: string): string {
    try {
      const convertido = Buffer.from(bruto, 'latin1').toString('utf8')
      // Só aceita a conversão se ela não produziu caractere de substituição.
      return convertido.includes('\uFFFD') ? bruto : convertido
    } catch {
      return bruto
    }
  }

  /**
   * Guarda material para imprimir, aceitando PDF ou fotografia.
   *
   * Pedido dele em 20/08, e a razão é prática: os cartões dele estão guardados
   * como imagens no telemóvel, e o iPhone, quando o campo só aceita PDF, abre
   * os Ficheiros em vez das Fotos. A pessoa fica a olhar para uma pasta vazia
   * sem perceber porquê.
   *
   * A fotografia é convertida aqui e não no telemóvel dele. Pedir a alguém que
   * converta imagem em PDF antes de enviar é pedir que desista.
   *
   * A página é A4 e a imagem entra inteira, centrada, sem cortar. Quem vai
   * imprimir isto é uma gráfica ou uma impressora de casa, e ambas trabalham
   * em folha; uma página do tamanho da fotografia sairia com margens
   * imprevisíveis conforme o aparelho.
   */
  async salvarComoPdf(arquivo: Express.Multer.File): Promise<ArquivoSalvo> {
    if (arquivo.mimetype === 'application/pdf') return this.salvar(arquivo)

    if (this.tipoDe(arquivo.mimetype) !== MediaKind.IMAGE) {
      throw new BadRequestException(
        'Envie um PDF ou uma imagem (JPG, PNG, HEIC) para o material grátis.',
      )
    }

    // Passa sempre por JPEG: o PDF só sabe embutir JPEG e PNG, e o HEIC do
    // iPhone não é nenhum dos dois.
    const jpeg = await sharp(arquivo.buffer).rotate().jpeg({ quality: 90 }).toBuffer()

    const pdf = await PDFDocument.create()
    const A4 = { largura: 595.28, altura: 841.89 }
    const pagina = pdf.addPage([A4.largura, A4.altura])
    const imagem = await pdf.embedJpg(jpeg)

    const escala = Math.min(A4.largura / imagem.width, A4.altura / imagem.height)
    const l = imagem.width * escala
    const a = imagem.height * escala
    pagina.drawImage(imagem, {
      x: (A4.largura - l) / 2,
      y: (A4.altura - a) / 2,
      width: l,
      height: a,
    })

    const bytes = Buffer.from(await pdf.save())
    const base = this.nomeLegivel(arquivo.originalname).replace(/\.[^.]+$/, '')
    return this.salvar({
      ...arquivo,
      buffer: bytes,
      size: bytes.length,
      mimetype: 'application/pdf',
      originalname: `${base}.pdf`,
    } as Express.Multer.File)
  }

  /**
   * Descobre o tipo pela EXTENSÃO quando o aparelho não o declara.
   *
   * O iPhone, ao escolher um ficheiro em Ficheiros em vez de na galeria,
   * manda-o muitas vezes como `application/octet-stream` — quer dizer apenas
   * "uns bytes", não é um tipo. O servidor recusava, e do lado dele parecia
   * que o áudio não era aceite. Eu próprio bati nisto ao enviar um mp3 por
   * linha de comando.
   *
   * O nome do ficheiro é o que sobra, e chega: só se aceita se a extensão for
   * uma das que já estavam na lista.
   */
  private tipoPelaExtensao(nome: string): string | null {
    const ext = extname(this.nomeLegivel(nome)).toLowerCase()
    if (!ext) return null
    for (const [mime, dados] of Object.entries(PERMITIDOS)) {
      if (dados.exts.includes(ext)) return mime
    }
    return null
  }

  /**
   * Lê do disco um ficheiro que já servimos, a partir do endereço público.
   *
   * O ENDEREÇO É DE FORA e por isso não se confia nele. Só se aceita o que
   * vier depois de `/uploads/`, e o caminho resolvido tem de continuar dentro
   * da pasta de uploads — um `..` a meio transformaria isto numa porta para ler
   * qualquer ficheiro do servidor.
   */
  async lerPelaUrl(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null
    const marca = '/uploads/'
    const i = url.indexOf(marca)
    if (i < 0) return null

    const relativo = url.slice(i + marca.length).split('?')[0]
    const caminho = resolve(join(this.pasta, relativo))
    if (!caminho.startsWith(resolve(this.pasta))) {
      this.logger.warn(`Caminho fora da pasta de uploads recusado: ${relativo}`)
      return null
    }
    try {
      return await readFile(caminho)
    } catch {
      return null
    }
  }

  /**
   * O melhor que temos desta imagem para pôr em papel.
   *
   * Tenta primeiro a cópia de 2480px e cai na de 1200px quando ela não existe —
   * e não existe em tudo o que foi enviado antes de 26/08, nem no que já veio
   * pequeno de origem. Cair para trás é melhor do que recusar: uma folha um
   * pouco mais macia imprime-se, um erro não.
   */
  async lerParaImpressao(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null
    return (await this.lerPelaUrl(nomeParaImpressao(url))) ?? (await this.lerPelaUrl(url))
  }

  /**
   * Uma imagem numa página A4, para imprimir.
   *
   * A4 EM PONTOS e a imagem no tamanho original: o PDF guarda a imagem como
   * ela é e diz onde a desenhar. Não há redução nenhuma pelo caminho, e é por
   * isso que sai com a qualidade da arte que ele enviou — o que o cliente pediu
   * em 26/08 quando disse que ia mandar o ficheiro para a gráfica.
   *
   * A conversão para JPEG existe porque um PDF só sabe embutir JPEG e PNG, e o
   * que sai do iPhone muitas vezes não é nenhum dos dois. A qualidade fica em
   * 95: acima disso o ficheiro cresce sem se ver diferença no papel.
   */
  async imagemEmPdfA4(imagem: Buffer): Promise<Buffer> {
    const jpeg = await sharp(imagem).rotate().jpeg({ quality: 95 }).toBuffer()
    const pdf = await PDFDocument.create()
    const A4 = { largura: 595.28, altura: 841.89 }
    const pagina = pdf.addPage([A4.largura, A4.altura])
    const embutida = await pdf.embedJpg(jpeg)

    // Cabe inteira e centrada. Encher a página cortaria a arte, e uma arte
    // cortada é exactamente a queixa dele sobre a impressão do navegador.
    const escala = Math.min(A4.largura / embutida.width, A4.altura / embutida.height)
    const l = embutida.width * escala
    const a = embutida.height * escala
    pagina.drawImage(embutida, {
      x: (A4.largura - l) / 2,
      y: (A4.altura - a) / 2,
      width: l,
      height: a,
    })
    return Buffer.from(await pdf.save())
  }

  async salvar(arquivo: Express.Multer.File): Promise<ArquivoSalvo> {
    const generico = arquivo.mimetype === 'application/octet-stream' || !arquivo.mimetype
    if (generico) {
      const adivinhado = this.tipoPelaExtensao(arquivo.originalname)
      if (adivinhado) arquivo = { ...arquivo, mimetype: adivinhado } as Express.Multer.File
    }

    const permitido = PERMITIDOS[arquivo.mimetype]
    if (!permitido) {
      throw new BadRequestException(
        `Tipo de arquivo não aceito (${arquivo.mimetype}). Envie áudio, vídeo ou imagem.`,
      )
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      throw new BadRequestException(
        `Arquivo muito grande (${Math.round(arquivo.size / 1024 / 1024)} MB). O limite é 100 MB.`,
      )
    }

    // O nome do arquivo NUNCA vem do usuário: nome enviado pode conter ../ ou
    // caracteres que quebram o caminho. Guardamos o original só como metadado.
    const ext = this.extensaoSegura(arquivo.originalname, permitido.exts)
    const nome = `${Date.now().toString(36)}_${randomBytes(8).toString('hex')}${ext}`

    // Subpasta por ano/mês evita um diretório com milhares de arquivos.
    const agora = new Date()
    const subpasta = `${agora.getUTCFullYear()}/${String(agora.getUTCMonth() + 1).padStart(2, '0')}`
    const destino = join(this.pasta, subpasta)

    await mkdir(destino, { recursive: true })

    if (permitido.kind === MediaKind.IMAGE) {
      return this.salvarImagem(arquivo, destino, subpasta, nome)
    }

    await writeFile(join(destino, nome), arquivo.buffer)
    this.logger.log(`Mídia salva: ${subpasta}/${nome} (${arquivo.mimetype}, ${arquivo.size} B)`)

    return {
      url: `${this.baseUrl}/uploads/${subpasta}/${nome}`,
      kind: permitido.kind,
      mimeType: arquivo.mimetype,
      sizeBytes: arquivo.size,
      nomeOriginal: this.nomeLegivel(arquivo.originalname),
    }
  }

  /**
   * Imagem entra sempre reduzida, e o original NÃO é guardado.
   *
   * O cliente manda o arquivo de impressão porque é o que ele tem — e é o certo
   * que ele mande, para não precisar manter duas exportações de cada uma das 26
   * letras e errar em alguma. Quem tem de resolver isso é o servidor, uma vez,
   * e não uma pessoa, 26 vezes.
   *
   * Guardar também o original custaria 250 MB para nada: quem quer a arte em
   * alta tem o PDF. O que fica é o que o site precisa.
   *
   * O cartão de compartilhamento é gerado aqui junto, e não na hora de
   * compartilhar: a prévia do WhatsApp é buscada por um robô que não espera, e
   * gerar imagem no meio dessa requisição é a diferença entre o cartão aparecer
   * e o link sair pelado.
   */
  private async salvarImagem(
    arquivo: Express.Multer.File,
    destino: string,
    subpasta: string,
    nome: string,
  ): Promise<ArquivoSalvo> {
    const base = nome.replace(/\.[^.]+$/, '')
    const nomeWeb = `${base}.jpg`
    const nomeCartao = `${base}-cartao.jpg`

    let entrada: sharp.Sharp
    let meta: sharp.Metadata
    try {
      entrada = sharp(arquivo.buffer, { failOn: 'none' }).rotate()
      meta = await entrada.metadata()
    } catch {
      throw new BadRequestException('Não foi possível ler esta imagem. Tente JPG ou PNG.')
    }

    const corpo = await entrada
      .clone()
      .resize({ width: LARGURA_WEB, withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toBuffer()
    await writeFile(join(destino, nomeWeb), corpo)

    // A cor média da arte preenche as laterais do cartão. Barra preta ou branca
    // ao lado de uma ilustração colorida parece defeito de montagem.
    const { dominant } = await entrada.clone().stats()
    const cartao = await entrada
      .clone()
      .resize({
        width: CARTAO.largura,
        height: CARTAO.altura,
        fit: 'contain',
        background: dominant,
      })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toBuffer()
    await writeFile(join(destino, nomeCartao), cartao)

    // A cópia para papel, quando o que ele enviou tem mais do que o ecrã precisa.
    if ((meta.width ?? 0) > LARGURA_WEB) {
      const paraPapel = await entrada
        .clone()
        .resize({ width: LARGURA_IMPRESSAO, withoutEnlargement: true })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer()
      await writeFile(join(destino, nomeParaImpressao(nomeWeb)), paraPapel)
    }

    const original = arquivo.size
    this.logger.log(
      `Imagem reduzida: ${subpasta}/${nomeWeb} — ` +
        `${meta.width}x${meta.height} ${(original / 1024 / 1024).toFixed(1)} MB → ` +
        `${LARGURA_WEB}px ${(corpo.length / 1024).toFixed(0)} KB ` +
        `(${(original / corpo.length).toFixed(0)}x menor), cartão ${(cartao.length / 1024).toFixed(0)} KB`,
    )

    const proporcao = meta.width && meta.height ? meta.height / meta.width : 1
    return {
      url: `${this.baseUrl}/uploads/${subpasta}/${nomeWeb}`,
      urlCartao: `${this.baseUrl}/uploads/${subpasta}/${nomeCartao}`,
      kind: MediaKind.IMAGE,
      mimeType: 'image/jpeg',
      sizeBytes: corpo.length,
      nomeOriginal: this.nomeLegivel(arquivo.originalname),
      largura: Math.min(LARGURA_WEB, meta.width ?? LARGURA_WEB),
      altura: Math.round(Math.min(LARGURA_WEB, meta.width ?? LARGURA_WEB) * proporcao),
    }
  }

  private extensaoSegura(nomeOriginal: string, permitidas: string[]): string {
    const ext = extname(nomeOriginal).toLowerCase()
    return permitidas.includes(ext) ? ext : permitidas[0]
  }
}
