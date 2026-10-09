import { Controller, Get, Header, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { ContentService } from './content.service'
import { LaunchesService } from './launches.service'
import { AdminGuard, AuthGuard } from '../identity/auth.guard'

/**
 * "attachment; filename=…" com o nome que o painel pediu.
 *
 * O nome vem do título do cartão, com acentos e espaços: vai em ASCII limpo no
 * `filename` (que todos os navegadores entendem) e inteiro no `filename*`.
 */
function anexo(nome: string | undefined, blocoId: string, extensao: 'png' | 'svg'): string {
  const base = (nome ?? '').trim().slice(0, 80) || `publicacao-${blocoId.slice(0, 8)}`
  const ascii =
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'publicacao'
  return `attachment; filename="qr-${ascii}.${extensao}"; filename*=UTF-8''${encodeURIComponent(`qr-${base}.${extensao}`)}`
}

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

  /**
   * A LISTA COMPLETA DE QUEM SE REGISTOU É SÓ DO RESPONSÁVEL.
   *
   * Esta rota estava aberta a toda a gente, e é a única deste ficheiro que
   * fica fechada. Ele pediu-o em 26/08 e a razão é a certa numa plataforma com
   * crianças: chegar ao perfil de alguém por uma curtida ou por um comentário
   * continua livre, porque ali houve um acto público daquela pessoa que leva
   * até ela; uma lista de toda a gente não tem acto nenhum por trás.
   *
   * As duas guardas juntas, como em todo o painel: sessão válida e papel de
   * administrador. Sem as duas isto responderia a qualquer pessoa com conta.
   */
  @Get('people')
  @UseGuards(AuthGuard, AdminGuard)
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

  /** A folha em resolução de papel, para imprimir sem sair da página. */
  @Get('contents/:contentSlug/cartao.jpg')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'public, max-age=300')
  async cartaoImagem(
    @Param('projectSlug') projectSlug: string,
    @Param('contentSlug') contentSlug: string,
    @Res() res: Response,
  ) {
    return res.send(await this.content.cartaoEmImagem(projectSlug, contentSlug))
  }

  /** O mesmo QR em PNG, para enviar por mensagem. Ver a nota no serviço. */
  @Get('contents/:contentSlug/qr.png')
  async qrPng(
    @Param('projectSlug') projectSlug: string,
    @Param('contentSlug') contentSlug: string,
    @Query('baixar') baixar: string | undefined,
    @Res() res: Response,
  ) {
    const png = await this.content.qrPng(projectSlug, contentSlug)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    if (baixar) {
      res.setHeader('Content-Disposition', `attachment; filename="qr-${contentSlug}.png"`)
    }
    return res.send(png)
  }

  /**
   * O QR de UMA publicação (09/10), para o designer. Ver `qrDaPublicacaoSvg`.
   *
   * `?nome=` dá o nome do ficheiro descarregado — o painel manda o título do
   * cartão, para o designer não receber dez ficheiros "qr.png" iguais.
   */
  @Get('publicacoes/:blocoId/qr.svg')
  async qrDaPublicacao(
    @Param('projectSlug') projectSlug: string,
    @Param('blocoId', new ParseUUIDPipe()) blocoId: string,
    @Query('baixar') baixar: string | undefined,
    @Query('nome') nome: string | undefined,
    @Res() res: Response,
  ) {
    const svg = await this.content.qrDaPublicacaoSvg(projectSlug, blocoId)
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    if (baixar) res.setHeader('Content-Disposition', anexo(nome, blocoId, 'svg'))
    return res.send(svg)
  }

  @Get('publicacoes/:blocoId/qr.png')
  async qrDaPublicacaoPng(
    @Param('projectSlug') projectSlug: string,
    @Param('blocoId', new ParseUUIDPipe()) blocoId: string,
    @Query('baixar') baixar: string | undefined,
    @Query('nome') nome: string | undefined,
    @Res() res: Response,
  ) {
    const png = await this.content.qrDaPublicacaoPng(projectSlug, blocoId)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    if (baixar) res.setHeader('Content-Disposition', anexo(nome, blocoId, 'png'))
    return res.send(png)
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
