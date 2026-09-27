import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import type { Request, Response } from 'express'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { AuthGuard } from '../identity/auth.guard'
import { MAXIMO_DE_CARACTERES, MensagensService, TAMANHO_MAXIMO_ANEXO } from './mensagens.service'

class AbrirDto {
  @IsUUID() comUserId!: string
}

class EnviarDto {
  @IsString() @MaxLength(MAXIMO_DE_CARACTERES) texto!: string
}

/** Os campos que acompanham o ficheiro. Chegam como texto, por ser multipart. */
class AnexoDto {
  @IsOptional() @IsString() @MaxLength(MAXIMO_DE_CARACTERES) texto?: string
  @IsOptional() @IsString() voz?: string
  @IsOptional() @IsString() duracaoSeg?: string
}

/** As mensagens privadas de quem está com sessão. Tudo aqui exige conta. */
@Controller('me/conversas')
@UseGuards(AuthGuard)
export class MensagensController {
  constructor(private readonly mensagens: MensagensService) {}

  @Get()
  listar(@Req() req: Request) {
    return this.mensagens.listar(req.usuario!.id)
  }

  @Get('nao-lidas')
  naoLidas(@Req() req: Request) {
    return this.mensagens.naoLidas(req.usuario!.id)
  }

  @Post()
  abrir(@Body() dto: AbrirDto, @Req() req: Request) {
    return this.mensagens.abrir(req.usuario!.id, req.usuario!.role, dto.comUserId)
  }

  @Get(':id')
  ver(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.mensagens.mensagens(req.usuario!.id, id)
  }

  @Post(':id/mensagens')
  enviar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EnviarDto, @Req() req: Request) {
    return this.mensagens.enviar(req.usuario!.id, id, dto.texto)
  }

  @Post(':id/anexos')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: TAMANHO_MAXIMO_ANEXO } }))
  enviarAnexo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnexoDto,
    @Req() req: Request,
    @UploadedFile() arquivo?: Express.Multer.File,
  ) {
    return this.mensagens.enviarAnexo(req.usuario!.id, id, arquivo, {
      texto: dto.texto,
      voz: dto.voz === 'true',
      duracaoSeg: dto.duracaoSeg ? Number(dto.duracaoSeg) : undefined,
    })
  }

  /**
   * O ficheiro, a quem é da conversa.
   *
   * Imagens e áudio vão com o tipo verdadeiro, para se verem e ouvirem; tudo o
   * resto vai como descarga e com `sandbox`, para nunca correr no nosso domínio.
   */
  @Get(':id/anexos/:mensagemId')
  async anexo(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mensagemId', ParseUUIDPipe) mensagemId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const a = await this.mensagens.anexo(req.usuario!.id, id, mensagemId)
    const info = await stat(a.caminho).catch(() => null)
    if (!info) {
      res.status(404).json({ message: 'Arquivo não encontrado.' })
      return
    }
    const nomeCodificado = encodeURIComponent(a.nome)
    const nomeAscii = a.nome.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
    res.setHeader('Content-Type', a.tipoDeConteudo)
    res.setHeader('Content-Length', String(info.size))
    res.setHeader(
      'Content-Disposition',
      `${a.mostravel ? 'inline' : 'attachment'}; filename="${nomeAscii}"; filename*=UTF-8''${nomeCodificado}`,
    )
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    res.setHeader('Cache-Control', 'private, max-age=3600')
    createReadStream(a.caminho).pipe(res)
  }
}
