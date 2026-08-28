import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { TAMANHO_MAXIMO_IMAGEM } from '../admin/storage.service'
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
import { ProfileService } from './profile.service'
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

class EditarPerfilDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) displayName?: string
  /** Mil caracteres: ele quis contar a história do projeto aqui, e trezentos
   *  não chegavam para uma frase inteira sobre o filho. */
  @IsOptional() @IsString() @MaxLength(1000) bio?: string
  @IsOptional() @IsString() @MaxLength(80) guardianName?: string
}

class PedirReposicaoDto {
  @IsEmail() email!: string
  @IsOptional() @IsUUID() projectId?: string
}

class ReporSenhaDto {
  @IsString() @MinLength(20) token!: string
  @IsString() @MinLength(10) @MaxLength(200) password!: string
}

class TrocarSenhaDto {
  @IsString() senhaAtual!: string
  /** Mesmo mínimo do cadastro: comprimento no lugar de complexidade. */
  @IsString() @MinLength(10) @MaxLength(200) senhaNova!: string
}

class ApagarContaDto {
  @IsString() senha!: string
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
    private readonly profile: ProfileService,
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

  /**
   * Troca de senha. Devolve um par de tokens novo porque a troca revoga todas
   * as sessões — inclusive a de quem trocou, que sem isto seria deslogado
   * justamente por ter feito a coisa certa.
   */
  // ── Reposição de senha (23/08) ────────────────────────────────────

  /**
   * A pessoa pede. Responde-se sempre 204, exista a conta ou não.
   *
   * Um formulário que responde "esse e-mail não existe" é um formulário que
   * confirma quais e-mails existem — e numa comunidade infantil isso é uma
   * lista de contactos de crianças a ser oferecida a quem perguntar.
   */
  @Post('auth/recovery-request')
  @HttpCode(204)
  async pedirReposicao(@Body() dto: PedirReposicaoDto) {
    await this.auth.pedirReposicao(dto.email, dto.projectId ?? null)
  }

  @Post('auth/reset-password')
  reporSenha(@Body() dto: ReporSenhaDto) {
    return this.auth.reporSenha(dto.token, dto.password)
  }

  @Post('auth/change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  trocarSenha(@Body() dto: TrocarSenhaDto, @Req() req: Request) {
    return this.auth.trocarSenha(req.usuario!.id, dto.senhaAtual, dto.senhaNova)
  }

  /**
   * Apagar a própria conta.
   *
   * `Post` e não `Delete` porque leva a senha no corpo, e um corpo em `Delete`
   * é tratado de maneira diferente por cada proxy pelo caminho. O Caddy à
   * frente disto não é sítio para descobrir isso.
   */
  @Post('me/delete-account')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async apagarConta(@Body() dto: ApagarContaDto, @Req() req: Request) {
    await this.auth.apagarConta(req.usuario!.id, dto.senha)
    return { apagada: true }
  }

  @Get('auth/me')
  @UseGuards(AuthGuard)
  async eu(@Req() req: Request) {
    const usuario = req.usuario ? await this.auth.porId(req.usuario.id) : null
    if (!usuario) throw new UnauthorizedException('Sessão inválida')
    return usuario
  }

  // ── Perfil ───────────────────────────────────────────────────────

  /**
   * Edição do próprio perfil. Multipart porque a foto vai junto.
   *
   * Limite de imagem igual ao do My Post: um retrato tirado com telemóvel
   * moderno passa dos dez megabytes com facilidade, e recusar a foto da mãe
   * por causa disso é a maneira mais rápida de ela desistir do cadastro.
   */
  @Patch('me/profile')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: TAMANHO_MAXIMO_IMAGEM } }))
  editarPerfil(
    @Body() dto: EditarPerfilDto,
    @Req() req: Request,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.profile.atualizarPerfil(req.usuario!.id, dto, foto)
  }

  @Get('me/profile')
  @UseGuards(AuthGuard)
  perfil(@Req() req: Request) {
    return this.profile.perfil(req.usuario!.id)
  }

  /** "Minhas Publicações" */
  /** "Meu Registro" — histórico lido dos eventos brutos. */
  @Get('me/record')
  @UseGuards(AuthGuard)
  registro(@Req() req: Request) {
    return this.profile.registro(req.usuario!.id)
  }

  // ── Consentimento ────────────────────────────────────────────────

  @Post('consent')
  @HttpCode(200)
  async consentir(@Body() dto: ConsentimentoDto, @Req() req: Request, @Res() res: Response) {
    const resultado = await this.consent.registrar(
      {
        granted: dto.granted,
        analytics: dto.analytics ?? false,
        marketing: dto.marketing ?? false,
      },
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
    dto: {
      projectId: string
      linkCode?: string
      utmSource?: string
      utmMedium?: string
      campaignRef?: string
    },
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
