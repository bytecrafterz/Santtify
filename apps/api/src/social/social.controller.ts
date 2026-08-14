import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { Platform } from '@pv/db'
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
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
  comentarios(@Param('contentId') contentId: string) {
    return this.social.listarComentarios(contentId)
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
@Controller('comments')
export class ComentariosController {
  constructor(private readonly social: SocialService) {}

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
