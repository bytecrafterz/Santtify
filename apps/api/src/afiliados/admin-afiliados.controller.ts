import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import type { Request, Response } from 'express'
import { AdminGuard, AuthGuard } from '../identity/auth.guard'
import { AfiliadosService } from './afiliados.service'
import { PainelDeAfiliadosService } from './painel-de-afiliados.service'
import { diaEmSaoPaulo } from './dinheiro'

/**
 * As regras do programa. Os limites são os do bom senso, não os do cliente:
 * ele escolhe 40% ou 30% à vontade, mas um 400% escrito por engano não pode
 * passar — e esse engano pagava quatro vezes cada venda.
 */
class ConfiguracaoDto {
  @IsOptional() @IsBoolean() ativo?: boolean
  /** Em pontos-base: 4000 = 40%. Entre 0% e 100%. */
  @IsOptional() @IsInt() @Min(0) @Max(10_000) comissaoBp?: number
  @IsOptional() @IsInt() @Min(0) @Max(365) diasDeCarencia?: number
  @IsOptional() @IsInt() @Min(1) @Max(365) diasDeAtribuicao?: number
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) minimoParaPagamentoCent?: number
  @IsOptional() @IsString() @MaxLength(300) destino?: string | null
  @IsOptional() @IsString() @MaxLength(600) mensagemDoWhatsapp?: string
  @IsOptional() @IsString() @MaxLength(6000) regulamento?: string | null
  /** Até 20%: nenhuma taxa de Pix ou de cartão passa disso. */
  @IsOptional() @IsInt() @Min(0) @Max(2000) taxaPixBp?: number
  @IsOptional() @IsInt() @Min(0) @Max(2000) taxaCartaoBp?: number
  @IsOptional() @IsEmail({}, { message: 'Escreva um e-mail válido para os avisos.' }) emailDeAvisos?: string | null
}

class MotivoDto {
  @IsOptional() @IsString() @MaxLength(300) motivo?: string
}

class PagarDto {
  /** O que o administrador quiser anotar — o identificador do Pix, por exemplo. */
  @IsOptional() @IsString() @MaxLength(300) observacao?: string
}

class LiberarDto {
  @IsEmail({}, { message: 'Escreva o e-mail da conta.' }) email!: string
}

/**
 * Os afiliados, no painel. MONITORAR, CONFIGURAR, SUSPENDER e PAGAR — as quatro
 * coisas que o cliente disse que o painel é para fazer, e só essas.
 *
 * As rotas fixas vêm antes de `:id`: o Nest casa pela ordem, e "configuracao"
 * não pode ser lido como o id de um afiliado.
 */
@Controller('admin/afiliados')
@UseGuards(AuthGuard, AdminGuard)
export class AdminAfiliadosController {
  constructor(
    private readonly afiliados: AfiliadosService,
    private readonly painel: PainelDeAfiliadosService,
  ) {}

  @Get()
  listar(
    @Query('estado') estado?: string,
    @Query('busca') busca?: string,
    @Query('ordem') ordem?: string,
    @Query('pagina') pagina?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.painel.listar({ estado, busca, ordem, pagina: Number(pagina) || 1, de, ate })
  }

  @Get('configuracao')
  async configuracao() {
    const cfg = await this.afiliados.configuracao()
    const destino = await this.afiliados.destinoDoLink(cfg).catch(() => null)
    return { ...cfg, destinoResolvido: destino?.url ?? null }
  }

  @Patch('configuracao')
  actualizarConfiguracao(@Body() dto: ConfiguracaoDto, @Req() req: Request) {
    return this.afiliados.actualizarConfiguracao(dto, req.usuario!.id)
  }

  @Get('a-pagar')
  aPagar() {
    return this.painel.aPagar()
  }

  @Get('exportar.csv')
  async exportar(
    @Query('estado') estado: string | undefined,
    @Query('busca') busca: string | undefined,
    @Res() res: Response,
  ) {
    const conteudo = await this.painel.exportar({ estado, busca })
    enviarFolha(res, `afiliados-${diaEmSaoPaulo(new Date())}.csv`, conteudo)
  }

  @Post('liberar')
  liberar(@Body() dto: LiberarDto, @Req() req: Request) {
    return this.afiliados.liberarPorEmail(dto.email, req.usuario!.id)
  }

  @Post('comissoes/:id/cancelar')
  cancelarComissao(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MotivoDto, @Req() req: Request) {
    return this.afiliados.cancelarComissao(id, dto.motivo, req.usuario!.id)
  }

  @Get(':id')
  detalhe(@Param('id', ParseUUIDPipe) id: string) {
    return this.painel.detalhe(id)
  }

  @Post(':id/pagar')
  pagar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PagarDto, @Req() req: Request) {
    return this.afiliados.pagar(id, req.usuario!.id, dto.observacao)
  }

  @Post(':id/suspender')
  suspender(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MotivoDto, @Req() req: Request) {
    return this.afiliados.suspender(id, dto.motivo, req.usuario!.id)
  }

  @Post(':id/reativar')
  reativar(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.afiliados.reativar(id, req.usuario!.id)
  }
}

/**
 * Uma folha para descarregar. `no-store`: tem e-mails e chaves Pix, e não
 * fica em cache em lado nenhum pelo caminho.
 */
export function enviarFolha(res: Response, nome: string, conteudo: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`)
  res.setHeader('Cache-Control', 'no-store, private')
  res.send(conteudo)
}
