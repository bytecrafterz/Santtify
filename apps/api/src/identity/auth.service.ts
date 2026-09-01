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
import { EventType, MediaKind, User } from '@pv/db'
import * as argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { AttributionService } from '../tracking/attribution.service'
import { EventsService } from '../tracking/events.service'
import { MailService } from '../common/mail/mail.service'
import { VisitContext } from '../tracking/attribution.types'
import { StorageService } from '../admin/storage.service'
import {
  MAX as MAX_UTILIZADOR,
  normalizarNomeDeUtilizador,
  problemaNoNomeDeUtilizador,
} from './nome-de-utilizador'
import { limparNomeDePerfil, problemaNoNomeDePerfil } from './nome-de-perfil'

export interface ParDeTokens {
  accessToken: string
  refreshToken: string
}

export interface UsuarioPublico {
  id: string
  email: string
  displayName: string
  /** O @identificador. Nulo nas contas criadas antes de 01/09. */
  username: string | null
  avatarUrl: string | null
  /**
   * A descrição pessoal e o responsável VIAJAM COM A SESSÃO.
   *
   * Faltavam aqui, e o defeito que isso causou é o de 28/08: o topo do perfil
   * monta-se a partir deste objecto, e como ele não trazia a descrição, o
   * cabeçalho escrevia `bio: null` à mão e mostrava sempre o texto de exemplo.
   * A descrição estava gravada, aparecia na edição, e não aparecia
   * publicamente. Ele descreveu-o exactamente assim: "o sistema está
   * armazenando o texto, mas não está mostrando".
   */
  bio: string | null
  guardianName: string | null
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
    private readonly storage: StorageService,
  ) {}

  /**
   * O identificador está livre? E, se não estiver, qual seria.
   *
   * Responde sempre, mesmo a um identificador mal formado: quem está a
   * escrever no telemóvel quer saber já que "joão silva" não serve, e não
   * depois de submeter.
   */
  async identificadorLivre(
    bruto: string,
  ): Promise<{ nome: string; livre: boolean; problema: string | null; sugestao: string | null }> {
    const nome = normalizarNomeDeUtilizador(bruto)
    const problema = problemaNoNomeDeUtilizador(nome)
    if (problema) return { nome, livre: false, problema, sugestao: null }
    const tomado = await this.prisma.user.findUnique({
      where: { username: nome },
      select: { id: true },
    })
    if (!tomado) return { nome, livre: true, problema: null, sugestao: null }
    return {
      nome,
      livre: false,
      problema: 'Este identificador já está em uso.',
      sugestao: await this.identificadorLivrePerto(nome),
    }
  }

  /**
   * O primeiro identificador livre a partir de um que está tomado.
   *
   * Tenta o nome com um número atrás, e o número não é aleatório de propósito:
   * `@joaosilva2` diz-se ao telefone, `@joaosilva8842` não. Ao fim de algumas
   * tentativas desiste e devolve `null`, porque uma sugestão feia é pior do
   * que nenhuma.
   */
  private async identificadorLivrePerto(base: string): Promise<string | null> {
    const raiz = base.slice(0, MAX_UTILIZADOR - 3)
    for (let i = 2; i <= 40; i++) {
      const tentativa = `${raiz}${i}`
      const existe = await this.prisma.user.findUnique({
        where: { username: tentativa },
        select: { id: true },
      })
      if (!existe) return tentativa
    }
    return null
  }

  async registrar(
    dados: { email: string; password: string; displayName: string; username: string },
    ctx: VisitContext,
    foto?: Express.Multer.File,
  ): Promise<{ user: UsuarioPublico; tokens: ParDeTokens; anonId: string | null }> {
    const email = dados.email.trim().toLowerCase()

    /*
      A FOTOGRAFIA É EXIGIDA AQUI, e não só no formulário.
      Uma exigência que só existe no navegador não é uma exigência: é uma
      sugestão que qualquer pedido feito por fora ignora, e foi um perfil sem
      foto nem nome que o levou a escrever este requisito.
    */
    if (!foto) throw new BadRequestException('Escolha uma fotografia de perfil para continuar.')
    if (this.storage.tipoDe(foto.mimetype) !== MediaKind.IMAGE) {
      throw new BadRequestException('A foto do perfil precisa ser uma imagem.')
    }

    // O nome tem de ser um nome. Pedido dele em 01/09, depois de "Pf 005981".
    const problemaNoNome = problemaNoNomeDePerfil(dados.displayName)
    if (problemaNoNome) throw new BadRequestException(problemaNoNome)

    const username = normalizarNomeDeUtilizador(dados.username)
    const problema = problemaNoNomeDeUtilizador(username)
    if (problema) throw new BadRequestException(problema)

    const existente = await this.prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existente) throw new ConflictException('Este e-mail já está cadastrado')

    const tomado = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (tomado) throw new ConflictException(`O identificador @${username} já está em uso.`)

    // A atribuição é resolvida ANTES de criar o usuário: é o estado do
    // visitante no momento exato do cadastro que queremos congelar no evento.
    const visita = await this.attribution.resolveVisit(ctx)

    // A foto sobe antes de a conta existir: se o envio falhar, não fica uma
    // conta meia feita à espera de uma fotografia que nunca chegou.
    const retrato = await this.storage.salvar(foto)

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(dados.password),
        displayName: limparNomeDePerfil(dados.displayName),
        username,
        avatarUrl: retrato.url,
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

    if (!registro || registro.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada, entre novamente')
    }

    /**
     * UMA FOLGA DE UM MINUTO PARA QUEM TEM REDE MÁ.
     *
     * Antes, o token antigo era revogado no instante em que se trocava. Basta
     * a resposta perder-se pelo caminho — e num telemóvel que acaba de acordar,
     * perde-se — para o aparelho ficar com um token que o servidor já matou.
     * A sessão morria sem ninguém ter feito nada de errado, e foi isso que o
     * cliente descreveu: três horas fora, e ao voltar tinha de entrar de novo.
     *
     * Um token TROCADO continua a servir durante um minuto e devolve um par
     * novo. Um minuto chega para uma repetição e não chega para nada mais: um
     * token roubado teria de ser usado nesse minuto exacto, com o dono a
     * trocá-lo ao mesmo tempo.
     *
     * SAIR DA CONTA CONTINUA A VALER NO INSTANTE. É por isso que são duas
     * colunas: `revokedAt` sem `rotatedAt` é uma porta fechada à chave, e
     * nenhuma folga a abre.
     */
    const FOLGA_MS = 60 * 1000
    if (registro.revokedAt) {
      const trocadoAgora =
        registro.rotatedAt && Date.now() - registro.rotatedAt.getTime() < FOLGA_MS
      if (!trocadoAgora) {
        throw new UnauthorizedException('Sessão expirada, entre novamente')
      }
      this.logger.log(`Troca repetida dentro da folga: ${registro.userId}`)
    }

    if (registro.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Conta indisponível')
    }

    // Só marca à primeira. Repetir dentro da folga não empurra a folga para a
    // frente, senão um aparelho a repetir em ciclo mantinha o token vivo para
    // sempre.
    if (!registro.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: registro.id },
        data: { revokedAt: new Date(), rotatedAt: new Date() },
      })
    }

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

  /**
   * A pessoa apaga a própria conta.
   *
   * Pede a senha outra vez porque este é o único botão da plataforma que não
   * tem volta: quem chegar aqui por engano, ou num telemóvel que ficou
   * desbloqueado em cima da mesa, esbarra na senha antes de perder o perfil.
   *
   * Não marca apenas `DELETED` e vai embora. `DELETED` esconde a pessoa de
   * todo o lado (o login, o perfil público, as listas, as contagens já filtram
   * por `ACTIVE`), mas esconder não é apagar: o nome, o email, a foto e o nome
   * do responsável continuariam na base. Numa plataforma usada por crianças
   * isso é precisamente o que não pode ficar para trás. Por isso os dados
   * pessoais são substituídos na mesma transacção em que a conta fecha.
   *
   * O que fica é o rasto anónimo: os eventos, as visitas e as contagens do
   * projecto continuam a somar, sem nada que ligue de volta a uma pessoa. O
   * `Event` é append-only por gatilho na base de dados e não se apaga aqui
   * nem se apagaria noutro sítio.
   */
  async apagarConta(userId: string, senha: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Sessão inválida')

    // 400 e não 401: a sessão está boa, o campo é que está errado. Com 401 o
    // navegador tentaria renovar a sessão e repetir o pedido, e uma senha
    // enganada passaria a rodar os tokens da pessoa sem motivo nenhum.
    const confere = await argon2.verify(user.passwordHash, senha)
    if (!confere) throw new BadRequestException('A senha não confere')

    /*
      O anfitrião de um projecto não pode desaparecer por baixo do projecto.
      `content.service.ts` procura o perfil do anfitrião pelo `hostUserId` e a
      página do projecto ficaria sem dono. Quem está nessa posição fala com a
      administração; não fica com um botão que parte o site dos outros.
    */
    const anfitriaoDe = await this.prisma.project.count({ where: { hostUserId: user.id } })
    if (anfitriaoDe > 0) {
      throw new BadRequestException(
        'Esta conta é a anfitriã de um projeto. Fale com a administração antes de a apagar.',
      )
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          email: `apagado-${user.id}@apagado.invalid`,
          displayName: 'Conta apagada',
          avatarUrl: null,
          bio: null,
          guardianName: null,
          // Uma senha que ninguém tem. Não é `null` porque a coluna é obrigatória,
          // e não é a antiga porque a antiga é reutilizada noutros sítios pela pessoa.
          passwordHash: await argon2.hash(randomBytes(32).toString('hex')),
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      // Os pedidos de reposição pendentes fecham, e o endereço que ficou escrito
      // em cada um deles sai também: `emailPedido` guarda o email tal como foi
      // digitado, e apagar a conta sem o apagar deixaria o email para trás.
      this.prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordReset.updateMany({
        where: { userId: user.id },
        data: { emailPedido: `apagado-${user.id}@apagado.invalid`, tokenHash: null },
      }),
    ])

    this.logger.log(`Conta apagada a pedido da pessoa: ${user.id}`)
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

    this.logger.warn(
      `Pedido de reposição de senha: ${endereco} (conta ${user ? 'existe' : 'não existe'})`,
    )
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
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      guardianName: user.guardianName,
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
