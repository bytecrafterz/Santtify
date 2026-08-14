import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import sharp from 'sharp'
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

  async salvar(arquivo: Express.Multer.File): Promise<ArquivoSalvo> {
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
