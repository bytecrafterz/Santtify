import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import { IsString, IsUUID, MaxLength } from 'class-validator'
import type { Request } from 'express'
import { AuthGuard } from '../identity/auth.guard'
import { MAXIMO_DE_CARACTERES, MensagensService } from './mensagens.service'

class AbrirDto {
  @IsUUID() comUserId!: string
}

class EnviarDto {
  @IsString() @MaxLength(MAXIMO_DE_CARACTERES) texto!: string
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
}
