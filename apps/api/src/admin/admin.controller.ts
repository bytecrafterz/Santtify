import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { BlockType } from '@pv/db'
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { AdminContentService } from './admin-content.service'
import { StorageService, TAMANHO_MAXIMO } from './storage.service'
import { LaunchesService } from '../content/launches.service'
import { PostsService } from '../social/posts.service'
import { LaunchStatus } from '@pv/db'
import { AdminGuard, AuthGuard } from '../identity/auth.guard'

class CriarConteudoDto {
  @IsString() @MaxLength(80) slug!: string
  @IsString() @MaxLength(160) title!: string
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string
}

class AtualizarConteudoDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string
  @IsOptional() @IsString() @MaxLength(500) summary?: string
  @IsOptional() @IsString() coverUrl?: string
  @IsOptional() @IsInt() @Min(0) position?: number
}

class PublicarDto {
  @IsBoolean() publicar!: boolean
}

class CriarBlocoDto {
  @IsEnum(BlockType) type!: BlockType
  @IsOptional() @IsString() @MaxLength(80) label?: string
}

class SalvarBlocoDto {
  @IsOptional() @IsString() @MaxLength(80) label?: string
  @IsOptional() @IsString() text?: string
  @IsOptional() @IsString() url?: string
  @IsOptional() @IsString() assetId?: string | null
}

class CategoriaDto {
  @IsString() @MaxLength(60) nome!: string
}

class MoverBlocoDto {
  @IsIn(['cima', 'baixo']) direcao!: 'cima' | 'baixo'
}

class ArteDoBlocoDto {
  @IsOptional() @IsString() assetId?: string | null
}

class ClassificarBlocoDto {
  @IsOptional() @IsString() categoryId?: string | null
}

class MaterialGratisDto {
  @IsOptional() @IsString() assetId?: string | null
}

class LinkDeCompraDto {
  @IsOptional() @IsString() @MaxLength(500) url?: string | null
}

class DefinirCapaDto {
  @IsOptional() @IsString() assetId?: string | null
}

class BloquearContaDto {
  @IsBoolean() bloquear!: boolean
  @IsOptional() @IsString() @MaxLength(300) motivo?: string
}

class AprovacaoDeFotoDto {
  @IsBoolean() exigir!: boolean
}

class ModerarDto {
  @IsBoolean() aprovar!: boolean
  @IsOptional() @IsString() @MaxLength(300) nota?: string
}

class CriarLancamentoDto {
  @IsString() @MaxLength(120) title!: string
  @IsOptional() @IsString() @MaxLength(400) description?: string
  @IsOptional() @IsEnum(LaunchStatus) status?: LaunchStatus
}

class AtualizarLancamentoDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string
  @IsOptional() @IsString() @MaxLength(400) description?: string
  @IsOptional() @IsString() imageUrl?: string
  @IsOptional() @IsEnum(LaunchStatus) status?: LaunchStatus
  @IsOptional() @IsString() externalUrl?: string
  @IsOptional() @IsBoolean() visible?: boolean
  @IsOptional() @IsInt() @Min(0) position?: number
}

class MetadadosDto {
  @IsOptional() @IsString() platform?: string
  @IsOptional() @IsString() format?: string
  @IsOptional() @IsString() theme?: string
  @IsOptional() @IsString() productRef?: string
  @IsOptional() @IsString() cta?: string
  @IsOptional() @IsString() testVariant?: string
}

/**
 * Painel administrativo.
 *
 * Duas guardas em toda rota: AuthGuard exige sessão válida, AdminGuard exige
 * papel de administrador. O painel gerencia conteúdo público e mídia — não
 * pode ficar atrás só de "estar logado".
 */
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly conteudo: AdminContentService,
    private readonly storage: StorageService,
    private readonly lancamentos: LaunchesService,
    private readonly posts: PostsService,
  ) {}

  // ── Moderação do My Post ─────────────────────────────────────────

  /** Fila de aprovação: publicações com foto aguardando revisão. */
  @Get('projects/:projectSlug/posts/pending')
  publicacoesPendentes(@Param('projectSlug') projectSlug: string) {
    return this.posts.pendentes(projectSlug)
  }

  /**
   * Liga e desliga a aprovação prévia de foto.
   *
   * Fica no painel, e não numa variável de ambiente, porque quem responde pelo
   * conteúdo hospedado precisa conseguir mudar isso sozinho — inclusive às
   * pressas, num dia de problema, sem esperar por mim.
   */
  @Post('projects/:projectSlug/photo-approval')
  @HttpCode(200)
  async definirAprovacaoDeFoto(
    @Param('projectSlug') projectSlug: string,
    @Body() dto: AprovacaoDeFotoDto,
    @Req() req: Request,
  ) {
    const projeto = await this.conteudo.definirAprovacaoDeFoto(
      projectSlug,
      dto.exigir,
      req.usuario!.id,
    )
    return projeto
  }

  // ── Categorias de áudio ──────────────────────────────────────────

  @Get('projects/:projectSlug/categories')
  categorias(@Param('projectSlug') projectSlug: string) {
    return this.conteudo.categorias(projectSlug)
  }

  @Post('projects/:projectSlug/categories')
  criarCategoria(
    @Param('projectSlug') projectSlug: string,
    @Body() dto: CategoriaDto,
    @Req() req: Request,
  ) {
    return this.conteudo.criarCategoria(projectSlug, dto.nome, req.usuario!.id)
  }

  @Patch('categories/:id')
  renomearCategoria(@Param('id') id: string, @Body() dto: CategoriaDto, @Req() req: Request) {
    return this.conteudo.renomearCategoria(id, dto.nome, req.usuario!.id)
  }

  @Delete('categories/:id')
  removerCategoria(@Param('id') id: string, @Req() req: Request) {
    return this.conteudo.removerCategoria(id, req.usuario!.id)
  }

  /** Sobe ou desce um bloco na página. */
  @Patch('blocks/:id/move')
  moverBloco(@Param('id') id: string, @Body() dto: MoverBlocoDto, @Req() req: Request) {
    return this.conteudo.moverBloco(id, dto.direcao, req.usuario!.id)
  }

  /** Define a arte própria da faixa. */
  @Patch('blocks/:id/image')
  definirArteDoBloco(
    @Param('id') id: string,
    @Body() dto: ArteDoBlocoDto,
    @Req() req: Request,
  ) {
    return this.conteudo.definirArteDoBloco(id, dto.assetId ?? null, req.usuario!.id)
  }

  /** Classifica um áudio numa categoria (ou tira dela). */
  @Patch('blocks/:id/category')
  classificarBloco(
    @Param('id') id: string,
    @Body() dto: ClassificarBlocoDto,
    @Req() req: Request,
  ) {
    return this.conteudo.definirCategoriaDoBloco(id, dto.categoryId ?? null, req.usuario!.id)
  }

  // ── Moderação da comunidade ──────────────────────────────────────

  /** Comentários recentes do projeto, para o dono revisar e agir. */
  @Get('projects/:projectSlug/comments')
  comentarios(@Param('projectSlug') projectSlug: string) {
    return this.conteudo.comentariosRecentes(projectSlug)
  }

  /** Bloqueia ou libera uma conta. */
  @Post('users/:id/block')
  @HttpCode(200)
  bloquearConta(@Param('id') id: string, @Body() dto: BloquearContaDto, @Req() req: Request) {
    return this.conteudo.bloquearConta(id, dto.bloquear, req.usuario!.id, dto.motivo)
  }

  @Post('posts/:id/moderate')
  @HttpCode(200)
  moderar(@Param('id') id: string, @Body() dto: ModerarDto, @Req() req: Request) {
    return this.posts.moderar(id, dto.aprovar, req.usuario!.id, dto.nota)
  }

  // ── Lançamentos (vitrine de próximos produtos) ───────────────────

  @Get('projects/:projectSlug/launches')
  listarLancamentos(@Param('projectSlug') projectSlug: string) {
    return this.lancamentos.listarParaAdmin(projectSlug)
  }

  @Post('projects/:projectSlug/launches')
  criarLancamento(
    @Param('projectSlug') projectSlug: string,
    @Body() dto: CriarLancamentoDto,
    @Req() req: Request,
  ) {
    return this.lancamentos.criar(projectSlug, dto, req.usuario!.id)
  }

  @Patch('launches/:id')
  atualizarLancamento(
    @Param('id') id: string,
    @Body() dto: AtualizarLancamentoDto,
    @Req() req: Request,
  ) {
    return this.lancamentos.atualizar(id, dto, req.usuario!.id)
  }

  @Delete('launches/:id')
  @HttpCode(204)
  removerLancamento(@Param('id') id: string, @Req() req: Request) {
    return this.lancamentos.remover(id, req.usuario!.id)
  }

  @Get('projects/:projectSlug/contents')
  listar(@Param('projectSlug') projectSlug: string) {
    return this.conteudo.listar(projectSlug)
  }

  @Get('projects/:projectSlug/contents/:contentSlug')
  detalhe(
    @Param('projectSlug') projectSlug: string,
    @Param('contentSlug') contentSlug: string,
  ) {
    return this.conteudo.detalhe(projectSlug, contentSlug)
  }

  @Post('projects/:projectSlug/contents')
  criar(
    @Param('projectSlug') projectSlug: string,
    @Body() dto: CriarConteudoDto,
    @Req() req: Request,
  ) {
    return this.conteudo.criarConteudo(projectSlug, dto, req.usuario!.id)
  }

  @Patch('contents/:id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarConteudoDto, @Req() req: Request) {
    return this.conteudo.atualizarConteudo(id, dto, req.usuario!.id)
  }

  @Post('contents/:id/publish')
  publicar(@Param('id') id: string, @Body() dto: PublicarDto, @Req() req: Request) {
    return this.conteudo.publicar(id, dto.publicar, req.usuario!.id)
  }

  @Patch('contents/:id/metadata')
  metadados(@Param('id') id: string, @Body() dto: MetadadosDto, @Req() req: Request) {
    return this.conteudo.salvarMetadados(id, dto as Record<string, unknown>, req.usuario!.id)
  }

  // ── Blocos ───────────────────────────────────────────────────────

  @Post('contents/:id/blocks')
  criarBloco(@Param('id') id: string, @Body() dto: CriarBlocoDto, @Req() req: Request) {
    return this.conteudo.criarBloco(id, dto, req.usuario!.id)
  }

  @Patch('blocks/:id')
  salvarBloco(@Param('id') id: string, @Body() dto: SalvarBlocoDto, @Req() req: Request) {
    return this.conteudo.salvarBloco(id, dto, req.usuario!.id)
  }

  @Delete('blocks/:id')
  @HttpCode(204)
  removerBloco(@Param('id') id: string, @Req() req: Request) {
    return this.conteudo.removerBloco(id, req.usuario!.id)
  }

  // ── Upload ───────────────────────────────────────────────────────

  /**
   * Upload de mídia. O arquivo fica em memória antes de ir ao disco, então o
   * limite do Multer precisa bater com o do StorageService — se divergirem, o
   * cliente recebe um erro genérico de rede em vez de uma mensagem clara.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TAMANHO_MAXIMO } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    const salvo = await this.storage.salvar(file)
    const asset = await this.conteudo.registrarMidia(
      {
        url: salvo.url,
        kind: salvo.kind,
        mimeType: salvo.mimeType,
        sizeBytes: salvo.sizeBytes,
        title: salvo.nomeOriginal,
        shareCardUrl: salvo.urlCartao,
        width: salvo.largura,
        height: salvo.altura,
      },
      req.usuario!.id,
    )
    return asset
  }

  /** Define (ou remove) o PDF gratuito da letra. */
  @Patch('contents/:id/free-file')
  definirMaterialGratis(
    @Param('id') id: string,
    @Body() dto: MaterialGratisDto,
    @Req() req: Request,
  ) {
    return this.conteudo.definirMaterialGratis(id, dto.assetId ?? null, req.usuario!.id)
  }

  /** Define (ou remove) o link de compra do projeto. */
  @Patch('projects/:projectSlug/checkout-url')
  definirLinkDeCompra(
    @Param('projectSlug') projectSlug: string,
    @Body() dto: LinkDeCompraDto,
    @Req() req: Request,
  ) {
    return this.conteudo.definirLinkDeCompra(projectSlug, dto.url ?? null, req.usuario!.id)
  }

  /** Define (ou remove) a capa da letra. */
  @Patch('contents/:id/cover')
  definirCapa(
    @Param('id') id: string,
    @Body() dto: DefinirCapaDto,
    @Req() req: Request,
  ) {
    return this.conteudo.definirCapa(id, dto.assetId ?? null, req.usuario!.id)
  }
}
