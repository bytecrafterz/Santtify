import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator'
import { AuthService } from './auth.service'
import { ConsentService } from './consent.service'
import { AuthGuard } from './auth.guard'
import { ANON_COOKIE, cookieOptions, ipDaRequisicao, paisDaRequisicao } from '../common/http.util'
import { VisitContext } from '../tracking/attribution.types'

class RegistrarDto {
  @IsUUID() projectId!: string
  @IsEmail() email!: string
  /** 10 caracteres em vez de 8: a exigência de complexidade é substituída por
   *  comprimento, que protege mais e é mais fácil para um pai cadastrar. */
  @IsString() @MinLength(10) @MaxLength(200) password!: string
  @IsString() @MinLength(2) @MaxLength(80) displayName!: string
  @IsOptional() @IsString() linkCode?: string
  @IsOptional() @IsString() utmSource?: string
  @IsOptional() @IsString() utmMedium?: string
  @IsOptional() @IsString() campaignRef?: string
}

class EntrarDto {
  @IsUUID() projectId!: string
  @IsEmail() email!: string
  @IsString() password!: string
  @IsOptional() @IsString() linkCode?: string
}

class RenovarDto {
  @IsString() refreshToken!: string
}

class ConsentimentoDto {
  @IsUUID() projectId!: string
  @IsBoolean() granted!: boolean
  @IsOptional() @IsBoolean() analytics?: boolean
  @IsOptional() @IsBoolean() marketing?: boolean
  @IsOptional() @IsString() linkCode?: string
  @IsOptional() @IsString() utmSource?: string
}

@Controller()
export class IdentityController {
  constructor(
    private readonly auth: AuthService,
    private readonly consent: ConsentService,
  ) {}

  @Post('auth/register')
  async registrar(@Body() dto: RegistrarDto, @Req() req: Request, @Res() res: Response) {
    const resultado = await this.auth.registrar(dto, this.contexto(dto, req))
    if (resultado.anonId) res.cookie(ANON_COOKIE, resultado.anonId, cookieOptions())
    return res.status(201).json({ user: resultado.user, ...resultado.tokens })
  }

  @Post('auth/login')
  @HttpCode(200)
  async entrar(@Body() dto: EntrarDto, @Req() req: Request, @Res() res: Response) {
    const resultado = await this.auth.entrar(dto, this.contexto(dto, req))
    if (resultado.anonId) res.cookie(ANON_COOKIE, resultado.anonId, cookieOptions())
    return res.status(200).json({ user: resultado.user, ...resultado.tokens })
  }

  @Post('auth/refresh')
  @HttpCode(200)
  renovar(@Body() dto: RenovarDto) {
    return this.auth.renovar(dto.refreshToken)
  }

  @Post('auth/logout')
  @HttpCode(204)
  async sair(@Body() dto: RenovarDto) {
    await this.auth.sair(dto.refreshToken)
  }

  @Get('auth/me')
  @UseGuards(AuthGuard)
  async eu(@Req() req: Request) {
    const usuario = req.usuario ? await this.auth.porId(req.usuario.id) : null
    if (!usuario) throw new UnauthorizedException('Sessão inválida')
    return usuario
  }

  // ── Consentimento ────────────────────────────────────────────────

  @Post('consent')
  @HttpCode(200)
  async consentir(@Body() dto: ConsentimentoDto, @Req() req: Request, @Res() res: Response) {
    const resultado = await this.consent.registrar(
      { granted: dto.granted, analytics: dto.analytics ?? false, marketing: dto.marketing ?? false },
      this.contexto(dto, req),
    )
    if (resultado.anonId) res.cookie(ANON_COOKIE, resultado.anonId, cookieOptions())
    return res.status(200).json({
      status: resultado.status,
      policyVersion: resultado.policyVersion,
    })
  }

  @Get('consent')
  situacao(@Req() req: Request) {
    return this.consent.situacao(req.cookies?.[ANON_COOKIE] ?? null)
  }

  private contexto(
    dto: { projectId: string; linkCode?: string; utmSource?: string; utmMedium?: string; campaignRef?: string },
    req: Request,
  ): VisitContext {
    return {
      projectId: dto.projectId,
      anonId: req.cookies?.[ANON_COOKIE] ?? null,
      linkCode: dto.linkCode ?? null,
      utmSource: dto.utmSource ?? null,
      utmMedium: dto.utmMedium ?? null,
      campaignRef: dto.campaignRef ?? null,
      referrer: req.get('referer') ?? null,
      ip: ipDaRequisicao(req),
      userAgent: req.get('user-agent') ?? null,
      countryCode: paisDaRequisicao(req),
    }
  }
}
