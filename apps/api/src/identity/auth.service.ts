import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
import { MailService } from '../common/mail/mail.service'
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
    private readonly mail: MailService,
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

  // ── REPOSIÇÃO DE SENHA (23/08) ─────────────────────────────────────
  //
  // A irmã do cliente ficou sem entrar e ele só soube porque ela lhe
  // telefonou. A frase dele resume o problema melhor do que eu conseguiria:
  // "se acontecesse com dez ou cem pessoas desconhecidas, elas poderiam
  // desistir, e nós nunca saberíamos".
  //
  // Enquanto não houver serviço de envio de e-mail, o caminho é este: a pessoa
  // pede, o pedido aparece ao responsável, ele gera um link de uso único e
  // manda-lho por onde já falam. Não é automático, mas é RASTREADO — e o que
  // fazia perder pessoas em silêncio era não haver registo nenhum de que
  // alguém tinha tentado.

  /**
   * Regista um pedido de reposição.
   *
   * RESPONDE SEMPRE O MESMO, exista a conta ou não. Um formulário que diz
   * "esse e-mail não existe" é um formulário que confirma quais e-mails
   * existem, e numa comunidade infantil isso é uma lista de contactos de
   * crianças a ser oferecida a quem perguntar.
   */
  async pedirReposicao(email: string, projectId?: string | null) {
    const endereco = email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({
      where: { email: endereco },
      select: { id: true, status: true },
    })

    // Um pedido por endereço a cada dez minutos. Sem isto, um engano de quem
    // toca várias vezes enche a lista do responsável e esconde os pedidos
    // verdadeiros no meio de repetições.
    const recente = await this.prisma.passwordReset.findFirst({
      where: {
        emailPedido: endereco,
        createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
        usedAt: null,
      },
      select: { id: true },
    })
    if (recente) return { registado: true }

    const pedido = await this.prisma.passwordReset.create({
      data: {
        emailPedido: endereco,
        userId: user?.status === 'ACTIVE' ? user.id : null,
        projectId: projectId ?? null,
      },
      select: { id: true, project: { select: { slug: true } } },
    })

    /**
     * COM SERVIÇO DE ENVIO, A PESSOA NÃO ESPERA POR NINGUÉM.
     *
     * O caminho pelo painel continua a existir e não vai desaparecer: é o que
     * salva quem escreveu o endereço errado, quem nunca se registou, e o dia em
     * que o serviço de envio estiver em baixo. Mas deixa de ser o caminho
     * normal, que era a crítica dele e era justa — repor à mão não escala.
     *
     * Só se manda a quem TEM conta. A quem não tem não se manda nada, e não se
     * lhe diz nada: a resposta no ecrã é a mesma para os dois casos, senão o
     * formulário passa a confirmar que endereços existem.
     */
    if (user?.status === 'ACTIVE' && this.mail.activo) {
      const token = randomBytes(32).toString('base64url')
      await this.prisma.passwordReset.update({
        where: { id: pedido.id },
        data: {
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          atendidoEm: new Date(),
        },
      })

      const base = this.config.get<string>('PUBLIC_WEB_URL') ?? 'https://santtify.com'
      const slug = pedido.project?.slug
      const url = `${base}${slug ? `/${slug}` : ''}/repor-senha?t=${token}`

      const envio = await this.mail.enviar({
        para: endereco,
        assunto: 'Repor a sua senha — Santtify',
        texto: `Recebemos um pedido para repor a sua senha.\n\nAbra este endereço para escolher uma senha nova:\n${url}\n\nO link vale 24 horas e serve uma vez só.\n\nSe não foi você que pediu, ignore esta mensagem — a sua senha continua a mesma.`,
        html: linkDeReposicaoEmHtml(url),
      })

      // Se o envio falhar, o pedido fica por atender e aparece ao responsável.
      // Assim uma avaria no serviço de e-mail não deixa a pessoa sem saída
      // nenhuma — só a devolve ao caminho mais lento.
      if (!envio.enviado) {
        await this.prisma.passwordReset.update({
          where: { id: pedido.id },
          data: { tokenHash: null, expiresAt: null, atendidoEm: null },
        })
        this.logger.error(`Reposição por e-mail falhou para ${endereco}; fica para o painel.`)
      }
    }

    this.logger.warn(`Pedido de reposição de senha: ${endereco} (conta ${user ? 'existe' : 'não existe'})`)
    return { registado: true }
  }

  /**
   * O responsável atende um pedido: nasce um link de uso único, válido 24h.
   *
   * O token completo é devolvido UMA VEZ e nunca mais. Na base fica só o
   * resumo — quem tiver acesso à base de dados não entra na conta de ninguém
   * com o que está lá guardado.
   */
  async atenderPedido(pedidoId: string, baseUrl: string) {
    const pedido = await this.prisma.passwordReset.findUnique({
      where: { id: pedidoId },
      select: { id: true, userId: true, usedAt: true, project: { select: { slug: true } } },
    })
    if (!pedido) throw new NotFoundException('Pedido não encontrado')
    if (!pedido.userId) {
      throw new BadRequestException(
        'Este endereço não tem conta. Peça à pessoa que confirme o e-mail com que se registou.',
      )
    }
    if (pedido.usedAt) throw new BadRequestException('Este pedido já foi usado.')

    const token = randomBytes(32).toString('base64url')
    await this.prisma.passwordReset.update({
      where: { id: pedidoId },
      data: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        atendidoEm: new Date(),
      },
    })

    const slug = pedido.project?.slug ?? ''
    const caminho = slug ? `/${slug}/repor-senha` : '/repor-senha'
    return { url: `${baseUrl}${caminho}?t=${token}`, validoAte: '24 horas' }
  }

  /** A pessoa usa o link e define a senha nova. */
  async reporSenha(token: string, senhaNova: string): Promise<ParDeTokens> {
    const resumo = createHash('sha256').update(token).digest('hex')
    const pedido = await this.prisma.passwordReset.findFirst({
      where: { tokenHash: resumo, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    })
    if (!pedido?.userId) {
      throw new BadRequestException('Este link já foi usado ou expirou. Peça um novo.')
    }

    const user = await this.prisma.user.findUnique({ where: { id: pedido.userId } })
    if (!user || user.status !== 'ACTIVE') throw new BadRequestException('Conta indisponível')

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(senhaNova) },
      }),
      // O link serve uma vez. Sem isto, quem o reencaminhasse sem querer —
      // num grupo, por exemplo — dava a conta a quem o lesse.
      this.prisma.passwordReset.update({
        where: { id: pedido.id },
        data: { usedAt: new Date() },
      }),
      // Todas as sessões antigas caem. Se a senha foi reposta porque alguém
      // entrou na conta, deixar a sessão dessa pessoa aberta não resolvia nada.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])

    this.logger.log(`Senha reposta por link: ${user.id}`)
    return this.emitirTokens(user)
  }

  /**
   * A lista para o responsável, com o que ele precisa de decidir.
   *
   * Vem junto a contagem de quantas pessoas diferentes bateram no mesmo
   * problema — que foi exactamente o que ele pediu para não voltar a confundir
   * avaria com desinteresse.
   */
  async pedidosDeReposicao(projectId: string) {
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const pedidos = await this.prisma.passwordReset.findMany({
      where: { projectId, createdAt: { gt: desde } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        emailPedido: true,
        createdAt: true,
        atendidoEm: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { id: true, displayName: true } },
      },
    })

    const porAtender = pedidos.filter((p) => !p.atendidoEm && !p.usedAt)
    return {
      pedidos,
      resumo: {
        porAtender: porAtender.length,
        pessoasAfectadas: new Set(porAtender.map((p) => p.emailPedido)).size,
        semConta: porAtender.filter((p) => !p.user).length,
      },
    }
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

/**
 * O corpo do e-mail de reposição.
 *
 * Tabelas e estilos em linha, e não folha de estilos: os clientes de e-mail
 * deitam fora quase tudo o que não seja isto, e o Gmail deita fora o resto. O
 * que aqui parece antiquado é o que garante que a mensagem se lê no telemóvel
 * de uma mãe com um Android de 2019.
 *
 * O botão é um link com fundo, e o endereço aparece também em texto por baixo:
 * há clientes que não desenham fundos, e aí sobra sempre alguma coisa para
 * tocar.
 */
function linkDeReposicaoEmHtml(url: string): string {
  return `<!doctype html>
<html lang="pt"><body style="margin:0;padding:24px;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#171a22">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:20px">Repor a sua senha</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5">Recebemos um pedido para repor a sua senha na Santtify. Toque no botão para escolher uma nova.</p>
      <p style="margin:0 0 18px">
        <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">ESCOLHER SENHA NOVA</a>
      </p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#5b6478">Se o botão não funcionar, copie este endereço:<br><span style="word-break:break-all">${url}</span></p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5b6478">O link vale 24 horas e serve uma vez só. Se não foi você que pediu, ignore esta mensagem — a sua senha continua a mesma.</p>
    </td></tr>
  </table>
</body></html>`
}
