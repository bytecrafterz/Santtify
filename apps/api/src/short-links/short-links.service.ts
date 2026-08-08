import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Platform, ShortLink, ShortLinkKind } from '@pv/db'
import { randomBytes } from 'node:crypto'
import * as QRCode from 'qrcode'
import { PrismaService } from '../prisma/prisma.service'

/** Alfabeto sem caracteres ambíguos (0/O, 1/l/I) — o código é lido por humanos. */
const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/**
 * Links curtos e QR Codes.
 *
 * Uma tabela para três usos — QR de conteúdo, link de campanha e link de
 * compartilhamento — porque os três precisam da mesma coisa: ser rastreáveis e
 * encadeáveis. É o encadeamento (`parent`, `root`, `depth`) que torna a árvore
 * de propagação reconstruível sem que a tela exista.
 */
@Injectable()
export class ShortLinksService {
  private readonly logger = new Logger(ShortLinksService.name)
  private readonly base: string
  private readonly webUrl: string

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.base = config.getOrThrow<string>('PUBLIC_SHORTLINK_BASE').replace(/\/$/, '')
    this.webUrl = config.getOrThrow<string>('PUBLIC_WEB_URL').replace(/\/$/, '')
  }

  urlPublica(code: string): string {
    return `${this.base}/${code}`
  }

  /**
   * QR Code de um conteúdo. Gerado automaticamente na publicação — o cliente
   * nunca fornece QR pronto, foi o ponto que ele fez questão de esclarecer.
   */
  async criarQrDeConteudo(params: {
    projectId: string
    contentId: string
    projectSlug: string
    contentSlug: string
  }): Promise<ShortLink> {
    const existente = await this.prisma.shortLink.findFirst({
      where: { contentId: params.contentId, kind: ShortLinkKind.CONTENT_QR, active: true },
    })
    if (existente) return existente

    const code = await this.gerarCodigoUnico()
    const targetUrl = `${this.webUrl}/${params.projectSlug}/${params.contentSlug}`

    const link = await this.prisma.shortLink.create({
      data: {
        projectId: params.projectId,
        code,
        kind: ShortLinkKind.CONTENT_QR,
        contentId: params.contentId,
        targetUrl,
        depth: 0,
        rootPlatform: Platform.QR_CODE,
        qrSvg: await this.gerarQrSvg(this.urlPublica(code)),
      },
    })

    // Raiz da própria cadeia.
    return this.prisma.shortLink.update({
      where: { id: link.id },
      data: { rootShortLinkId: link.id },
    })
  }

  /** Link de uma campanha/post/vídeo — o identificador próprio por publicação. */
  async criarLinkDeCampanha(params: {
    projectId: string
    campaignId: string
    platform: Platform
    targetPath?: string
  }): Promise<ShortLink> {
    const code = await this.gerarCodigoUnico()
    const targetUrl = `${this.webUrl}${params.targetPath ?? '/'}`

    const link = await this.prisma.shortLink.create({
      data: {
        projectId: params.projectId,
        code,
        kind: ShortLinkKind.CAMPAIGN,
        campaignId: params.campaignId,
        targetUrl,
        depth: 0,
        rootPlatform: params.platform,
        qrSvg: await this.gerarQrSvg(this.urlPublica(code)),
      },
    })

    return this.prisma.shortLink.update({
      where: { id: link.id },
      data: { rootShortLinkId: link.id },
    })
  }

  /**
   * Link de compartilhamento — o mecanismo que mede a propagação de pessoa
   * para pessoa sem precisar entrar em nenhuma conversa privada.
   *
   * `linkDeOrigemId` é o link pelo qual QUEM COMPARTILHA havia chegado. É essa
   * aresta que preserva a cadeia: quem compartilha herda a raiz e soma 1 na
   * profundidade.
   */
  async criarCompartilhamento(params: {
    projectId: string
    contentId: string
    userId: string
    channel: Platform
    linkDeOrigemId?: string | null
    targetPath: string
  }): Promise<ShortLink> {
    const origem = params.linkDeOrigemId
      ? await this.prisma.shortLink.findUnique({ where: { id: params.linkDeOrigemId } })
      : null

    const code = await this.gerarCodigoUnico()

    const link = await this.prisma.shortLink.create({
      data: {
        projectId: params.projectId,
        code,
        kind: ShortLinkKind.SHARE,
        contentId: params.contentId,
        createdByUserId: params.userId,
        channel: params.channel,

        parentShortLinkId: origem?.id ?? null,
        // Sem origem conhecida, o próprio compartilhamento vira raiz e a
        // plataforma passa a ser a propagação interna do Produto Vivo.
        rootShortLinkId: origem?.rootShortLinkId ?? origem?.id ?? null,
        rootPlatform: origem?.rootPlatform ?? Platform.PRODUTO_VIVO,
        depth: (origem?.depth ?? 0) + 1,

        targetUrl: `${this.webUrl}${params.targetPath}`,
      },
    })

    if (!link.rootShortLinkId) {
      return this.prisma.shortLink.update({
        where: { id: link.id },
        data: { rootShortLinkId: link.id },
      })
    }
    return link
  }

  /** Resolve um código para o destino, contabilizando o clique. */
  async resolver(code: string): Promise<ShortLink> {
    const link = await this.prisma.shortLink.findUnique({ where: { code } })
    if (!link || !link.active) throw new NotFoundException('Link não encontrado')
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new NotFoundException('Link expirado')
    }

    // Contador quente; a contagem auditável vem dos eventos.
    await this.prisma.shortLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    })

    return link
  }

  async gerarQrSvg(url: string): Promise<string> {
    return QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
    })
  }

  /**
   * Código curto único. Tenta algumas vezes antes de alargar — colisão em 7
   * caracteres desse alfabeto é remota, mas silenciar uma seria pior.
   */
  private async gerarCodigoUnico(tamanho = 7, tentativas = 5): Promise<string> {
    for (let i = 0; i < tentativas; i++) {
      const code = this.codigoAleatorio(tamanho)
      const existe = await this.prisma.shortLink.findUnique({
        where: { code },
        select: { id: true },
      })
      if (!existe) return code
      this.logger.warn(`Colisão de código curto em ${tamanho} caracteres, tentando de novo`)
    }
    return this.gerarCodigoUnico(tamanho + 1, tentativas)
  }

  private codigoAleatorio(tamanho: number): string {
    const bytes = randomBytes(tamanho)
    return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')
  }
}
