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
import { Platform, ReportReason, ReportTarget } from '@pv/db'
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator'
import { SocialService } from './social.service'
import { PostsService } from './posts.service'
import { AuthGuard, AuthOpcional } from '../identity/auth.guard'
import { TAMANHO_MAXIMO_IMAGEM } from '../admin/storage.service'
import { ANON_COOKIE, ipDaRequisicao, paisDaRequisicao } from '../common/http.util'
import { VisitContext } from '../tracking/attribution.types'

class ComentarDto {
  @IsUUID() projectId!: string
  @IsString() @MinLength(1) @MaxLength(2000) body!: string
  @IsOptional() @IsUUID() parentId?: string
}

class CurtirDto {
  @IsUUID() projectId!: string
}

class PublicarDto {
  @IsUUID() projectId!: string
  @IsOptional() @IsString() @MaxLength(1000) body?: string
}

class CliqueDeCompraDto {
  @IsUUID() projectId!: string
}

class CompartilharDto {
  @IsUUID() projectId!: string
  @IsEnum(Platform) canal!: Platform
}

/** Monta o contexto de visita a partir da requisição. */
function contextoDaVisita(projectId: string, req: Request): VisitContext {
  return {
    projectId,
    anonId: req.cookies?.[ANON_COOKIE] ?? null,
    referrer: req.get('referer') ?? null,
    ip: ipDaRequisicao(req),
    userAgent: req.get('user-agent') ?? null,
    countryCode: paisDaRequisicao(req),
  }
}

/**
 * Rotas sociais.
 *
 * Leitura é pública (`AuthOpcional`): quem chega pelo QR ainda não tem conta e
 * precisa ver as curtidas e os comentários para perceber que existe gente ali.
 * Escrita exige conta — é a regra que o cliente descreveu.
 */
@Controller('contents/:contentId')
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly posts: PostsService,
  ) {}

  @Get('social')
  @AuthOpcional()
  @UseGuards(AuthGuard)
  estado(@Param('contentId') contentId: string, @Req() req: Request) {
    return this.social.estado(contentId, req.usuario?.id ?? null)
  }

  @Post('like')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  curtir(@Param('contentId') contentId: string, @Body() dto: CurtirDto, @Req() req: Request) {
    return this.social.alternarCurtida(
      contentId,
      req.usuario!.id,
      contextoDaVisita(dto.projectId, req),
    )
  }

  @Get('comments')
  @AuthOpcional()
  @UseGuards(AuthGuard)
  comentarios(@Param('contentId') contentId: string, @Req() req: Request) {
    return this.social.listarComentarios(contentId, 100, req.usuario?.id ?? null)
  }

  @Post('comments')
  @UseGuards(AuthGuard)
  comentar(@Param('contentId') contentId: string, @Body() dto: ComentarDto, @Req() req: Request) {
    return this.social.comentar(
      contentId,
      req.usuario!.id,
      { body: dto.body, parentId: dto.parentId },
      contextoDaVisita(dto.projectId, req),
    )
  }

  /**
   * Clique em comprar. Sem exigir conta: quem ainda não se cadastrou também
   * pode querer comprar, e barrar aqui perderia venda e perderia o dado.
   */
  @Post('checkout')
  @HttpCode(200)
  @AuthOpcional()
  @UseGuards(AuthGuard)
  cliqueDeCompra(
    @Param('contentId') contentId: string,
    @Body() dto: CliqueDeCompraDto,
    @Req() req: Request,
  ) {
    return this.social.cliqueDeCompra(
      contentId,
      contextoDaVisita(dto.projectId, req),
      req.usuario?.id ?? null,
    )
  }

  @Post('share')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  compartilhar(
    @Param('contentId') contentId: string,
    @Body() dto: CompartilharDto,
    @Req() req: Request,
  ) {
    return this.social.compartilhar(
      contentId,
      req.usuario!.id,
      dto.canal,
      contextoDaVisita(dto.projectId, req),
    )
  }

  /**
   * "My Post": publica no perfil de quem está logado.
   *
   * Aceita multipart para a foto ser enviada junto da legenda numa requisição
   * só. Enviar arquivo e publicação separados abriria a porta para foto órfã
   * no armazenamento quando a segunda chamada falha.
   *
   * Publicação com foto nasce aguardando aprovação; sem foto, publica direto.
   */
  @Post('publish')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: TAMANHO_MAXIMO_IMAGEM } }))
  publicar(
    @Param('contentId') contentId: string,
    @Body() dto: PublicarDto,
    @Req() req: Request,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.posts.publicar(
      contentId,
      req.usuario!.id,
      dto.body,
      contextoDaVisita(dto.projectId, req),
      foto,
    )
  }
}

/** Remoção de comentário, fora do prefixo de conteúdo. */
class EditarComentarioDto {
  @IsString() @MinLength(1) @MaxLength(2000) body!: string
}

@Controller('comments')
export class ComentariosController {
  constructor(private readonly social: SocialService) {}

  @Post(':id/like')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  curtir(@Param('id') id: string, @Req() req: Request) {
    return this.social.alternarCurtidaDoComentario(id, req.usuario!.id)
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  editar(@Param('id') id: string, @Body() dto: EditarComentarioDto, @Req() req: Request) {
    return this.social.editarComentario(id, req.usuario!.id, dto.body)
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  remover(@Param('id') id: string, @Req() req: Request) {
    return this.social.removerComentario(id, req.usuario!.id, req.usuario!.role === 'ADMIN')
  }
}

/**
 * As publicações da própria pessoa.
 *
 * Mora aqui, e não no perfil, porque quem decide o que o autor enxerga das
 * próprias publicações é o mesmo serviço que decide o que nasce pendente. Com
 * a regra escrita em dois lugares, a foto pendente sumia da tela do autor.
 */
@Controller('me/posts')
export class MinhasPublicacoesController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @UseGuards(AuthGuard)
  listar(@Req() req: Request) {
    return this.posts.minhas(req.usuario!.id)
  }
}

/** Remoção de publicação do perfil. */
@Controller('posts')
export class PublicacoesController {
  constructor(private readonly posts: PostsService) {}

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  remover(@Param('id') id: string, @Req() req: Request) {
    return this.posts.remover(id, req.usuario!.id, req.usuario!.role === 'ADMIN')
  }
}

/**
 * Engajamento por FAIXA, fora do prefixo de conteúdo.
 *
 * Rotas próprias e não parâmetros das de conteúdo: a faixa é a unidade que o
 * cliente quer medir a partir de 19/08, e dar-lhe endereço próprio deixa o
 * caminho legível tanto no código como nos registos do servidor.
 */
@Controller('blocks/:blockId')
export class FaixasController {
  constructor(private readonly social: SocialService) {}

  @Get('people')
  quemCurtiuAFaixa(@Param('blockId') blockId: string) {
    return this.social.quemCurtiu({ blockId })
  }

  @Get('social')
  @AuthOpcional()
  @UseGuards(AuthGuard)
  estado(@Param('blockId') blockId: string, @Req() req: Request) {
    return this.social.estadoDaFaixa(blockId, req.usuario?.id ?? null)
  }

  @Post('like')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  curtir(@Param('blockId') blockId: string, @Body() dto: CurtirDto, @Req() req: Request) {
    return this.social.alternarCurtidaDaFaixa(
      blockId,
      req.usuario!.id,
      contextoDaVisita(dto.projectId, req),
    )
  }

  @Get('comments')
  @AuthOpcional()
  @UseGuards(AuthGuard)
  comentarios(@Param('blockId') blockId: string, @Req() req: Request) {
    return this.social.listarComentariosDaFaixa(blockId, req.usuario?.id ?? null)
  }

  @Post('comments')
  @UseGuards(AuthGuard)
  comentar(@Param('blockId') blockId: string, @Body() dto: ComentarDto, @Req() req: Request) {
    return this.social.comentarNaFaixa(
      blockId,
      req.usuario!.id,
      dto.body,
      contextoDaVisita(dto.projectId, req),
      dto.parentId,
    )
  }
}


class DenunciarDto {
  @IsUUID() projectId!: string
  @IsEnum(ReportTarget) targetType!: ReportTarget
  @IsUUID() targetId!: string
  @IsEnum(ReportReason) reason!: ReportReason
  @IsOptional() @IsString() @MaxLength(1000) note?: string
  @IsOptional() @IsBoolean() bloquear?: boolean
}

/**
 * Denúncias. Fora do prefixo de conteúdo porque se pode denunciar um
 * comentário, uma faixa, uma publicação ou um perfil.
 */
@Controller('reports')
export class DenunciasController {
  constructor(private readonly social: SocialService) {}

  @Post()
  @AuthOpcional()
  @UseGuards(AuthGuard)
  denunciar(@Body() dto: DenunciarDto, @Req() req: Request) {
    return this.social.denunciar(dto, req.usuario?.id ?? null)
  }
}

class ComentarNoPerfilDto {
  @IsUUID() projectId!: string
  @IsString() @MinLength(1) @MaxLength(2000) body!: string
  @IsOptional() @IsUUID() parentId?: string
}

/**
 * O perfil como objecto social: ver, curtir, comentar, partilhar.
 */
@Controller('profiles/:userId')
export class PerfisController {
  constructor(private readonly social: SocialService,
    private readonly posts: PostsService) {}

  @Get('social')
  @AuthOpcional()
  @UseGuards(AuthGuard)
  estado(@Param('userId') userId: string, @Req() req: Request) {
    return this.social.estadoDoPerfil(userId, req.usuario?.id ?? null)
  }

  /** As publicações desta pessoa, para quem visita o perfil dela. */
  @Get('posts')
  publicacoes(@Param('userId') userId: string) {
    return this.posts.doPerfil(userId)
  }

  @Post('like')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  curtir(@Param('userId') userId: string, @Req() req: Request) {
    return this.social.alternarCurtidaDoPerfil(userId, req.usuario!.id)
  }

  @Get('comments')
  @AuthOpcional()
  @UseGuards(AuthGuard)
  comentarios(@Param('userId') userId: string, @Req() req: Request) {
    return this.social.listarComentariosDoPerfil(userId, req.usuario?.id ?? null)
  }

  @Get()
  perfil(@Param('userId') userId: string) {
    return this.social.perfilPublico(userId)
  }

  /** Quem curtiu e quem comentou, com cara e nome. */
  @Get('people')
  quemInteragiu(@Param('userId') userId: string) {
    return this.social.quemInteragiuComOPerfil(userId)
  }

  @Post('comments')
  @UseGuards(AuthGuard)
  comentar(
    @Param('userId') userId: string,
    @Body() dto: ComentarNoPerfilDto,
    @Req() req: Request,
  ) {
    return this.social.comentarNoPerfil(
      userId,
      req.usuario!.id,
      dto.projectId,
      dto.body,
      dto.parentId,
    )
  }
}
