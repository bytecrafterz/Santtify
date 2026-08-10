import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { Platform } from '@pv/db'
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
import { SocialService } from './social.service'
import { AuthGuard, AuthOpcional } from '../identity/auth.guard'
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

class CompartilharDto {
  @IsUUID() projectId!: string
  @IsEnum(Platform) canal!: Platform
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
  constructor(private readonly social: SocialService) {}

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
    return this.social.alternarCurtida(contentId, req.usuario!.id, this.contexto(dto.projectId, req))
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
      this.contexto(dto.projectId, req),
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
      this.contexto(dto.projectId, req),
    )
  }

  private contexto(projectId: string, req: Request): VisitContext {
    return {
      projectId,
      anonId: req.cookies?.[ANON_COOKIE] ?? null,
      referrer: req.get('referer') ?? null,
      ip: ipDaRequisicao(req),
      userAgent: req.get('user-agent') ?? null,
      countryCode: paisDaRequisicao(req),
    }
  }
}

/** Remoção de comentário fica fora do prefixo de conteúdo. */
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
