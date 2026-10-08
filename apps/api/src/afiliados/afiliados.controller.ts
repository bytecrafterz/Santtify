import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { IsIn, IsString, MaxLength } from 'class-validator'
import type { Request } from 'express'
import { AuthGuard } from '../identity/auth.guard'
import { AfiliadosService } from './afiliados.service'
import { TIPOS_DE_CHAVE_PIX, type TipoDeChavePix } from './pix'

class PixDto {
  @IsIn(TIPOS_DE_CHAVE_PIX, { message: 'Escolha o tipo da chave Pix.' }) tipo!: TipoDeChavePix
  @IsString() @MaxLength(140) chave!: string
  @IsString() @MaxLength(120) titular!: string
}

/**
 * A área de afiliado de quem está com sessão — a do perfil.
 *
 * Tudo aqui é da própria pessoa: o painel, as vendas dela, a chave Pix dela.
 * Nada do que a pessoa manda muda dinheiro; o dinheiro muda pelos avisos do
 * Mercado Pago e pelo "Marcar como pago" do painel.
 */
@Controller('me/afiliado')
@UseGuards(AuthGuard)
export class AfiliadosController {
  constructor(private readonly afiliados: AfiliadosService) {}

  @Get()
  painel(@Req() req: Request) {
    return this.afiliados.meuPainel(req.usuario!.id)
  }

  @Get('vendas')
  vendas(@Query('pagina') pagina: string | undefined, @Req() req: Request) {
    return this.afiliados.minhasVendas(req.usuario!.id, Number(pagina) || 1)
  }

  @Put('pix')
  pix(@Body() dto: PixDto, @Req() req: Request) {
    return this.afiliados.definirPix(req.usuario!.id, dto)
  }

  /** "Sacar meu dinheiro": o pedido de saque, que o cliente paga por Pix (08/10). */
  @Post('saque')
  saque(@Req() req: Request) {
    return this.afiliados.solicitarSaque(req.usuario!.id)
  }

  /** O painel foi aberto: as novidades seguintes contam a partir daqui. */
  @Post('visto')
  visto(@Req() req: Request) {
    return this.afiliados.marcarVisto(req.usuario!.id)
  }
}
