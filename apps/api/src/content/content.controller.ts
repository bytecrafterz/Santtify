import { Controller, Get, Header, Param, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ContentService } from './content.service'
import { LaunchesService } from './launches.service'

/**
 * Leitura pública do conteúdo. Sem autenticação: a página da letra é aberta
 * por quem escaneia o QR, que na maioria das vezes ainda não tem conta.
 */
@Controller('projects/:projectSlug')
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly launches: LaunchesService,
  ) {}

  /** Vitrine de próximos produtos — a aba "Meus Lançamentos" do perfil. */
  @Get('launches')
  lancamentos(@Param('projectSlug') projectSlug: string) {
    return this.launches.listar(projectSlug)
  }

  @Get()
  projeto(@Param('projectSlug') projectSlug: string) {
    return this.content.projeto(projectSlug)
  }

  /** Fila de reprodução contínua do projeto, do A ao Z. */
  @Get('playlist')
  playlist(@Param('projectSlug') projectSlug: string) {
    return this.content.playlist(projectSlug)
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
