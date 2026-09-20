import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { KaraokeAcesso } from '@pv/db'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { AdminGuard, AuthGuard, AuthOpcional } from '../identity/auth.guard'
import { KaraokeService } from './karaoke.service'
import { TranscricaoService } from './transcricao.service'

class LetraDto {
  /** Uma música longa com repetições cabe folgada em 20 mil caracteres. */
  @IsOptional() @IsString() @MaxLength(20000) texto?: string
  /** A forma confere-a `validarFrases`, que diz em português o que está mal. */
  @IsOptional() @IsArray() frases?: unknown[]
  @IsOptional() @IsBoolean() publicada?: boolean
}

class ProgressoDto {
  @IsNumber() @Min(0) @Max(100) progresso!: number
}

class OuvidoDto {
  /** O que o transcritor ouviu. A forma confere-se em `frasesDeTranscricao`. */
  @IsArray() tiradas!: unknown[]
  @IsOptional() @IsNumber() @Min(0) segundos?: number
}

class FalhaDto {
  @IsString() @MaxLength(500) erro!: string
}

class AcessoDto {
  @IsEnum(KaraokeAcesso) acesso!: KaraokeAcesso
}

class OuvirTudoDto {
  /** Verdadeiro refaz também as que já têm letra. */
  @IsOptional() @IsBoolean() refazer?: boolean
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
  constructor(
    private readonly karaoke: KaraokeService,
    private readonly transcricao: TranscricaoService,
  ) {}

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

  @Get('projects/:projectSlug/transcricoes')
  andamento(@Param('projectSlug') projectSlug: string) {
    return this.transcricao.andamento(projectSlug)
  }

  @Post('projects/:projectSlug/transcricoes')
  @HttpCode(200)
  ouvirTudo(@Param('projectSlug') projectSlug: string, @Body() dto: OuvirTudoDto) {
    return this.transcricao.enfileirarProjeto(projectSlug, dto.refazer ?? false)
  }

  @Post('cards/:id/transcricao')
  @HttpCode(200)
  ouvirUma(@Param('id', ParseUUIDPipe) id: string) {
    // Pedida à mão: refaz mesmo que já esteja pronta.
    return this.transcricao.enfileirar(id, 'ELE_PEDIU')
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

/**
 * A porta do transcritor — o programa que ouve as músicas no servidor.
 *
 * NÃO É DO PAINEL NEM DO PÚBLICO: é máquina a falar com máquina, e por isso
 * não usa sessão nenhuma. A chave partilhada (`TRANSCRITOR_TOKEN`) é o que a
 * fecha. Sem chave configurada, a porta não abre de todo — em vez de ficar
 * aberta a quem souber o endereço.
 */
@Controller('interno/transcricoes')
export class TranscritorController {
  constructor(
    private readonly transcricao: TranscricaoService,
    private readonly config: ConfigService,
  ) {}

  private conferirChave(req: Request) {
    const esperada = this.config.get<string>('TRANSCRITOR_TOKEN')
    const recebida = req.get('x-transcritor-token')
    if (!esperada || !recebida || recebida !== esperada) {
      throw new UnauthorizedException('Chave do transcritor inválida.')
    }
  }

  @Post('proxima')
  @HttpCode(200)
  async proxima(@Req() req: Request) {
    this.conferirChave(req)
    return (await this.transcricao.proxima()) ?? { vazio: true }
  }

  @Patch(':id/progresso')
  progresso(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ProgressoDto, @Req() req: Request) {
    this.conferirChave(req)
    return this.transcricao.progresso(id, dto.progresso)
  }

  @Post(':id/pronta')
  @HttpCode(200)
  pronta(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OuvidoDto, @Req() req: Request) {
    this.conferirChave(req)
    return this.transcricao.concluir(id, dto.tiradas as never, dto.segundos)
  }

  @Post(':id/falhou')
  @HttpCode(200)
  falhou(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FalhaDto, @Req() req: Request) {
    this.conferirChave(req)
    return this.transcricao.falhar(id, dto.erro)
  }
}
