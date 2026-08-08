import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
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
}

/** 100 MB. Música de qualidade gravada no iPhone passa fácil de 20 MB. */
export const TAMANHO_MAXIMO = 100 * 1024 * 1024

export interface ArquivoSalvo {
  url: string
  kind: MediaKind
  mimeType: string
  sizeBytes: number
  nomeOriginal: string
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
    await writeFile(join(destino, nome), arquivo.buffer)

    this.logger.log(`Mídia salva: ${subpasta}/${nome} (${arquivo.mimetype}, ${arquivo.size} B)`)

    return {
      url: `${this.baseUrl}/uploads/${subpasta}/${nome}`,
      kind: permitido.kind,
      mimeType: arquivo.mimetype,
      sizeBytes: arquivo.size,
      nomeOriginal: arquivo.originalname,
    }
  }

  private extensaoSegura(nomeOriginal: string, permitidas: string[]): string {
    const ext = extname(nomeOriginal).toLowerCase()
    return permitidas.includes(ext) ? ext : permitidas[0]
  }
}
