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
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { AdminContentService } from './admin-content.service'
import { StorageService, TAMANHO_MAXIMO } from './storage.service'
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
  ) {}

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
      },
      req.usuario!.id,
    )
    return asset
  }
}
