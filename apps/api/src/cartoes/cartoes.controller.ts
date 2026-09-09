import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request, Response } from 'express'
import { MeioDePagamento } from '@pv/db'
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsBoolean,
} from 'class-validator'
import { CartoesService } from './cartoes.service'
import { TAMANHO_MAXIMO_FOTO } from './armazenamento-de-cartoes.service'
import { AuthGuard, AuthOpcional } from '../identity/auth.guard'

class CriarPedidoDto {
  @IsInt() @Min(1) @Max(10) criancas!: number
}

class ActualizarCriancaDto {
  @IsOptional() @IsString() @MaxLength(40) nome?: string
  @IsOptional() @IsNumber() @Min(1) @Max(6) escala?: number
  @IsOptional() @IsNumber() @Min(-1) @Max(1) deslocX?: number
  @IsOptional() @IsNumber() @Min(-1) @Max(1) deslocY?: number
  @IsOptional() @IsNumber() @Min(0) @Max(1) tamanhoDoNome?: number
  @IsOptional() @IsBoolean() selecionada?: boolean
  @IsOptional() @IsBoolean() confirmada?: boolean
}

class PagarDto {
  @IsEnum(MeioDePagamento) meio!: MeioDePagamento
}

/**
 * O editor de cartões, do lado de quem compra.
 *
 * `AuthOpcional` em tudo, e é deliberado. A plataforma vive de quem chega pelo
 * QR sem conta nenhuma, e obrigar a registo antes de a mãe sequer ver o cartão
 * a personalizar mataria a compra na porta. Quando há sessão, o pedido fica
 * ligado à conta e ela reencontra-o depois; quando não há, o pedido vive pelo
 * seu identificador.
 */
@Controller('projects/:projectSlug/cartoes')
@UseGuards(AuthGuard)
@AuthOpcional()
export class CartoesController {
  constructor(private readonly cartoes: CartoesService) {}

  /** Os modelos activos, com a geometria que a prévia precisa. */
  @Get('modelos')
  modelos(@Param('projectSlug') projectSlug: string) {
    return this.cartoes.modelos(projectSlug)
  }

  /** O preço e o desconto em vigor, como o administrador os deixou. */
  @Get('preco')
  preco(@Param('projectSlug') projectSlug: string) {
    return this.cartoes.tabelaDePrecos(projectSlug)
  }

  @Post('pedidos')
  criarPedido(
    @Param('projectSlug') projectSlug: string,
    @Body() dto: CriarPedidoDto,
    @Req() req: Request,
  ) {
    return this.cartoes.criarPedido(projectSlug, dto.criancas, req.usuario?.id)
  }

  @Get('pedidos/:pedidoId')
  verPedido(@Param('pedidoId') pedidoId: string) {
    return this.cartoes.paraEcra(pedidoId)
  }

  /**
   * A fotografia da criança. A resposta traz o veredicto já feito.
   *
   * O limite do multer é a primeira barreira e existe para o ficheiro enorme
   * nem chegar a entrar em memória; o serviço volta a conferir, porque uma
   * verificação que vive só no transporte não protege quem chamar por outro
   * caminho.
   */
  @Post('pedidos/:pedidoId/criancas/:criancaId/foto')
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: TAMANHO_MAXIMO_FOTO } }))
  enviarFoto(
    @Param('pedidoId') pedidoId: string,
    @Param('criancaId') criancaId: string,
    @UploadedFile() foto: Express.Multer.File,
  ) {
    return this.cartoes.enviarFoto(pedidoId, criancaId, foto)
  }

  @Delete('pedidos/:pedidoId/criancas/:criancaId/foto')
  removerFoto(@Param('pedidoId') pedidoId: string, @Param('criancaId') criancaId: string) {
    return this.cartoes.removerFoto(pedidoId, criancaId)
  }

  @Patch('pedidos/:pedidoId/criancas/:criancaId')
  actualizar(
    @Param('pedidoId') pedidoId: string,
    @Param('criancaId') criancaId: string,
    @Body() dto: ActualizarCriancaDto,
  ) {
    return this.cartoes.actualizarCrianca(pedidoId, criancaId, dto)
  }

  /**
   * A fotografia, servida por rota e nunca por ficheiro estático.
   *
   * `no-store` porque é a fotografia de uma criança: não fica no disco de
   * nenhum intermediário nem no do próprio navegador depois de a página
   * fechar. O expurgo apaga a origem, e este cabeçalho evita que fiquem cópias
   * a sobreviver-lhe pelo caminho.
   */
  @Get('pedidos/:pedidoId/criancas/:criancaId/foto')
  async foto(
    @Param('pedidoId') pedidoId: string,
    @Param('criancaId') criancaId: string,
    @Res() res: Response,
  ) {
    const conteudo = await this.cartoes.fotoDaCrianca(pedidoId, criancaId)
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'no-store, private')
    res.send(conteudo)
  }

  /** A conferência: a mesma composição, feita pelo servidor, em baixa resolução. */
  @Get('pedidos/:pedidoId/criancas/:criancaId/previa/:modeloId.jpg')
  async previa(
    @Param('pedidoId') pedidoId: string,
    @Param('criancaId') criancaId: string,
    @Param('modeloId') modeloId: string,
    @Res() res: Response,
  ) {
    const conteudo = await this.cartoes.previa(pedidoId, criancaId, modeloId)
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'no-store, private')
    res.send(conteudo)
  }

  @Post('pedidos/:pedidoId/pagamento')
  pagar(@Param('pedidoId') pedidoId: string, @Body() dto: PagarDto) {
    return this.cartoes.iniciarPagamento(pedidoId, dto.meio)
  }

  /**
   * O PDF dos 7 cartões. Só sai depois do pagamento confirmado.
   *
   * `attachment` para o telemóvel guardar o ficheiro em vez de o abrir num
   * leitor embutido, que é de onde a mãe não o consegue reenviar à gráfica.
   */
  @Get('pedidos/:pedidoId/criancas/:criancaId/cartoes.pdf')
  async pdf(
    @Param('pedidoId') pedidoId: string,
    @Param('criancaId') criancaId: string,
    @Res() res: Response,
  ) {
    const { nome, conteudo } = await this.cartoes.pdfDaCrianca(pedidoId, criancaId)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`)
    res.setHeader('Cache-Control', 'no-store, private')
    res.send(conteudo)
  }
}
