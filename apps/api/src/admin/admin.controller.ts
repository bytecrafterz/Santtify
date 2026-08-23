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
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator'
import { AdminContentService } from './admin-content.service'
import { StorageService, TAMANHO_MAXIMO } from './storage.service'
import { LaunchesService } from '../content/launches.service'
import { PostsService } from '../social/posts.service'
import { AuthService } from '../identity/auth.service'
import { LaunchStatus } from '@pv/db'
import { AdminGuard, AuthGuard } from '../identity/auth.guard'

class CriarConteudoDto {
  @IsString() @MaxLength(80) slug!: string
  @IsString() @MaxLength(160) title!: string
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string
  /** Lugar na sequência. Sem isto, entra no fim. */
  @IsOptional() @IsInt() @Min(1) position?: number
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

/**
 * O cartão inteiro numa chamada só.
 *
 * Note-se o que NÃO está aqui: o estado. Rascunho ou publicado é consequência
 * do que ficou lá dentro, e não uma escolha de quem chama — se fosse um campo,
 * mais cedo ou mais tarde chegava um cartão publicado sem imagem, que é o
 * defeito que tudo isto veio fechar.
 */
class OrdemDosCartoesDto {
  @IsArray() @IsUUID('4', { each: true }) ids!: string[]
}

class SalvarCartaoDto {
  @IsOptional() @IsString() @MaxLength(120) titulo?: string | null
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string | null
  @IsOptional() @IsString() assetId?: string | null
  @IsOptional() @IsString() imageAssetId?: string | null
  @IsOptional() @IsString() @MaxLength(500) linkUpgrade?: string | null
}

class DecidirDenunciaDto {
  @IsIn(['REVIEWED', 'DISMISSED']) status!: 'REVIEWED' | 'DISMISSED'
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
    private readonly auth: AuthService,
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

  /** Fila de denúncias do projeto. */
  @Get('projects/:projectSlug/reports')
  denuncias(@Param('projectSlug') projectSlug: string) {
    return this.conteudo.denuncias(projectSlug)
  }

  /** Marca uma denúncia como tratada ou descartada. */
  @Post('reports/:id/decide')
  decidirDenuncia(
    @Param('id') id: string,
    @Body() dto: DecidirDenunciaDto,
    @Req() req: Request,
  ) {
    return this.conteudo.decidirDenuncia(id, dto.status, req.usuario!.id)
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

  // ── Ajuda e suporte: quem ficou sem entrar (23/08) ────────────────
  //
  // Existe porque a irmã do cliente ficou sem entrar e ele só soube porque ela
  // lhe telefonou. Um pedido que não deixa rasto parece desinteresse, e é
  // avaria — foi a observação dele e é a razão desta lista.

  @Get('projects/:projectSlug/recovery-requests')
  async pedidosDeReposicao(@Param('projectSlug') projectSlug: string) {
    const project = await this.conteudo.projetoPorSlug(projectSlug)
    return this.auth.pedidosDeReposicao(project.id)
  }

  /**
   * Gera o link de uso único. Devolvido UMA vez e nunca mais.
   *
   * O responsável copia-o e manda-o por onde já fala com a pessoa. Não é
   * automático — enquanto não houver serviço de e-mail não pode ser — mas
   * fecha o buraco que fazia perder gente em silêncio.
   */
  @Post('recovery-requests/:id/link')
  atenderPedido(@Param('id') id: string, @Req() req: Request) {
    const base = `${req.protocol}://${req.get('host')?.replace(/^api\./, '')}`
    return this.auth.atenderPedido(id, base)
  }

  // ── O cartão como peça única (23/08) ──────────────────────────────
  //
  // Rotas próprias, e não mais campos nas dos blocos. Um cartão guarda-se
  // inteiro de uma vez, e o estado — rascunho ou publicado — sai do que ficou
  // lá dentro, nunca de quem chama.

  @Get('projects/:projectSlug/estrutura')
  estruturaRaiz(@Param('projectSlug') projectSlug: string) {
    return this.conteudo.estruturaRaiz(projectSlug)
  }

  @Post('contents/:id/duplicate-intro')
  duplicarIntroducao(@Param('id') id: string, @Req() req: Request) {
    return this.conteudo.duplicarIntroducao(id, req.usuario!.id)
  }

  @Get('projects/:projectSlug/alfabeto')
  alfabeto(@Param('projectSlug') projectSlug: string) {
    return this.conteudo.alfabeto(projectSlug)
  }

  @Patch('cards/:id')
  salvarCartao(@Param('id') id: string, @Body() dto: SalvarCartaoDto, @Req() req: Request) {
    return this.conteudo.salvarCartao(id, dto, req.usuario!.id)
  }

  @Post('cards/:id/duplicate')
  duplicarCartao(@Param('id') id: string, @Req() req: Request) {
    return this.conteudo.duplicarCartao(id, req.usuario!.id)
  }

  @Delete('cards/:id')
  esvaziarCartao(@Param('id') id: string, @Req() req: Request) {
    return this.conteudo.esvaziarCartao(id, req.usuario!.id)
  }

  @Post('contents/:id/card-order')
  ordenarCartoes(@Param('id') id: string, @Body() dto: OrdemDosCartoesDto, @Req() req: Request) {
    return this.conteudo.ordenarCartoes(id, dto.ids, req.usuario!.id)
  }

  @Post('contents/:id/print-card')
  criarCartaoDeImpressao(@Param('id') id: string, @Req() req: Request) {
    return this.conteudo.criarCartaoDeImpressao(id, req.usuario!.id)
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

  /**
   * Material grátis num só passo: envia, converte se for preciso, e liga.
   *
   * Antes eram duas chamadas — enviar o ficheiro e depois apontá-lo — e o
   * painel tinha de aceitar só PDF para não trocar as voltas. Numa chamada só,
   * a conversão de fotografia em PDF acontece pelo caminho e o iPhone deixa de
   * abrir os Ficheiros quando a pessoa queria as Fotos.
   */
  @Post('contents/:id/free-file/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TAMANHO_MAXIMO } }))
  async enviarMaterialGratis(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const salvo = await this.storage.salvarComoPdf(file)
    const asset = await this.conteudo.registrarMidia(
      {
        url: salvo.url,
        kind: salvo.kind,
        mimeType: salvo.mimeType,
        sizeBytes: salvo.sizeBytes,
        title: salvo.nomeOriginal,
      },
      req.usuario!.id,
    )
    return this.conteudo.definirMaterialGratis(id, asset.id, req.usuario!.id)
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
