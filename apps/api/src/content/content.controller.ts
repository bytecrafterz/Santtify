import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common'
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
  porSlug(@Param('projectSlug') projectSlug: string, @Param('contentSlug') contentSlug: string) {
    return this.content.porSlug(projectSlug, contentSlug)
  }

  @Get('categories')
  categorias(@Param('projectSlug') projectSlug: string) {
    return this.content.categoriasDoProjeto(projectSlug)
  }

  @Get('people')
  pessoas(@Param('projectSlug') projectSlug: string) {
    return this.content.pessoasDoProjeto(projectSlug)
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

  /**
   * O cartão da letra como ficheiro A4, para imprimir ou para a gráfica.
   *
   * `?baixar=1` muda só o cabeçalho: sem ele o navegador abre o PDF e o botão
   * de imprimir do próprio leitor sai numa folha; com ele, guarda o ficheiro.
   * É o mesmo PDF nos dois casos, e é isso que faz a impressão bater certo com
   * o que foi enviado ao designer.
   *
   * Sem sessão de propósito: quem tem o cartão na mão e leu o QR não tem conta
   * nenhuma, e o cartão de impressão é a arte que já está pública na letra.
   */
  @Get('contents/:contentSlug/cartao.pdf')
  async cartaoPdf(
    @Param('projectSlug') projectSlug: string,
    @Param('contentSlug') contentSlug: string,
    @Query('baixar') baixar: string | undefined,
    @Res() res: Response,
  ) {
    const { pdf, nome } = await this.content.cartaoEmPdf(projectSlug, contentSlug)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('Content-Disposition', `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`)
    return res.send(pdf)
  }
}
