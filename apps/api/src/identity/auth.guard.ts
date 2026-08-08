import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Reflector } from '@nestjs/core'
import { SetMetadata } from '@nestjs/common'
import type { Request } from 'express'

export interface UsuarioDoToken {
  id: string
  email: string
  role: string
}

declare module 'express' {
  interface Request {
    usuario?: UsuarioDoToken
  }
}

/**
 * Marca uma rota como opcionalmente autenticada: se houver token válido, o
 * usuário é anexado; se não houver, a requisição segue como anônima.
 *
 * Existe porque a maior parte do app é lida por quem ainda não tem conta —
 * quem escaneou o QR. Exigir login para ver uma letra mataria o funil.
 */
export const AUTH_OPCIONAL = 'authOpcional'
export const AuthOpcional = () => SetMetadata(AUTH_OPCIONAL, true)

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<Request>()
    const opcional = this.reflector.getAllAndOverride<boolean>(AUTH_OPCIONAL, [
      contexto.getHandler(),
      contexto.getClass(),
    ])

    const token = this.tokenDoCabecalho(req)
    if (!token) {
      if (opcional) return true
      throw new UnauthorizedException('Autenticação necessária')
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; role: string }>(
        token,
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') },
      )
      req.usuario = { id: payload.sub, email: payload.email, role: payload.role }
      return true
    } catch {
      if (opcional) return true
      throw new UnauthorizedException('Sessão inválida ou expirada')
    }
  }

  private tokenDoCabecalho(req: Request): string | null {
    const cabecalho = req.get('authorization')
    if (!cabecalho) return null
    const [tipo, valor] = cabecalho.split(' ')
    return tipo?.toLowerCase() === 'bearer' && valor ? valor : null
  }
}

/** Exige papel de administrador. Usado no painel. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const req = contexto.switchToHttp().getRequest<Request>()
    if (req.usuario?.role !== 'ADMIN') {
      throw new UnauthorizedException('Acesso restrito ao administrador')
    }
    return true
  }
}
