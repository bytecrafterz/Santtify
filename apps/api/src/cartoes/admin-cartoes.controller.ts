import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import sharp from 'sharp'
import { DestaqueDoCarrossel, FormatoDaMoldura } from '@pv/db'
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { AdminGuard, AuthGuard } from '../identity/auth.guard'
import { StorageService, TAMANHO_MAXIMO } from '../admin/storage.service'
import { AdminCartoesService } from './admin-cartoes.service'
import { CarrosselService } from './carrossel.service'
import { CartoesService } from './cartoes.service'
import { ExpurgoDeCartoesService } from './expurgo.service'

class ModeloDto {
  @IsOptional() @IsString() @MaxLength(80) slug?: string
  @IsOptional() @IsInt() @Min(1) @Max(99) dia?: number
  @IsOptional() @IsString() @MaxLength(120) nome?: string
  @IsOptional() @IsBoolean() ativo?: boolean
  @IsOptional() @IsInt() @Min(0) ordem?: number

  @IsOptional() @IsNumber() @Min(0) @Max(210) fotoX?: number
  @IsOptional() @IsNumber() @Min(0) @Max(297) fotoY?: number
  @IsOptional() @IsNumber() @Min(1) @Max(210) fotoLargura?: number
  @IsOptional() @IsNumber() @Min(1) @Max(297) fotoAltura?: number
  @IsOptional() @IsEnum(FormatoDaMoldura) fotoFormato?: FormatoDaMoldura

  @IsOptional() @IsNumber() @Min(0) @Max(210) nomeX?: number
  @IsOptional() @IsNumber() @Min(0) @Max(297) nomeY?: number
  @IsOptional() @IsNumber() @Min(1) @Max(210) nomeLargura?: number
  @IsOptional() @IsNumber() @Min(1) @Max(297) nomeAltura?: number
  @IsOptional() @IsHexColor() nomeCorHex?: string
  @IsOptional() @IsNumber() @Min(1) @Max(80) nomeCorpoMinimo?: number
  @IsOptional() @IsNumber() @Min(1) @Max(80) nomeCorpoMaximo?: number
  @IsOptional() @IsBoolean() nomeMaiusculas?: boolean
}

class PrecoDto {
  @IsOptional() @IsInt() @Min(0) precoUnitarioCent?: number
  @IsOptional() @IsString() @MaxLength(3) moeda?: string
  @IsOptional() @IsInt() @Min(0) @Max(100) descontoPercentagem?: number
  @IsOptional() @IsInt() @Min(1) descontoAPartirDe?: number
}

class DestaqueDto {
  @IsOptional() @IsEnum(DestaqueDoCarrossel) destaque?: DestaqueDoCarrossel | null
}

class CartaoDoCarrosselDto {
  @IsOptional() @IsString() @MaxLength(120) tagline?: string
  @IsOptional() @IsString() coverUrl?: string
  @IsOptional() @IsInt() @Min(0) ordemNoCarrossel?: number
}

class NovoProjetoDto {
  @IsString() @MaxLength(80) slug!: string
  @IsString() @MaxLength(120) nome!: string
  @IsInt() @Min(1) @Max(200) blocos!: number
  @IsOptional() @IsString() @MaxLength(120) tagline?: string
}

class ConfirmarPagamentoDto {
  @IsString() @MaxLength(120) referencia!: string
}

/**
 * O painel dos cartões e do carrossel.
 *
 * Tudo o que o cliente pediu para ficar nas mãos dele está aqui: os modelos, o
 * preço, o desconto, os dois destaques do carrossel e a criação de projetos
 * novos com a quantidade de blocos que ele escolher. Nada disto precisa de
 * mim outra vez.
 */
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminCartoesController {
  constructor(
    private readonly admin: AdminCartoesService,
    private readonly carrossel: CarrosselService,
    private readonly cartoes: CartoesService,
    private readonly expurgo: ExpurgoDeCartoesService,
    private readonly storage: StorageService,
  ) {}

  // ── Modelos de cartão ─────────────────────────────────────────────

  @Get('projects/:projectSlug/modelos-de-cartao')
  modelos(@Param('projectSlug') projectSlug: string) {
    return this.admin.listarModelos(projectSlug)
  }

  @Post('projects/:projectSlug/modelos-de-cartao')
  criarModelo(@Param('projectSlug') projectSlug: string, @Body() dto: ModeloDto) {
    return this.admin.criarModelo(projectSlug, dto)
  }

  @Patch('modelos-de-cartao/:id')
  actualizarModelo(@Param('id') id: string, @Body() dto: ModeloDto) {
    return this.admin.actualizarModelo(id, dto)
  }

  @Delete('modelos-de-cartao/:id')
  removerModelo(@Param('id') id: string) {
    return this.admin.removerModelo(id)
  }

  /**
   * A arte de um modelo.
   *
   * Passa pelo `StorageService` que já existe, e é por isso que guarda as duas
   * cópias sozinho: a leve para o ecrã e a de 2480px para o papel. A regra dos
   * 300 dpi cumpre-se aqui, no momento em que a arte entra — se o designer
   * mandar uma arte pequena, é agora que se sabe, e não no dia da impressão.
   */
  @Post('modelos-de-cartao/:id/arte')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TAMANHO_MAXIMO } }))
  async enviarArte(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Nenhum arquivo recebido.')

    /**
     * DOIS CAMINHOS, e a diferença é a qualidade final.
     *
     * PDF é o que o designer entrega e o que vai para a gráfica: fica inteiro,
     * vectorial, e a cópia de ecrã é derivada dele só para o editor mostrar.
     * Imagem continua a funcionar para quem entregar JPEG ou PNG, com a
     * qualidade que a imagem tiver.
     */
    if (file.mimetype === 'application/pdf') {
      return this.admin.definirArteEmPdf(id, file)
    }

    // Medido AQUI, no ficheiro como ele chegou. Depois de passar pelo
    // armazenamento já só há a cópia de ecrã para medir, e essa mente sobre a
    // qualidade de impressão. Ver a nota em `definirArte`.
    const medidas = await sharp(file.buffer).metadata()
    const salvo = await this.storage.salvar(file)
    return this.admin.definirArte(id, salvo, medidas.width ?? 0)
  }

  // ── Preço e desconto ──────────────────────────────────────────────

  @Get('projects/:projectSlug/preco-de-cartoes')
  preco(@Param('projectSlug') projectSlug: string) {
    return this.cartoes.tabelaDePrecos(projectSlug)
  }

  @Patch('projects/:projectSlug/preco-de-cartoes')
  actualizarPreco(@Param('projectSlug') projectSlug: string, @Body() dto: PrecoDto) {
    return this.admin.actualizarPreco(projectSlug, dto)
  }

  // ── Carrossel ─────────────────────────────────────────────────────

  @Get('carrossel')
  verCarrossel() {
    // Com rascunhos: ver a nota em `listar`.
    return this.carrossel.listar(true)
  }

  @Patch('projects/:projectSlug/destaque')
  destaque(@Param('projectSlug') projectSlug: string, @Body() dto: DestaqueDto) {
    return this.carrossel.definirDestaque(projectSlug, dto.destaque ?? null)
  }

  @Patch('projects/:projectSlug/cartao-do-carrossel')
  cartaoDoCarrossel(
    @Param('projectSlug') projectSlug: string,
    @Body() dto: CartaoDoCarrosselDto,
  ) {
    return this.carrossel.actualizarCartao(projectSlug, dto)
  }

  @Post('projetos')
  criarProjeto(@Body() dto: NovoProjetoDto) {
    return this.carrossel.criarProjeto(dto)
  }

  // ── Pagamentos e expurgo ──────────────────────────────────────────

  @Get('pedidos-de-cartoes')
  pedidos() {
    return this.admin.listarPedidos()
  }

  /**
   * A confirmação de pagamento feita à mão, enquanto não há provedor ligado.
   *
   * ENTRA PELA MESMA PORTA que um webhook de verdade: constrói o mesmo aviso e
   * entrega-o ao mesmo método. É de propósito — o caminho que destranca o
   * ficheiro é um só, e no dia em que o provedor a sério entrar, este continua
   * a servir para o caso em que a mãe pagou e o aviso se perdeu.
   */
  @Post('pedidos-de-cartoes/:pedidoId/confirmar')
  confirmarPagamento(
    @Param('pedidoId') pedidoId: string,
    @Body() dto: ConfirmarPagamentoDto,
  ) {
    return this.admin.confirmarPagamentoManual(pedidoId, dto.referencia)
  }

  /** Corre o expurgo agora, sem esperar pela hora certa. */
  @Post('cartoes/expurgo')
  correrExpurgo() {
    return this.expurgo.varrer()
  }
}
