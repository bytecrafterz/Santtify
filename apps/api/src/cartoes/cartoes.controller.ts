import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { MeioDePagamento } from '@pv/db'
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { CartoesService } from './cartoes.service'
import { AuthGuard, AuthOpcional } from '../identity/auth.guard'
import { ANON_COOKIE } from '../common/http.util'

class CriarPedidoDto {
  /**
   * Quantas pessoas vão ter cartões. Chama-se `criancas` porque foi o primeiro
   * nome e mudá-lo partia quem já chama esta rota; com as categorias passou a
   * valer para qualquer público.
   */
  @IsInt() @Min(1) @Max(10) criancas!: number
  /** O slug da categoria: "criancas", "adultos". Vazio = a primeira com cartões. */
  @IsOptional() @IsString() @MaxLength(80) categoria?: string
  @IsOptional() @IsString() @MaxLength(10) idioma?: string
}

class PagarDto {
  @IsEnum(MeioDePagamento) meio!: MeioDePagamento
  /** Segue para o provedor, que o exige, e fica no pedido: é quem comprou. */
  @IsEmail({}, { message: 'Escreva um e-mail válido.' }) email!: string
  /** A caixa "Confirmo que revisei e aprovei o nome e a foto". Sem ela não se paga. */
  @IsOptional() @IsBoolean() aprovou?: boolean
  /** A caixa do responsável pela criança (LGPD, art. 14). Sem ela também não. */
  @IsOptional() @IsBoolean() consentiu?: boolean
}

class CodigoDto {
  @IsString() @MaxLength(20) codigo!: string
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

  /**
   * As categorias com cartões para comprar: Crianças, Adultos, e as que o
   * cliente criar no painel. Uma categoria sem cartões não aparece.
   */
  @Get('categorias')
  categorias(@Param('projectSlug') projectSlug: string, @Query('idioma') idioma?: string) {
    return this.cartoes.categorias(projectSlug, idioma || 'pt-BR')
  }

  /** Os modelos activos de uma categoria, com a geometria que a prévia precisa. */
  @Get('modelos')
  modelos(
    @Param('projectSlug') projectSlug: string,
    @Query('categoria') categoria?: string,
    @Query('idioma') idioma?: string,
  ) {
    return this.cartoes.modelos(projectSlug, idioma || 'pt-BR', categoria || undefined)
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
    return this.cartoes.criarPedido(
      projectSlug,
      dto.criancas,
      req.usuario?.id,
      dto.categoria,
      dto.idioma || 'pt-BR',
      // O cookie da visita: é por ele que se sabe que link de afiliado a trouxe.
      req.cookies?.[ANON_COOKIE] ?? null,
    )
  }

  @Get('pedidos/:pedidoId')
  verPedido(@Param('pedidoId') pedidoId: string) {
    return this.cartoes.paraEcra(pedidoId)
  }

  @Post('pedidos/:pedidoId/pagamento')
  pagar(@Param('pedidoId') pedidoId: string, @Body() dto: PagarDto, @Req() req: Request) {
    return this.cartoes.iniciarPagamento(
      pedidoId,
      dto.meio,
      dto.email,
      dto.aprovou === true,
      dto.consentiu === true,
      { userId: req.usuario?.id ?? null, anonId: req.cookies?.[ANON_COOKIE] ?? null },
    )
  }

  /**
   * As artes de impressão, para o aparelho montar o PDF — com o código de
   * liberação, num pedido pago.
   *
   * DESDE 03/10 NÃO HÁ ROTAS DE FOTO NEM DE PDF. Recebiam a foto da criança,
   * serviam-na, e serviam o PDF montado aqui; o cliente pediu que a foto não
   * saísse do telemóvel e que o servidor guardasse só o pagamento e o código.
   * Quem as chamar recebe 404, que é a verdade: já não existem.
   */
  @Get('pedidos/:pedidoId/liberacao')
  liberacao(@Param('pedidoId') pedidoId: string, @Query('codigo') codigo = '') {
    return this.cartoes.liberacao(pedidoId, codigo)
  }

  /** O aparelho gerou o PDF. Vai o código, e nada mais. */
  @Post('pedidos/:pedidoId/gerado')
  @HttpCode(204)
  async gerado(@Param('pedidoId') pedidoId: string, @Body() dto: CodigoDto) {
    await this.cartoes.marcarGerado(pedidoId, dto.codigo)
  }
}
