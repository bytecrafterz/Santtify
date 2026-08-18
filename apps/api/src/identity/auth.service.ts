import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import { EventType, User } from '@pv/db'
import * as argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { AttributionService } from '../tracking/attribution.service'
import { EventsService } from '../tracking/events.service'
import { VisitContext } from '../tracking/attribution.types'

export interface ParDeTokens {
  accessToken: string
  refreshToken: string
}

export interface UsuarioPublico {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  role: string
  createdAt: Date
}

/**
 * Autenticação própria.
 *
 * O ponto que importa para o projeto inteiro está no cadastro: o `Visitor`
 * anônimo criado quando a pessoa escaneou o QR é LIGADO ao `User` recém-criado.
 * Sem isso, alguém que chegou pelo Instagram na segunda e se cadastrou na
 * quinta apareceria como cadastro de origem desconhecida, e o funil
 * "origem → visitante → cadastro" que o cliente contratou ficaria furado.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly attribution: AttributionService,
    private readonly events: EventsService,
  ) {}

  async registrar(
    dados: { email: string; password: string; displayName: string },
    ctx: VisitContext,
  ): Promise<{ user: UsuarioPublico; tokens: ParDeTokens; anonId: string | null }> {
    const email = dados.email.trim().toLowerCase()

    const existente = await this.prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existente) throw new ConflictException('Este e-mail já está cadastrado')

    // A atribuição é resolvida ANTES de criar o usuário: é o estado do
    // visitante no momento exato do cadastro que queremos congelar no evento.
    const visita = await this.attribution.resolveVisit(ctx)

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(dados.password),
        displayName: dados.displayName.trim(),
      },
    })

    // O elo que preserva tudo o que aconteceu antes do cadastro.
    await this.prisma.visitor.update({
      where: { id: visita.visitor.id },
      data: { userId: user.id },
    })

    await this.events.registrar({
      type: EventType.SIGNUP,
      attribution: { ...visita.attribution, userId: user.id },
    })

    return {
      user: this.publico(user),
      tokens: await this.emitirTokens(user),
      anonId: visita.anonIdGerado ? visita.visitor.anonId : null,
    }
  }

  async entrar(
    dados: { email: string; password: string },
    ctx: VisitContext,
  ): Promise<{ user: UsuarioPublico; tokens: ParDeTokens; anonId: string | null }> {
    const email = dados.email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({ where: { email } })

    // Mesma mensagem para e-mail inexistente e senha errada: não entregamos
    // a quem tenta adivinhar a informação de que a conta existe.
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('E-mail ou senha inválidos')
    }
    const senhaConfere = await argon2.verify(user.passwordHash, dados.password)
    if (!senhaConfere) throw new UnauthorizedException('E-mail ou senha inválidos')

    const visita = await this.attribution.resolveVisit({ ...ctx, userId: user.id })

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    await this.events.registrar({
      type: EventType.LOGIN,
      attribution: { ...visita.attribution, userId: user.id },
    })

    return {
      user: this.publico(user),
      tokens: await this.emitirTokens(user),
      anonId: visita.anonIdGerado ? visita.visitor.anonId : null,
    }
  }

  /**
   * Rotação de refresh token: o token usado é revogado e um novo é emitido.
   * Assim um token roubado tem janela curta e o uso pelo dono invalida o do
   * atacante (e vice-versa, o que torna o abuso detectável).
   */
  async renovar(refreshToken: string): Promise<ParDeTokens> {
    const hash = this.hashDeToken(refreshToken)
    const registro = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    })

    if (!registro || registro.revokedAt || registro.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada, entre novamente')
    }
    if (registro.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Conta indisponível')
    }

    await this.prisma.refreshToken.update({
      where: { id: registro.id },
      data: { revokedAt: new Date() },
    })

    return this.emitirTokens(registro.user)
  }

  async sair(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashDeToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  /**
   * Troca a senha de quem já está autenticado.
   *
   * Exige a senha atual mesmo já havendo sessão válida: sem isso, um aparelho
   * deixado aberto num balcão vira uma tomada de conta permanente — o token de
   * acesso na memória bastaria para trocar a senha e expulsar o dono.
   *
   * E revoga TODAS as sessões, não só as outras. Trocar a senha é o que se faz
   * quando se desconfia de que mais alguém entrou; se as sessões antigas
   * continuassem de pé, a troca não expulsaria esse alguém, que é justamente o
   * objetivo do gesto. Em troca emitimos um par novo aqui mesmo, para quem
   * trocou continuar dentro sem ter de entrar de novo.
   */
  async trocarSenha(userId: string, senhaAtual: string, senhaNova: string): Promise<ParDeTokens> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Sessão inválida')

    const confere = await argon2.verify(user.passwordHash, senhaAtual)
    if (!confere) throw new UnauthorizedException('A senha atual não confere')

    if (senhaAtual === senhaNova) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(senhaNova) },
    })

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    this.logger.log(`Senha trocada: ${user.id}`)
    return this.emitirTokens(user)
  }

  async porId(userId: string): Promise<UsuarioPublico | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    return user && user.status === 'ACTIVE' ? this.publico(user) : null
  }

  private async emitirTokens(user: User): Promise<ParDeTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // O tipo de expiresIn é um literal ('15m', '1h'); o valor chega do
        // ambiente como string comum, então a conversão acontece aqui.
        expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ??
          '15m') as JwtSignOptions['expiresIn'],
      },
    )

    // O refresh não é JWT: é aleatório e guardado só como hash. Se o banco
    // vazar, os tokens em circulação não são reconstruíveis a partir dele.
    const refreshToken = randomBytes(48).toString('base64url')
    const dias = this.diasDeTtl(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d')

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashDeToken(refreshToken),
        expiresAt: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
      },
    })

    return { accessToken, refreshToken }
  }

  private hashDeToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private diasDeTtl(ttl: string): number {
    const m = /^(\d+)d$/.exec(ttl.trim())
    return m ? Number(m[1]) : 30
  }

  private publico(user: User): UsuarioPublico {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
    }
  }
}
