import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { KaraokeAcesso } from '@pv/db'
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { AdminGuard, AuthGuard, AuthOpcional } from '../identity/auth.guard'
import { KaraokeService } from './karaoke.service'

class LetraDto {
  /** Uma música longa com repetições cabe folgada em 20 mil caracteres. */
  @IsOptional() @IsString() @MaxLength(20000) texto?: string
  /** A forma confere-a `validarFrases`, que diz em português o que está mal. */
  @IsOptional() @IsArray() frases?: unknown[]
  @IsOptional() @IsBoolean() publicada?: boolean
}

class AcessoDto {
  @IsEnum(KaraokeAcesso) acesso!: KaraokeAcesso
}

class PalavraDto {
  @IsString() @MaxLength(60) palavra!: string
  @IsInt() @Min(1) @Max(3) nivel!: number
}

/** O ecrã do karaokê. Aberto como a página da faixa, salvo se ele pedir conta. */
@Controller('projects/:projectSlug/karaoke')
@UseGuards(AuthGuard)
export class KaraokeController {
  constructor(private readonly karaoke: KaraokeService) {}

  @Get(':blocoId')
  @AuthOpcional()
  tocar(
    @Param('projectSlug') projectSlug: string,
    @Param('blocoId', ParseUUIDPipe) blocoId: string,
    @Req() req: Request,
  ) {
    return this.karaoke.paraTocar(projectSlug, blocoId, Boolean(req.usuario))
  }
}

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminKaraokeController {
  constructor(private readonly karaoke: KaraokeService) {}

  @Get('projects/:projectSlug/karaoke')
  painel(@Param('projectSlug') projectSlug: string) {
    return this.karaoke.painel(projectSlug)
  }

  @Patch('projects/:projectSlug/karaoke')
  acesso(@Param('projectSlug') projectSlug: string, @Body() dto: AcessoDto) {
    return this.karaoke.definirAcesso(projectSlug, dto.acesso)
  }

  @Put('projects/:projectSlug/karaoke/palavras')
  palavra(@Param('projectSlug') projectSlug: string, @Body() dto: PalavraDto) {
    return this.karaoke.definirPalavra(projectSlug, dto.palavra, dto.nivel)
  }

  @Delete('karaoke/palavras/:id')
  apagarPalavra(@Param('id', ParseUUIDPipe) id: string) {
    return this.karaoke.apagarPalavra(id)
  }

  @Get('cards/:id/karaoke')
  letra(@Param('id', ParseUUIDPipe) id: string) {
    return this.karaoke.letraDoCartao(id)
  }

  @Put('cards/:id/karaoke')
  gravar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LetraDto) {
    return this.karaoke.gravarLetra(id, dto)
  }
}
