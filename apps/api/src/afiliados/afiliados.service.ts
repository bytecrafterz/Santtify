import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  EstadoDaComissao,
  EstadoDoAfiliado,
  OrigemDoAfiliado,
  Platform,
  Prisma,
  ShortLinkKind,
  type Afiliado,
  type ComissaoDeAfiliado,
  type ConfiguracaoDeAfiliados,
  type ShortLink,
  type Visitor,
} from '@pv/db'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../common/mail/mail.service'
import { sugerirNomeDeUtilizador } from '../identity/nome-de-utilizador'
import { comissaoDe, diaUtc, nomeResumido, reais, somarDias, taxaEstimadaDe } from './dinheiro'
import { ehRobo } from './robos'
import { AGORA } from './sql'
import { normalizarChavePix, type TipoDeChavePix } from './pix'
import {
  emailDeAreaLiberada,
  emailDeComissaoDisponivel,
  emailDeNovaVenda,
  emailDePagamentoFeito,
} from './emails'

/**
 * O programa está cheio — ver `vagas` na configuração.
 *
 * Do botão Liberar, chega ao painel com esta mensagem. Da compra, é apanhada
 * em `aoConfirmarPagamento`: a compra vale, só não abre área nova.
 */
export class VagasEsgotadas extends ConflictException {
  constructor(vagas: number) {
    super(
      `As ${vagas} vagas de afiliado estão preenchidas. Aumente o número de vagas em Configurações para liberar mais alguém.`,
    )
  }
}

/** Como a comissão aparece a quem a vê: "disponível" é calculado, não guardado. */
export type EstadoVisivelDaComissao = 'PENDENTE' | 'DISPONIVEL' | 'PAGA' | 'CANCELADA' | 'ESTORNADA'

export function estadoVisivel(
  c: Pick<ComissaoDeAfiliado, 'estado' | 'liberaEm'>,
  agora = new Date(),
): EstadoVisivelDaComissao {
  if (c.estado === EstadoDaComissao.PENDENTE && c.liberaEm <= agora) return 'DISPONIVEL'
  return c.estado
}

export interface Saldo {
  vendas: number
  geradaCent: number
  pendenteCent: number
  disponivelCent: number
  /** Estornos de vendas já pagas, a descontar do próximo pagamento. */
  aDescontarCent: number
  /** O que se pode pagar agora: disponível menos descontos, nunca negativo. */
  aPagarCent: number
  recebidoCent: number
}

/** O que muda na configuração, validado pelo DTO do controlador. */
export interface AlteracaoDaConfiguracao {
  ativo?: boolean
  comissaoBp?: number
  diasDeCarencia?: number
  diasDeAtribuicao?: number
  minimoParaPagamentoCent?: number
  destino?: string | null
  mensagemDoWhatsapp?: string
  regulamento?: string | null
  taxaPixBp?: number
  taxaCartaoBp?: number
  emailDeAvisos?: string | null
  vagas?: number
  simulacaoKits?: number
  simulacaoPrecoNormalCent?: number
  simulacaoPrecoPromocionalCent?: number
}

/**
 * O programa de afiliados.
 *
 * A REGRA DO CLIENTE, 25/09: nada de aprovação manual. "Se funcionar para 10
 * pessoas, precisa funcionar da mesma maneira para 1 milhão." Por isso tudo o
 * que acontece no caminho normal acontece aqui, disparado pelos factos — o
 * Mercado Pago confirmou, alguém abriu um link — e nunca por um botão:
 *
 *   compra confirmada ──► área liberada + link criado     (`aoConfirmarPagamento`)
 *   link aberto ────────► clique registado, 1 por dia     (`registarClique`)
 *   pedido criado ──────► venda atribuída ao afiliado     (`atribuir`)
 *   compra confirmada ──► comissão pendente               (`aoConfirmarPagamento`)
 *   prazo passou ───────► disponível (calculado da data)
 *   reembolso ──────────► comissão cancelada ou estornada (`aoReembolsar`)
 *
 * O painel só MONITORA, CONFIGURA, SUSPENDE e PAGA.
 *
 * NADA DAQUI PODE PARTIR UM PAGAMENTO. Quem chama a partir do caminho do
 * dinheiro (o aviso do Mercado Pago) apanha os erros: um afiliado que não
 * nasceu é um problema pequeno; um pedido pago que não destrancou os cartões
 * da mãe é um problema grande.
 */
@Injectable()
export class AfiliadosService {
  private readonly logger = new Logger(AfiliadosService.name)
  private readonly webUrl: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = (config.get<string>('PUBLIC_WEB_URL') ?? '').replace(/\/+$/, '')
  }

  // ─────────────────────────────────────────────────────────────────
  // CONFIGURAÇÃO
  // ─────────────────────────────────────────────────────────────────

  async configuracao(): Promise<ConfiguracaoDeAfiliados> {
    const existente = await this.prisma.configuracaoDeAfiliados.findUnique({ where: { id: 'global' } })
    if (existente) return existente
    // A migração cria-a; isto é só para uma base nova nunca abrir o painel vazio.
    return this.prisma.configuracaoDeAfiliados.upsert({
      where: { id: 'global' },
      update: {},
      create: { id: 'global' },
    })
  }

  /** As vagas do programa: quantas há, e quantas já têm afiliado. */
  async vagas(cfg?: ConfiguracaoDeAfiliados): Promise<{ total: number; ocupadas: number }> {
    const config = cfg ?? (await this.configuracao())
    return { total: config.vagas, ocupadas: await this.prisma.afiliado.count() }
  }

  async actualizarConfiguracao(dados: AlteracaoDaConfiguracao, adminId: string) {
    const antes = await this.configuracao()

    if (dados.destino !== undefined && dados.destino !== null) {
      const destino = dados.destino.trim()
      /*
        SÓ UM CAMINHO DO PRÓPRIO SITE.

        Um endereço inteiro aqui faria de cada link de afiliado um
        redireccionamento para onde quer que alguém escrevesse — o link da
        Santtify a levar para um site de fraude. "//" também não: o navegador
        lê "//outro.com" como outro domínio.
      */
      if (!/^\/(?!\/)[^\s]*$/.test(destino)) {
        throw new BadRequestException('O destino é um caminho do site, começado por "/". Ex.: /projeto/cartoes')
      }
      dados.destino = destino
    }
    if (dados.mensagemDoWhatsapp !== undefined && !dados.mensagemDoWhatsapp.trim()) {
      throw new BadRequestException('Escreva a mensagem que acompanha o link.')
    }
    if (dados.emailDeAvisos) dados.emailDeAvisos = dados.emailDeAvisos.trim().toLowerCase()
    if (dados.regulamento !== undefined) dados.regulamento = dados.regulamento?.trim() || null

    const depois = await this.prisma.configuracaoDeAfiliados.update({
      where: { id: 'global' },
      data: { ...dados, atualizadoPorId: adminId },
    })

    // O destino mudou: os links que já andam por aí passam a levar ao novo.
    if (dados.destino !== undefined && dados.destino !== antes.destino) {
      const destino = await this.destinoDoLink(depois)
      await this.prisma.shortLink.updateMany({
        where: { kind: ShortLinkKind.AFILIADO },
        data: { targetUrl: destino.url, projectId: destino.projectId },
      })
    }

    const mudou = Object.fromEntries(
      Object.entries(dados).filter(([k, v]) => (antes as Record<string, unknown>)[k] !== v),
    )
    await this.auditar(adminId, 'afiliados.configurar', 'ConfiguracaoDeAfiliados', 'global', mudou)
    return depois
  }

  /**
   * A loja: a página dos cartões do primeiro projeto que os vende.
   *
   * É para onde vai o link quando o painel não escolheu destino, e para onde
   * aponta o botão "Comprar meu primeiro conjunto" da área bloqueada.
   */
  private async lojaPadrao(): Promise<{ path: string; projectId: string } | null> {
    const categoria = await this.prisma.categoriaDeCartoes.findFirst({
      where: { ativo: true, ofertaEmBreve: false, modelos: { some: { ativo: true } } },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      include: { project: { select: { id: true, slug: true } } },
    })
    if (!categoria) return null
    return {
      path: `/${categoria.project.slug}/cartoes?categoria=${encodeURIComponent(categoria.slug)}`,
      projectId: categoria.project.id,
    }
  }

  async destinoDoLink(cfg?: ConfiguracaoDeAfiliados): Promise<{ url: string; path: string; projectId: string }> {
    const regras = cfg ?? (await this.configuracao())
    const padrao = await this.lojaPadrao()
    const path = regras.destino ?? padrao?.path ?? '/'
    let projectId = padrao?.projectId ?? null

    const slug = path.split(/[/?#]/)[1]
    if (slug) {
      const projeto = await this.prisma.project.findUnique({ where: { slug }, select: { id: true } })
      if (projeto) projectId = projeto.id
    }
    if (!projectId) {
      const qualquer = await this.prisma.project.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
      projectId = qualquer?.id ?? null
    }
    if (!projectId) throw new NotFoundException('Nenhum projeto para onde levar o link.')
    return { url: `${this.webUrl}${path}`, path, projectId }
  }

  /** O slug do projeto da loja, para os endereços do painel nos e-mails. */
  private async slugDaLoja(): Promise<string> {
    const destino = await this.destinoDoLink().catch(() => null)
    return destino?.path.split(/[/?#]/)[1] || ''
  }

  private async urlDoPainel(): Promise<string> {
    const slug = await this.slugDaLoja()
    return `${this.webUrl}${slug ? `/${slug}` : ''}/afiliado`
  }

  /** O link que o afiliado partilha. */
  linkPublico(codigo: string): string {
    return `${this.webUrl}/af/${codigo}`
  }

  // ─────────────────────────────────────────────────────────────────
  // DESBLOQUEIO E LINK
  // ─────────────────────────────────────────────────────────────────

  /**
   * O código do link, a partir do @identificador.
   *
   * Sem identificador (contas antigas), a partir do nome. O código é único
   * entre afiliados; quem chega segundo com o mesmo recebe um número à frente.
   */
  private async codigoLivre(user: { id: string; username: string | null; displayName: string }): Promise<string> {
    const limpo = (texto: string) => texto.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30)
    let base = limpo(user.username ?? sugerirNomeDeUtilizador(user.displayName))
    if (base.length < 3 || !/^[a-z]/.test(base)) base = `u${user.id.replace(/-/g, '').slice(0, 10)}`

    for (let i = 0; i < 50; i++) {
      const tentativa = i === 0 ? base : `${base.slice(0, 27)}${i + 1}`
      const existe = await this.prisma.afiliado.findUnique({ where: { codigo: tentativa }, select: { id: true } })
      if (!existe) return tentativa
    }
    return `${base.slice(0, 20)}${randomBytes(4).toString('hex')}`
  }

  /**
   * A área de afiliado desta pessoa, criada se ainda não existir.
   *
   * Idempotente: o segundo aviso do mesmo pagamento, ou uma segunda compra,
   * encontram-na feita e devolvem-na.
   */
  async garantirAfiliado(
    userId: string,
    origem: OrigemDoAfiliado,
    pedidoId?: string | null,
  ): Promise<{ afiliado: Afiliado; criado: boolean }> {
    const existente = await this.prisma.afiliado.findUnique({ where: { userId } })
    if (existente) return { afiliado: existente, criado: false }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, status: true },
    })
    if (!user || user.status !== 'ACTIVE') throw new NotFoundException('Conta não encontrada.')

    // AS VAGAS (05/10): "ao atingir o limite definido, novos cadastros ficam
    // automaticamente bloqueados". Quem já é afiliado saiu acima e não conta.
    const { total, ocupadas } = await this.vagas()
    if (ocupadas >= total) throw new VagasEsgotadas(total)

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const codigo = await this.codigoLivre(user)
      try {
        const afiliado = await this.prisma.afiliado.create({
          data: { userId, codigo, origem, pedidoDeDesbloqueioId: pedidoId ?? null },
        })
        await this.garantirLink(afiliado).catch((erro) =>
          this.logger.error(`Link do afiliado ${afiliado.id} não criado: ${String(erro)}`),
        )
        this.logger.log(`Área de afiliado liberada: ${codigo} (${origem})`)
        return { afiliado, criado: true }
      } catch (erro) {
        if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')) throw erro
        // Dois avisos ao mesmo tempo: o outro já a criou. Ou o código foi
        // apanhado entre a verificação e a criação — tenta-se outro.
        const agora = await this.prisma.afiliado.findUnique({ where: { userId } })
        if (agora) return { afiliado: agora, criado: false }
      }
    }
    throw new ConflictException('Não foi possível criar a área de afiliado agora.')
  }

  /**
   * O link rastreado do afiliado: o código curto `af-<código>`.
   *
   * Passa pela mesma porta de todos os links (`/r/`), e é isso que dá ao
   * clique do afiliado tudo o que os QR e as partilhas já tinham: o cookie
   * da pessoa, a origem, o país, a cadeia de propagação nas métricas.
   */
  async garantirLink(afiliado: Afiliado): Promise<ShortLink> {
    if (afiliado.linkId) {
      const existente = await this.prisma.shortLink.findUnique({ where: { id: afiliado.linkId } })
      if (existente) return existente
    }
    const destino = await this.destinoDoLink()
    const code = `af-${afiliado.codigo}`

    let link: ShortLink
    try {
      link = await this.prisma.shortLink.upsert({
        where: { code },
        update: {},
        create: {
          projectId: destino.projectId,
          code,
          kind: ShortLinkKind.AFILIADO,
          createdByUserId: afiliado.userId,
          targetUrl: destino.url,
          // Como uma partilha sem origem: a pessoa que partilha é o 1º salto.
          depth: 1,
          rootPlatform: Platform.PRODUTO_VIVO,
        },
      })
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')) throw erro
      link = await this.prisma.shortLink.findUniqueOrThrow({ where: { code } })
    }
    if (!link.rootShortLinkId) {
      link = await this.prisma.shortLink.update({ where: { id: link.id }, data: { rootShortLinkId: link.id } })
    }
    await this.prisma.afiliado.update({ where: { id: afiliado.id }, data: { linkId: link.id } })
    return link
  }

  /**
   * O link por detrás de um código `af-...` — criado agora se o afiliado
   * nasceu na migração e ainda ninguém o abriu. Nulo se não houver afiliado.
   */
  async linkDoCodigo(code: string): Promise<ShortLink | null> {
    if (!/^af-/i.test(code)) return null
    const codigo = code.slice(3).toLowerCase()
    const afiliado = await this.prisma.afiliado.findUnique({ where: { codigo } })
    if (!afiliado) return null
    return this.garantirLink(afiliado)
  }

  /** Para onde vai quem abre um link de afiliado que não existe: a loja. */
  async urlDaLoja(): Promise<string> {
    const destino = await this.destinoDoLink().catch(() => null)
    return destino?.url ?? `${this.webUrl}/`
  }

  // ─────────────────────────────────────────────────────────────────
  // CLIQUES E ATRIBUIÇÃO
  // ─────────────────────────────────────────────────────────────────

  /**
   * Um clique num link de afiliado.
   *
   * Não contam: robôs de pré-visualização (ver `robos.ts`), o próprio afiliado
   * a abrir o seu link, e afiliados suspensos. A mesma pessoa no mesmo dia é
   * UM clique — actualiza-se a hora, que é o que decide a venda.
   */
  async registarClique(link: ShortLink, visitor: Visitor, userAgent: string | null | undefined): Promise<void> {
    if (link.kind !== ShortLinkKind.AFILIADO) return
    if (ehRobo(userAgent)) return
    const afiliado = await this.prisma.afiliado.findUnique({
      where: { linkId: link.id },
      select: { id: true, userId: true, estado: true },
    })
    if (!afiliado || afiliado.estado !== EstadoDoAfiliado.ATIVO) return
    if (visitor.userId && visitor.userId === afiliado.userId) return

    const agora = new Date()
    const dia = diaUtc(agora)
    await this.prisma.cliqueDeAfiliado.upsert({
      where: { afiliadoId_visitorId_dia: { afiliadoId: afiliado.id, visitorId: visitor.id, dia } },
      create: { afiliadoId: afiliado.id, visitorId: visitor.id, dia, primeiroEm: agora, ultimoEm: agora },
      update: { ultimoEm: agora, vezes: { increment: 1 } },
    })
  }

  /**
   * A quem pertence uma compra que está a começar.
   *
   * O último link de afiliado que esta pessoa abriu dentro da janela — neste
   * aparelho (cookie) ou em qualquer aparelho onde ela tenha entrado com a
   * conta. Ninguém ganha comissão de uma compra sua: nem pela conta, nem pelo
   * aparelho onde a sua conta já entrou, nem pelo e-mail de pagamento.
   */
  async atribuir(p: {
    anonId?: string | null
    userId?: string | null
    email?: string | null
  }): Promise<string | null> {
    const cfg = await this.configuracao()
    if (!cfg.ativo) return null

    const visitantes: Array<{ id: string; userId: string | null }> = []
    if (p.anonId) {
      const v = await this.prisma.visitor.findUnique({
        where: { anonId: p.anonId },
        select: { id: true, userId: true },
      })
      if (v) visitantes.push(v)
    }
    if (p.userId) {
      visitantes.push(
        ...(await this.prisma.visitor.findMany({
          where: { userId: p.userId },
          select: { id: true, userId: true },
          orderBy: { lastSeenAt: 'desc' },
          take: 20,
        })),
      )
    }
    if (visitantes.length === 0) return null

    const clique = await this.prisma.cliqueDeAfiliado.findFirst({
      where: {
        visitorId: { in: [...new Set(visitantes.map((v) => v.id))] },
        ultimoEm: { gte: somarDias(new Date(), -cfg.diasDeAtribuicao) },
        afiliado: { estado: EstadoDoAfiliado.ATIVO },
      },
      orderBy: { ultimoEm: 'desc' },
      include: { afiliado: { select: { id: true, userId: true, user: { select: { email: true } } } } },
    })
    if (!clique) return null

    const dono = clique.afiliado.userId
    if (p.userId === dono) return null
    if (visitantes.some((v) => v.userId === dono)) return null
    if (p.email && p.email.trim().toLowerCase() === clique.afiliado.user.email.toLowerCase()) return null
    return clique.afiliado.id
  }

  // ─────────────────────────────────────────────────────────────────
  // O DINHEIRO: CONFIRMAÇÃO, COMISSÃO, REEMBOLSO
  // ─────────────────────────────────────────────────────────────────

  /**
   * O Mercado Pago confirmou um pagamento. Três coisas, por esta ordem:
   * a taxa do processador, a área de afiliado de quem comprou, e a comissão
   * de quem trouxe a compra.
   */
  async aoConfirmarPagamento(pedidoId: string, info: { taxaCent?: number | null } = {}): Promise<void> {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({ where: { id: pedidoId } })
    if (!pedido?.pagoEm) return
    const cfg = await this.configuracao()

    await this.registarTaxa(pedido.id, info.taxaCent ?? null)

    if (pedido.userId && cfg.ativo) {
      try {
        const { afiliado, criado } = await this.garantirAfiliado(pedido.userId, OrigemDoAfiliado.COMPRA, pedido.id)
        if (criado) void this.avisarAreaLiberada(afiliado, cfg)
      } catch (erro) {
        // Vagas esgotadas: a compra vale, a área é que não abre. E a comissão
        // de quem trouxe a venda segue abaixo na mesma.
        if (!(erro instanceof VagasEsgotadas)) throw erro
        this.logger.log(`Vagas de afiliado esgotadas: a compra ${pedido.id} não abriu área nova.`)
      }
    }

    await this.criarComissao(pedido.id)
  }

  /**
   * A taxa do processador. A verdadeira quando o aviso a traz; estimada pela
   * percentagem do painel quando não — e uma verdadeira que chegue depois
   * substitui a estimada.
   */
  async registarTaxa(pedidoId: string, taxaReal: number | null): Promise<void> {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({ where: { id: pedidoId } })
    if (!pedido?.pagoEm) return
    const real = taxaReal != null && Number.isFinite(taxaReal) && taxaReal >= 0
    if (pedido.taxaCent != null && !(real && pedido.taxaEstimada)) return
    const cfg = await this.configuracao()
    await this.prisma.pedidoDeCartoes.update({
      where: { id: pedido.id },
      data: {
        taxaCent: real ? Math.round(taxaReal) : taxaEstimadaDe(pedido.totalCent, pedido.meio, cfg),
        taxaEstimada: !real,
      },
    })
  }

  private async criarComissao(pedidoId: string): Promise<void> {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({
      where: { id: pedidoId },
      include: {
        comissao: { select: { id: true } },
        afiliado: { include: { user: { select: { email: true, displayName: true } } } },
      },
    })
    if (!pedido?.pagoEm || !pedido.afiliado || pedido.comissao) return
    const cfg = await this.configuracao()
    if (!cfg.ativo) return

    const afiliado = pedido.afiliado
    if (afiliado.estado !== EstadoDoAfiliado.ATIVO) {
      this.logger.warn(`Pedido ${pedido.id}: afiliado ${afiliado.codigo} suspenso, sem comissão.`)
      return
    }
    if (pedido.userId && pedido.userId === afiliado.userId) return
    if (pedido.emailDoComprador && pedido.emailDoComprador.toLowerCase() === afiliado.user.email.toLowerCase()) {
      return
    }

    const baseCent = pedido.totalCent - pedido.reembolsadoCent
    if (baseCent <= 0) return

    try {
      const comissao = await this.prisma.comissaoDeAfiliado.create({
        data: {
          afiliadoId: afiliado.id,
          pedidoId: pedido.id,
          baseCent,
          comissaoBp: cfg.comissaoBp,
          valorCent: comissaoDe(baseCent, cfg.comissaoBp),
          moeda: pedido.moeda,
          liberaEm: somarDias(pedido.pagoEm, cfg.diasDeCarencia),
        },
      })
      this.logger.log(`Comissão de ${comissao.valorCent} para ${afiliado.codigo} (pedido ${pedido.numero ?? pedido.id})`)
      void this.avisarNovaVenda(afiliado, comissao, cfg)
    } catch (erro) {
      // O índice único do pedido: o aviso repetido já criou esta comissão.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') return
      throw erro
    }
  }

  /**
   * O pedido foi (parcial ou totalmente) reembolsado — `reembolsadoCent` já
   * está actualizado no pedido quando isto corre.
   *
   * Ainda por pagar: a comissão encolhe na mesma proporção, ou cancela-se.
   * Já paga: o que deixou de ser devido fica a descontar no pagamento seguinte.
   */
  async aoReembolsar(pedidoId: string): Promise<void> {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({
      where: { id: pedidoId },
      include: { comissao: true },
    })
    const c = pedido?.comissao
    if (!pedido || !c) return

    const baseCent = Math.max(0, pedido.totalCent - pedido.reembolsadoCent)
    const devido = baseCent > 0 ? comissaoDe(baseCent, c.comissaoBp) : 0
    const agora = new Date()

    if (c.estado === EstadoDaComissao.PENDENTE) {
      await this.prisma.comissaoDeAfiliado.update({
        where: { id: c.id },
        data:
          devido > 0
            ? { baseCent, valorCent: devido }
            : {
                estado: EstadoDaComissao.CANCELADA,
                canceladaEm: agora,
                motivoDoCancelamento: 'Venda reembolsada',
              },
      })
      return
    }

    if (c.estado === EstadoDaComissao.PAGA || c.estado === EstadoDaComissao.ESTORNADA) {
      const estorno = Math.max(0, c.valorCent - devido)
      if (estorno <= c.estornoCent) return
      await this.prisma.comissaoDeAfiliado.update({
        where: { id: c.id },
        data: {
          estornoCent: estorno,
          estornadaEm: agora,
          estado: devido === 0 ? EstadoDaComissao.ESTORNADA : EstadoDaComissao.PAGA,
        },
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // SALDO E PAGAMENTOS
  // ─────────────────────────────────────────────────────────────────

  /** O saldo de vários afiliados de uma vez, para as listas do painel. */
  async saldos(afiliadoIds: string[]): Promise<Map<string, Saldo>> {
    const mapa = new Map<string, Saldo>()
    if (afiliadoIds.length === 0) return mapa
    const ids = Prisma.join(afiliadoIds.map((id) => Prisma.sql`${id}::uuid`))

    const comissoes = await this.prisma.$queryRaw<
      Array<{ id: string; vendas: bigint; gerada: bigint; pendente: bigint; disponivel: bigint; adescontar: bigint }>
    >(Prisma.sql`
      SELECT "afiliadoId" AS id,
             COUNT(*) FILTER (WHERE estado IN ('PENDENTE', 'PAGA')) AS vendas,
             COALESCE(SUM("valorCent" - "estornoCent") FILTER (WHERE estado <> 'CANCELADA'), 0) AS gerada,
             COALESCE(SUM("valorCent") FILTER (WHERE estado = 'PENDENTE' AND "liberaEm" > ${AGORA}), 0) AS pendente,
             COALESCE(SUM("valorCent") FILTER (WHERE estado = 'PENDENTE' AND "liberaEm" <= ${AGORA}), 0) AS disponivel,
             COALESCE(SUM("estornoCent" - "estornoDescontadoCent") FILTER (WHERE estado IN ('PAGA', 'ESTORNADA')), 0) AS adescontar
        FROM comissoes_de_afiliados
       WHERE "afiliadoId" IN (${ids})
       GROUP BY "afiliadoId"`)
    const pagos = await this.prisma.pagamentoAoAfiliado.groupBy({
      by: ['afiliadoId'],
      where: { afiliadoId: { in: afiliadoIds } },
      _sum: { valorCent: true },
    })

    for (const id of afiliadoIds) {
      mapa.set(id, {
        vendas: 0,
        geradaCent: 0,
        pendenteCent: 0,
        disponivelCent: 0,
        aDescontarCent: 0,
        aPagarCent: 0,
        recebidoCent: 0,
      })
    }
    for (const l of comissoes) {
      const s = mapa.get(l.id)!
      s.vendas = Number(l.vendas)
      s.geradaCent = Number(l.gerada)
      s.pendenteCent = Number(l.pendente)
      s.disponivelCent = Number(l.disponivel)
      s.aDescontarCent = Number(l.adescontar)
      s.aPagarCent = Math.max(0, s.disponivelCent - s.aDescontarCent)
    }
    for (const p of pagos) mapa.get(p.afiliadoId)!.recebidoCent = p._sum.valorCent ?? 0
    return mapa
  }

  async saldo(afiliadoId: string): Promise<Saldo> {
    return (await this.saldos([afiliadoId])).get(afiliadoId)!
  }

  /**
   * "Marcar como pago": o cliente pagou pelo Pix, no banco dele, e regista-o.
   *
   * Paga TUDO o que está disponível menos os estornos por descontar — o saldo
   * que o painel mostrava — e fica escrito quem marcou, quando, e para que
   * chave foi.
   */
  async pagar(afiliadoId: string, adminId: string, observacao?: string | null) {
    const pagamento = await this.prisma.$transaction(async (tx) => {
      // A linha do afiliado fica trancada até ao fim: dois cliques em "Marcar
      // como pago" — dois administradores, ou um toque duplo — não pagam o
      // mesmo saldo duas vezes.
      await tx.$queryRaw`SELECT id FROM afiliados WHERE id = ${afiliadoId}::uuid FOR UPDATE`
      const afiliado = await tx.afiliado.findUnique({ where: { id: afiliadoId } })
      if (!afiliado) throw new NotFoundException('Afiliado não encontrado.')
      if (afiliado.estado !== EstadoDoAfiliado.ATIVO) {
        throw new BadRequestException('Este afiliado está suspenso. Reative-o antes de pagar.')
      }

      const agora = new Date()
      const disponiveis = await tx.comissaoDeAfiliado.findMany({
        where: { afiliadoId, estado: EstadoDaComissao.PENDENTE, liberaEm: { lte: agora } },
        select: { id: true, valorCent: true },
      })
      const estornos = (
        await tx.comissaoDeAfiliado.findMany({
          where: { afiliadoId, estado: { in: [EstadoDaComissao.PAGA, EstadoDaComissao.ESTORNADA] } },
          select: { id: true, estornoCent: true, estornoDescontadoCent: true },
        })
      ).filter((c) => c.estornoCent > c.estornoDescontadoCent)

      const comissoesCent = disponiveis.reduce((t, c) => t + c.valorCent, 0)
      const descontosCent = estornos.reduce((t, c) => t + (c.estornoCent - c.estornoDescontadoCent), 0)
      const valorCent = comissoesCent - descontosCent
      if (valorCent <= 0) {
        throw new BadRequestException(
          disponiveis.length > 0
            ? 'Os reembolsos a descontar cobrem o saldo disponível. Não há nada a pagar agora.'
            : 'Não há saldo disponível para pagar.',
        )
      }

      const criado = await tx.pagamentoAoAfiliado.create({
        data: {
          afiliadoId,
          comissoesCent,
          descontosCent,
          valorCent,
          chavePix: afiliado.chavePix,
          nomeDoTitular: afiliado.nomeDoTitular,
          observacao: observacao?.trim() || null,
          pagoPorId: adminId,
          pagoEm: agora,
        },
      })

      // Só as que continuam pendentes: um reembolso que chegue no mesmo
      // instante cancela uma delas, e essa não pode ir paga.
      const pagas = await tx.comissaoDeAfiliado.updateMany({
        where: { id: { in: disponiveis.map((c) => c.id) }, estado: EstadoDaComissao.PENDENTE },
        data: { estado: EstadoDaComissao.PAGA, pagamentoId: criado.id, pagaEm: agora },
      })
      if (pagas.count !== disponiveis.length) {
        throw new ConflictException('O saldo mudou agora mesmo. Abra o afiliado outra vez e confira.')
      }
      for (const e of estornos) {
        await tx.comissaoDeAfiliado.update({
          where: { id: e.id },
          data: { estornoDescontadoCent: e.estornoCent, descontadaEm: agora, descontoPagamentoId: criado.id },
        })
      }
      await tx.adminAuditLog.create({
        data: {
          userId: adminId,
          action: 'afiliado.pagar',
          entityType: 'Afiliado',
          entityId: afiliadoId,
          changes: { pagamentoId: criado.id, valorCent, comissoes: disponiveis.length, descontosCent },
        },
      })
      return criado
    })

    void this.avisarPagamento(pagamento.afiliadoId, pagamento.valorCent, pagamento.moeda, pagamento.chavePix)
    return pagamento
  }

  // ─────────────────────────────────────────────────────────────────
  // O QUE O PAINEL CONTROLA
  // ─────────────────────────────────────────────────────────────────

  async suspender(afiliadoId: string, motivo: string | null | undefined, adminId: string) {
    const afiliado = await this.prisma.afiliado.findUnique({ where: { id: afiliadoId } })
    if (!afiliado) throw new NotFoundException('Afiliado não encontrado.')
    const actualizado = await this.prisma.afiliado.update({
      where: { id: afiliadoId },
      data: {
        estado: EstadoDoAfiliado.SUSPENSO,
        suspensoEm: new Date(),
        motivoDaSuspensao: motivo?.trim() || null,
      },
    })
    await this.auditar(adminId, 'afiliado.suspender', 'Afiliado', afiliadoId, { motivo: motivo ?? null })
    return actualizado
  }

  async reativar(afiliadoId: string, adminId: string) {
    const afiliado = await this.prisma.afiliado.findUnique({ where: { id: afiliadoId } })
    if (!afiliado) throw new NotFoundException('Afiliado não encontrado.')
    const actualizado = await this.prisma.afiliado.update({
      where: { id: afiliadoId },
      data: { estado: EstadoDoAfiliado.ATIVO, suspensoEm: null, motivoDaSuspensao: null },
    })
    await this.auditar(adminId, 'afiliado.reativar', 'Afiliado', afiliadoId, {})
    return actualizado
  }

  /** Cancelar uma comissão ainda por pagar — uma venda suspeita, por exemplo. */
  async cancelarComissao(comissaoId: string, motivo: string | null | undefined, adminId: string) {
    const c = await this.prisma.comissaoDeAfiliado.findUnique({ where: { id: comissaoId } })
    if (!c) throw new NotFoundException('Comissão não encontrada.')
    if (c.estado !== EstadoDaComissao.PENDENTE) {
      throw new BadRequestException('Só uma comissão ainda por pagar pode ser cancelada.')
    }
    const actualizada = await this.prisma.comissaoDeAfiliado.update({
      where: { id: comissaoId },
      data: {
        estado: EstadoDaComissao.CANCELADA,
        canceladaEm: new Date(),
        motivoDoCancelamento: motivo?.trim() || 'Cancelada no painel',
      },
    })
    await this.auditar(adminId, 'afiliado.cancelar-comissao', 'ComissaoDeAfiliado', comissaoId, {
      motivo: motivo ?? null,
      valorCent: c.valorCent,
    })
    return actualizada
  }

  /**
   * Liberar a área à mão, pelo e-mail da conta.
   *
   * NÃO é o caminho normal — esse é a compra. É para a exceção que o caminho
   * automático não apanha: quem comprou sem conta e a criou depois. O cliente
   * não quer aprovar ninguém; quer poder resolver quem ficou de fora.
   */
  async liberarPorEmail(email: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!user || user.status !== 'ACTIVE') throw new NotFoundException('Não há nenhuma conta com este e-mail.')
    const { afiliado, criado } = await this.garantirAfiliado(user.id, OrigemDoAfiliado.PAINEL)
    if (criado) {
      await this.auditar(adminId, 'afiliado.liberar', 'Afiliado', afiliado.id, { email: user.email })
      void this.avisarAreaLiberada(afiliado, await this.configuracao())
    }
    return { afiliado, criado }
  }

  // ─────────────────────────────────────────────────────────────────
  // A ÁREA DO PRÓPRIO AFILIADO
  // ─────────────────────────────────────────────────────────────────

  async definirPix(userId: string, dados: { tipo: TipoDeChavePix; chave: string; titular: string }) {
    const afiliado = await this.prisma.afiliado.findUnique({ where: { userId } })
    if (!afiliado) throw new NotFoundException('A sua área de afiliado ainda não foi liberada.')
    const conferida = normalizarChavePix(dados.tipo, dados.chave)
    if ('erro' in conferida) throw new BadRequestException(conferida.erro)
    const titular = dados.titular.trim().replace(/\s+/g, ' ')
    if (titular.length < 3) throw new BadRequestException('Escreva o nome completo do titular da conta.')
    await this.prisma.afiliado.update({
      where: { id: afiliado.id },
      data: { tipoDaChavePix: dados.tipo, chavePix: conferida.chave, nomeDoTitular: titular.slice(0, 120) },
    })
    return { tipo: dados.tipo, chave: conferida.chave, titular: titular.slice(0, 120) }
  }

  async marcarVisto(userId: string) {
    await this.prisma.afiliado.updateMany({ where: { userId }, data: { vistoEm: new Date() } })
    return { ok: true }
  }

  /** Tudo o que a área do afiliado mostra, bloqueada ou não. */
  async meuPainel(userId: string) {
    const cfg = await this.configuracao()
    const loja = await this.destinoDoLink(cfg).catch(() => null)
    const regras = {
      comissaoBp: cfg.comissaoBp,
      diasDeCarencia: cfg.diasDeCarencia,
      diasDeAtribuicao: cfg.diasDeAtribuicao,
      minimoParaPagamentoCent: cfg.minimoParaPagamentoCent,
      regulamento: cfg.regulamento,
    }
    const afiliado = await this.prisma.afiliado.findUnique({ where: { userId } })
    const vagas = await this.vagas(cfg)
    // Por baixo da área, para cada pessoa ver quanto poderia ganhar (05/10).
    const simulacao = {
      kits: cfg.simulacaoKits,
      comissaoBp: cfg.comissaoBp,
      precoNormalCent: cfg.simulacaoPrecoNormalCent,
      precoPromocionalCent: cfg.simulacaoPrecoPromocionalCent,
    }

    if (!afiliado) {
      return {
        programaAtivo: cfg.ativo,
        estado: 'BLOQUEADO' as const,
        regras,
        compraPath: loja?.path ?? '/',
        vagas,
        simulacao,
        afiliado: null,
      }
    }

    const agora = new Date()
    const [saldo, cliques, recentes, proxima] = await Promise.all([
      this.saldo(afiliado.id),
      this.prisma.cliqueDeAfiliado.count({ where: { afiliadoId: afiliado.id } }),
      this.vendasDe(afiliado.id, 0, 5),
      this.prisma.comissaoDeAfiliado.findFirst({
        where: { afiliadoId: afiliado.id, estado: EstadoDaComissao.PENDENTE, liberaEm: { gt: agora } },
        orderBy: { liberaEm: 'asc' },
        select: { liberaEm: true, valorCent: true },
      }),
    ])

    let novidades: { vendas: number; disponivelCent: number } | null = null
    if (afiliado.vistoEm) {
      const [vendas, disponivel] = await Promise.all([
        this.prisma.comissaoDeAfiliado.count({
          where: { afiliadoId: afiliado.id, criadaEm: { gt: afiliado.vistoEm }, estado: { not: EstadoDaComissao.CANCELADA } },
        }),
        this.prisma.comissaoDeAfiliado.aggregate({
          where: {
            afiliadoId: afiliado.id,
            estado: EstadoDaComissao.PENDENTE,
            liberaEm: { gt: afiliado.vistoEm, lte: agora },
          },
          _sum: { valorCent: true },
        }),
      ])
      if (vendas > 0 || (disponivel._sum.valorCent ?? 0) > 0) {
        novidades = { vendas, disponivelCent: disponivel._sum.valorCent ?? 0 }
      }
    }

    const link = this.linkPublico(afiliado.codigo)
    const mensagem = cfg.mensagemDoWhatsapp.includes('{link}')
      ? cfg.mensagemDoWhatsapp.replaceAll('{link}', link)
      : `${cfg.mensagemDoWhatsapp} ${link}`

    return {
      programaAtivo: cfg.ativo,
      estado: afiliado.estado,
      regras,
      compraPath: loja?.path ?? '/',
      vagas,
      simulacao,
      afiliado: {
        codigo: afiliado.codigo,
        link,
        mensagemDoWhatsapp: mensagem,
        desde: afiliado.criadoEm,
        motivoDaSuspensao: afiliado.motivoDaSuspensao,
        metricas: {
          cliques,
          vendas: saldo.vendas,
          conversao: cliques > 0 ? saldo.vendas / cliques : 0,
          geradaCent: saldo.geradaCent,
          pendenteCent: saldo.pendenteCent,
          disponivelCent: saldo.disponivelCent,
          aDescontarCent: saldo.aDescontarCent,
          aPagarCent: saldo.aPagarCent,
          recebidoCent: saldo.recebidoCent,
        },
        pix: afiliado.chavePix
          ? { tipo: afiliado.tipoDaChavePix, chave: afiliado.chavePix, titular: afiliado.nomeDoTitular }
          : null,
        recentes: recentes.vendas,
        novidades,
        proximaLiberacao: proxima ? { em: proxima.liberaEm, valorCent: proxima.valorCent } : null,
      },
    }
  }

  async minhasVendas(userId: string, pagina = 1, porPagina = 20) {
    const afiliado = await this.prisma.afiliado.findUnique({ where: { userId }, select: { id: true } })
    if (!afiliado) throw new NotFoundException('A sua área de afiliado ainda não foi liberada.')
    const tamanho = Math.min(50, Math.max(1, porPagina))
    const r = await this.vendasDe(afiliado.id, (Math.max(1, pagina) - 1) * tamanho, tamanho)
    return { ...r, pagina: Math.max(1, pagina), porPagina: tamanho }
  }

  /** As vendas de um afiliado como ELE as vê: sem e-mail, sem apelido inteiro, sem crianças. */
  private async vendasDe(afiliadoId: string, saltar: number, levar: number) {
    const agora = new Date()
    const [total, comissoes] = await Promise.all([
      this.prisma.comissaoDeAfiliado.count({ where: { afiliadoId } }),
      this.prisma.comissaoDeAfiliado.findMany({
        where: { afiliadoId },
        orderBy: { criadaEm: 'desc' },
        skip: saltar,
        take: levar,
        include: {
          pedido: {
            select: {
              pagoEm: true,
              totalCent: true,
              nomeDoComprador: true,
              user: { select: { displayName: true } },
              _count: { select: { criancas: { where: { selecionada: true } } } },
            },
          },
        },
      }),
    ])
    return {
      total,
      vendas: comissoes.map((c) => ({
        id: c.id,
        em: c.pedido.pagoEm ?? c.criadaEm,
        comprador: nomeResumido(c.pedido.nomeDoComprador ?? c.pedido.user?.displayName),
        conjuntos: c.pedido._count.criancas,
        valorCent: c.pedido.totalCent,
        comissaoCent: Math.max(0, c.valorCent - c.estornoCent),
        estado: estadoVisivel(c, agora),
        liberaEm: c.liberaEm,
      })),
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // AVISOS POR E-MAIL — nunca falham para cima
  // ─────────────────────────────────────────────────────────────────

  private async avisarAreaLiberada(afiliado: Afiliado, cfg: ConfiguracaoDeAfiliados) {
    if (!this.mail.activo) return
    try {
      const user = await this.prisma.user.findUnique({ where: { id: afiliado.userId } })
      if (!user) return
      const m = emailDeAreaLiberada({
        nome: user.displayName,
        link: this.linkPublico(afiliado.codigo),
        painel: await this.urlDoPainel(),
        comissao: `${(cfg.comissaoBp / 100).toLocaleString('pt-BR')}%`,
      })
      await this.mail.enviar({ para: user.email, nome: user.displayName, ...m })
    } catch (erro) {
      this.logger.error(`Aviso de área liberada falhou: ${String(erro)}`)
    }
  }

  private async avisarNovaVenda(
    afiliado: Afiliado & { user: { email: string; displayName: string } },
    comissao: ComissaoDeAfiliado,
    cfg: ConfiguracaoDeAfiliados,
  ) {
    if (!this.mail.activo) return
    try {
      const m = emailDeNovaVenda({
        nome: afiliado.user.displayName,
        comissao: reais(comissao.valorCent, comissao.moeda),
        dias: cfg.diasDeCarencia,
        painel: await this.urlDoPainel(),
      })
      await this.mail.enviar({ para: afiliado.user.email, nome: afiliado.user.displayName, ...m })
    } catch (erro) {
      this.logger.error(`Aviso de nova venda falhou: ${String(erro)}`)
    }
  }

  /** Para a tarefa diária: as comissões que passaram a disponíveis. */
  async avisarDisponiveis(): Promise<number> {
    if (!this.mail.activo) return 0
    const agora = new Date()
    const novas = await this.prisma.comissaoDeAfiliado.findMany({
      where: {
        estado: EstadoDaComissao.PENDENTE,
        avisoDisponivelEm: null,
        // Só as da última semana: se o e-mail for ligado daqui a meses, ninguém
        // recebe de uma vez o aviso de um ano de comissões.
        liberaEm: { lte: agora, gte: somarDias(agora, -7) },
      },
      select: { id: true, afiliadoId: true, valorCent: true, moeda: true },
      take: 5000,
    })
    const porAfiliado = new Map<string, typeof novas>()
    for (const c of novas) porAfiliado.set(c.afiliadoId, [...(porAfiliado.get(c.afiliadoId) ?? []), c])

    const painel = await this.urlDoPainel()
    let enviados = 0
    for (const [afiliadoId, comissoes] of porAfiliado) {
      const afiliado = await this.prisma.afiliado.findUnique({
        where: { id: afiliadoId },
        include: { user: { select: { email: true, displayName: true, status: true } } },
      })
      if (!afiliado || afiliado.user.status !== 'ACTIVE') continue
      const saldo = await this.saldo(afiliadoId)
      const moeda = comissoes[0].moeda
      const m = emailDeComissaoDisponivel({
        nome: afiliado.user.displayName,
        valor: reais(comissoes.reduce((t, c) => t + c.valorCent, 0), moeda),
        saldo: reais(saldo.aPagarCent, moeda),
        painel,
      })
      const envio = await this.mail.enviar({ para: afiliado.user.email, nome: afiliado.user.displayName, ...m })
      if (envio.enviado) {
        enviados++
        await this.prisma.comissaoDeAfiliado.updateMany({
          where: { id: { in: comissoes.map((c) => c.id) } },
          data: { avisoDisponivelEm: agora },
        })
      }
    }
    return enviados
  }

  private async avisarPagamento(afiliadoId: string, valorCent: number, moeda: string, chave: string | null) {
    if (!this.mail.activo) return
    try {
      const afiliado = await this.prisma.afiliado.findUnique({
        where: { id: afiliadoId },
        include: { user: { select: { email: true, displayName: true } } },
      })
      if (!afiliado) return
      const m = emailDePagamentoFeito({
        nome: afiliado.user.displayName,
        valor: reais(valorCent, moeda),
        chave,
        painel: await this.urlDoPainel(),
      })
      await this.mail.enviar({ para: afiliado.user.email, nome: afiliado.user.displayName, ...m })
    } catch (erro) {
      this.logger.error(`Aviso de pagamento falhou: ${String(erro)}`)
    }
  }

  // ─────────────────────────────────────────────────────────────────

  async auditar(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    changes: Record<string, unknown>,
  ) {
    await this.prisma.adminAuditLog.create({
      data: { userId, action, entityType, entityId, changes: changes as Prisma.InputJsonValue },
    })
  }
}
