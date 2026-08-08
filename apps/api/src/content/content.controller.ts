import { Controller, Get, Header, Param, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ContentService } from './content.service'

/**
 * Leitura pública do conteúdo. Sem autenticação: a página da letra é aberta
 * por quem escaneia o QR, que na maioria das vezes ainda não tem conta.
 */
@Controller('projects/:projectSlug')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  projeto(@Param('projectSlug') projectSlug: string) {
    return this.content.projeto(projectSlug)
  }

  @Get('contents')
  listar(@Param('projectSlug') projectSlug: string) {
    return this.content.listar(projectSlug)
  }

  @Get('contents/:contentSlug')
  porSlug(
    @Param('projectSlug') projectSlug: string,
    @Param('contentSlug') contentSlug: string,
  ) {
    return this.content.porSlug(projectSlug, contentSlug)
  }

  @Get('contents/:contentSlug/qr.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=86400')
  async qr(
    @Param('projectSlug') projectSlug: string,
    @Param('contentSlug') contentSlug: string,
    @Res() res: Response,
  ) {
    const svg = await this.content.qrSvg(projectSlug, contentSlug)
    return res.send(svg)
  }
}
