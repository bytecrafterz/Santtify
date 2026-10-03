import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EstadoDoPedido, Prisma, type PedidoDeCartoes } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { estadoVisivel } from './afiliados.service'
import { PainelDeAfiliadosService, padraoDeBusca } from './painel-de-afiliados.service'
import { folha, naFolha, periodoDe, variacao, type Periodo } from './dinheiro'
import { AGORA, emUtc } from './sql'

export type StatusDoPedido = 'AGUARDANDO' | 'EM_PRODUCAO' | 'CONCLUIDO' | 'CANCELADO' | 'REEMBOLSADO'

/**
 * O estado que o painel mostra, derivado — e não o `estado` da base.
 *
 * O `estado` diz em que ponto do fluxo o pedido está, e o expurgo põe TODO o
 * pedido velho em EXPIRADO, pago ou não: uma venda de há dez dias apareceria
 * como cancelada. O que o dono da loja quer saber é outra coisa — se pagou, se
 * recebeu, se devolveu — e isso lê-se das datas.
 *
 * GÉMEA DE `STATUS_SQL`, em baixo. As duas têm de dizer o mesmo.
 */
export function statusDoPedido(
  p: Pick<PedidoDeCartoes, 'estado' | 'pagoEm' | 'prontoEm' | 'reembolsadoEm' | 'reembolsadoCent' | 'totalCent'>,
): StatusDoPedido {
  if (p.reembolsadoEm && p.reembolsadoCent >= p.totalCent) return 'REEMBOLSADO'
  if (p.pagoEm && (p.prontoEm || p.estado === EstadoDoPedido.PRONTO || p.estado === EstadoDoPedido.EXPIRADO)) {
    return 'CONCLUIDO'
  }
  if (p.pagoEm) return 'EM_PRODUCAO'
  if (p.estado === EstadoDoPedido.AGUARDANDO_PAGAMENTO) return 'AGUARDANDO'
  return 'CANCELADO'
}

/** Ver `statusDoPedido`. */
const STATUS_SQL = Prisma.sql`CASE
  WHEN p."reembolsadoEm" IS NOT NULL AND p."reembolsadoCent" >= p."totalCent" THEN 'REEMBOLSADO'
  WHEN p."pagoEm" IS NOT NULL AND (p."prontoEm" IS NOT NULL OR p.estado IN ('PRONTO', 'EXPIRADO')) THEN 'CONCLUIDO'
  WHEN p."pagoEm" IS NOT NULL THEN 'EM_PRODUCAO'
  WHEN p.estado = 'AGUARDANDO_PAGAMENTO' THEN 'AGUARDANDO'
  ELSE 'CANCELADO'
END`

/** As abas do painel de pedidos. "Cancelados" junta os não pagos e os devolvidos. */
const ABAS: Record<string, StatusDoPedido[]> = {
  AGUARDANDO: ['AGUARDANDO'],
  EM_PRODUCAO: ['EM_PRODUCAO'],
  CONCLUIDO: ['CONCLUIDO'],
  CANCELADO: ['CANCELADO', 'REEMBOLSADO'],
}

export interface FiltroDePedidos {
  de?: string | null
  ate?: string | null
  status?: string | null
  meio?: string | null
  origem?: string | null
  categoria?: string | null
  busca?: string | null
  pagina?: number
  porPagina?: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * O painel de vendas: pedidos, clientes, produtos, financeiro, relatórios.
 *
 * Desenhado a partir dos mockups do cliente de 25/09 — "referência simples da
 * informação necessária, não exigência de copiar cada detalhe visual". Tudo é
 * leitura: as acções que mexem em dinheiro (confirmar, reembolsar, pagar um
 * afiliado) vivem cada uma no serviço dono delas.
 *
 * AS DATAS DO PERÍODO SÃO AS DE SÃO PAULO. Ver `periodoDe`.
 */
@Injectable()
export class VendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly painel: PainelDeAfiliadosService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // RESUMO: os quatro números do topo
  // ─────────────────────────────────────────────────────────────────

  private async numeros(inicio: Date, fim: Date) {
    const [l] = await this.prisma.$queryRaw<
      Array<{ pedidos: bigint; bruto: bigint; reembolsos: bigint; taxas: bigint; comissoes: bigint; conjuntos: bigint }>
    >`
      SELECT COUNT(*) FILTER (WHERE p."reembolsadoCent" < p."totalCent") AS pedidos,
             COALESCE(SUM(p."totalCent"), 0) AS bruto,
             COALESCE(SUM(p."reembolsadoCent"), 0) AS reembolsos,
             COALESCE(SUM(p."taxaCent"), 0) AS taxas,
             COALESCE(SUM(c."valorCent" - c."estornoCent") FILTER (WHERE c.estado <> 'CANCELADA'), 0) AS comissoes,
             COALESCE(SUM((SELECT COUNT(*) FROM criancas_do_pedido cr WHERE cr."pedidoId" = p.id AND cr.selecionada))
                      FILTER (WHERE p."reembolsadoCent" < p."totalCent"), 0) AS conjuntos
        FROM pedidos_de_cartoes p
        LEFT JOIN comissoes_de_afiliados c ON c."pedidoId" = p.id
       WHERE p."pagoEm" >= ${emUtc(inicio)} AND p."pagoEm" < ${emUtc(fim)}`
    const bruto = Number(l.bruto)
    const reembolsos = Number(l.reembolsos)
    const taxas = Number(l.taxas)
    const comissoes = Number(l.comissoes)
    return {
      pedidos: Number(l.pedidos),
      conjuntos: Number(l.conjuntos),
      brutoCent: bruto,
      reembolsosCent: reembolsos,
      taxasCent: taxas,
      comissoesCent: comissoes,
      liquidoCent: bruto - reembolsos - taxas - comissoes,
    }
  }

  async resumo(de?: string | null, ate?: string | null) {
    const periodo = periodoDe(de, ate)
    const [agora, antes] = await Promise.all([
      this.numeros(periodo.inicio, periodo.fim),
      this.numeros(periodo.anteriorInicio, periodo.anteriorFim),
    ])
    return {
      periodo: { de: periodo.de, ate: periodo.ate, dias: periodo.dias },
      ...agora,
      ticketMedioCent: agora.pedidos ? Math.round((agora.brutoCent - agora.reembolsosCent) / agora.pedidos) : 0,
      variacao: {
        pedidos: variacao(agora.pedidos, antes.pedidos),
        brutoCent: variacao(agora.brutoCent, antes.brutoCent),
        comissoesCent: variacao(agora.comissoesCent, antes.comissoesCent),
        liquidoCent: variacao(agora.liquidoCent, antes.liquidoCent),
      },
      anterior: antes,
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PEDIDOS
  // ─────────────────────────────────────────────────────────────────

  /**
   * A consulta dos pedidos, com os filtros todos menos o estado — o estado é
   * aplicado por fora, para as contagens das abas saírem da MESMA consulta.
   *
   * Só os pedidos que chegaram ao pagamento. Os rascunhos — cada pessoa que
   * abre o editor cria um — não são pedidos, e encheriam a lista de nada.
   */
  private consultaDePedidos(f: FiltroDePedidos, periodo: Periodo) {
    const meio = f.meio === 'PIX' || f.meio === 'CARTAO' ? f.meio : null
    const origem = f.origem === 'afiliado' || f.origem === 'direto' ? f.origem : null
    const afiliadoId = f.origem && UUID.test(f.origem) ? f.origem : null
    const categoria = f.categoria && UUID.test(f.categoria) ? f.categoria : null
    const texto = f.busca?.trim() || null
    const numero = texto && /^#?\d{1,9}$/.test(texto) ? Number(texto.replace('#', '')) : null
    const busca = texto ? padraoDeBusca(texto) : null

    return Prisma.sql`
      SELECT p.id, p.numero, p."criadoEm", p."pagoEm", p."prontoEm", p."expiraEm", p.estado::text AS estado,
             p.meio::text AS meio, p."totalCent", p."reembolsadoCent", p."reembolsadoEm", p."taxaCent",
             p."taxaEstimada", p.moeda,
             ${STATUS_SQL} AS status,
             COALESCE(p."nomeDoComprador", u."displayName") AS "clienteNome",
             COALESCE(p."emailDoComprador", CASE WHEN u.status = 'DELETED' THEN NULL ELSE u.email END) AS "clienteEmail",
             u."avatarUrl" AS "clienteAvatar",
             p."userId",
             cat.nome AS categoria, cat."rotuloSingular", cat."rotuloPlural",
             pr.name AS projeto, pr.slug AS "projectSlug",
             (SELECT COUNT(*) FROM criancas_do_pedido cr WHERE cr."pedidoId" = p.id AND cr.selecionada) AS conjuntos,
             a.id AS "afiliadoId", a.codigo AS "afiliadoCodigo", au."displayName" AS "afiliadoNome",
             c."valorCent" AS "comissaoCent", c."estornoCent" AS "comissaoEstornoCent",
             c."comissaoBp", c.estado::text AS "comissaoEstado"
        FROM pedidos_de_cartoes p
        LEFT JOIN users u ON u.id = p."userId"
        LEFT JOIN categorias_de_cartoes cat ON cat.id = p."categoriaId"
        JOIN projects pr ON pr.id = p."projectId"
        LEFT JOIN afiliados a ON a.id = p."afiliadoId"
        LEFT JOIN users au ON au.id = a."userId"
        LEFT JOIN comissoes_de_afiliados c ON c."pedidoId" = p.id
       WHERE p."referenciaExterna" IS NOT NULL
         AND p."criadoEm" >= ${emUtc(periodo.inicio)} AND p."criadoEm" < ${emUtc(periodo.fim)}
         AND (${meio}::text IS NULL OR p.meio::text = ${meio}::text)
         AND (${origem}::text IS NULL
              OR (${origem}::text = 'afiliado' AND p."afiliadoId" IS NOT NULL)
              OR (${origem}::text = 'direto' AND p."afiliadoId" IS NULL))
         AND (${afiliadoId}::uuid IS NULL OR p."afiliadoId" = ${afiliadoId}::uuid)
         AND (${categoria}::uuid IS NULL OR p."categoriaId" = ${categoria}::uuid)
         AND (${busca}::text IS NULL
              OR p.numero = ${numero}::int
              OR COALESCE(p."emailDoComprador", u.email) ILIKE ${busca}::text
              OR COALESCE(p."nomeDoComprador", u."displayName") ILIKE ${busca}::text
              OR au."displayName" ILIKE ${busca}::text
              OR a.codigo ILIKE ${busca}::text)`
  }

  private linhaDePedido(l: LinhaDePedido) {
    const comissao = l.comissaoCent != null && l.comissaoEstado !== 'CANCELADA'
      ? Math.max(0, l.comissaoCent - (l.comissaoEstornoCent ?? 0))
      : null
    return {
      id: l.id,
      numero: l.numero,
      criadoEm: l.criadoEm,
      pagoEm: l.pagoEm,
      status: l.status,
      reembolsoParcial: l.reembolsadoCent > 0 && l.reembolsadoCent < l.totalCent,
      cliente: { nome: l.clienteNome, email: l.clienteEmail, avatarUrl: l.clienteAvatar, temConta: Boolean(l.userId) },
      produto: {
        categoria: l.categoria,
        projeto: l.projeto,
        projectSlug: l.projectSlug,
        conjuntos: Number(l.conjuntos),
        rotuloSingular: l.rotuloSingular,
        rotuloPlural: l.rotuloPlural,
      },
      totalCent: l.totalCent,
      reembolsadoCent: l.reembolsadoCent,
      moeda: l.moeda,
      meio: l.meio,
      afiliado: l.afiliadoId
        ? {
            id: l.afiliadoId,
            nome: l.afiliadoNome,
            codigo: l.afiliadoCodigo,
            comissaoCent: comissao,
            comissaoBp: l.comissaoBp,
            comissaoEstado: l.comissaoEstado,
          }
        : null,
    }
  }

  async pedidos(f: FiltroDePedidos) {
    const periodo = periodoDe(f.de, f.ate)
    const porPagina = Math.min(100, Math.max(1, f.porPagina ?? 25))
    const pagina = Math.max(1, f.pagina ?? 1)
    const aba = f.status && ABAS[f.status] ? ABAS[f.status] : null
    const base = this.consultaDePedidos(f, periodo)

    const [linhas, contagens] = await Promise.all([
      this.prisma.$queryRaw<Array<LinhaDePedido & { total: bigint }>>(Prisma.sql`
        SELECT x.*, COUNT(*) OVER () AS total
          FROM (${base}) x
         WHERE (${aba}::text[] IS NULL OR x.status = ANY(${aba}::text[]))
         ORDER BY x."criadoEm" DESC
         LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`),
      this.prisma.$queryRaw<Array<{ status: StatusDoPedido; n: bigint }>>(Prisma.sql`
        SELECT x.status, COUNT(*) AS n FROM (${base}) x GROUP BY x.status`),
    ])

    const n = (s: StatusDoPedido) => Number(contagens.find((c) => c.status === s)?.n ?? 0)
    return {
      periodo: { de: periodo.de, ate: periodo.ate },
      abas: {
        todos: contagens.reduce((t, c) => t + Number(c.n), 0),
        AGUARDANDO: n('AGUARDANDO'),
        EM_PRODUCAO: n('EM_PRODUCAO'),
        CONCLUIDO: n('CONCLUIDO'),
        CANCELADO: n('CANCELADO') + n('REEMBOLSADO'),
      },
      total: linhas.length ? Number(linhas[0].total) : 0,
      pagina,
      porPagina,
      pedidos: linhas.map((l) => this.linhaDePedido(l)),
    }
  }

  async pedido(id: string) {
    if (!UUID.test(id)) throw new NotFoundException('Pedido não encontrado.')
    const p = await this.prisma.pedidoDeCartoes.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, slug: true } },
        categoria: { select: { nome: true, rotuloSingular: true, rotuloPlural: true, capaUrl: true } },
        criancas: {
          orderBy: { ordem: 'asc' },
          select: { nome: true, selecionada: true, confirmada: true, pdfPath: true },
        },
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true, status: true } },
        afiliado: {
          include: { user: { select: { displayName: true, email: true, avatarUrl: true, status: true } } },
        },
        comissao: true,
        eventosDePagamento: { orderBy: { recebidoEm: 'desc' }, take: 20, select: { tipo: true, recebidoEm: true } },
      },
    })
    if (!p) throw new NotFoundException('Pedido não encontrado.')

    const comissao = p.comissao
    const comissaoCent =
      comissao && comissao.estado !== 'CANCELADA' ? Math.max(0, comissao.valorCent - comissao.estornoCent) : 0
    const taxaCent = p.pagoEm ? (p.taxaCent ?? 0) : 0
    const liquidoCent = p.pagoEm ? p.totalCent - p.reembolsadoCent - taxaCent : 0
    const escolhidas = p.criancas.filter((c) => c.selecionada)

    return {
      id: p.id,
      numero: p.numero,
      status: statusDoPedido(p),
      criadoEm: p.criadoEm,
      pagoEm: p.pagoEm,
      prontoEm: p.prontoEm,
      expiraEm: p.expiraEm,
      arquivosExpirados: p.estado === EstadoDoPedido.EXPIRADO,
      reembolsadoEm: p.reembolsadoEm,
      aprovacaoEm: p.aprovacaoEm,
      cliente: {
        nome: p.nomeDoComprador ?? p.user?.displayName ?? null,
        email: p.emailDoComprador ?? emailDaConta(p.user),
        avatarUrl: p.user?.avatarUrl ?? null,
        userId: p.user?.id ?? null,
      },
      produto: {
        projeto: p.project.name,
        projectSlug: p.project.slug,
        categoria: p.categoria?.nome ?? null,
        capaUrl: p.categoria?.capaUrl ?? null,
        rotuloSingular: p.categoria?.rotuloSingular ?? 'criança',
        rotuloPlural: p.categoria?.rotuloPlural ?? 'crianças',
        conjuntos: escolhidas.length,
        // Desde 03/10 o PDF é gerado no aparelho de quem compra, e o servidor só
        // sabe que foi (`prontoEm`). Os pedidos de antes contavam ficheiros.
        prontos: p.prontoEm ? escolhidas.length : escolhidas.filter((c) => c.pdfPath).length,
        nomes: escolhidas.map((c) => c.nome).filter(Boolean),
      },
      pagamento: {
        meio: p.meio,
        referencia: p.referenciaExterna,
        eventos: p.eventosDePagamento,
      },
      afiliado: p.afiliado
        ? {
            id: p.afiliado.id,
            codigo: p.afiliado.codigo,
            nome: p.afiliado.user.displayName,
            email: emailDaConta(p.afiliado.user) ?? '',
            avatarUrl: p.afiliado.user.avatarUrl,
          }
        : null,
      comissao: comissao
        ? {
            id: comissao.id,
            estado: estadoVisivel(comissao),
            comissaoBp: comissao.comissaoBp,
            valorCent: comissao.valorCent,
            estornoCent: comissao.estornoCent,
            liberaEm: comissao.liberaEm,
          }
        : null,
      valores: {
        moeda: p.moeda,
        subtotalCent: p.subtotalCent,
        descontoCent: p.descontoCent,
        totalCent: p.totalCent,
        reembolsadoCent: p.reembolsadoCent,
        taxaCent,
        taxaEstimada: p.taxaEstimada,
        liquidoCent,
        comissaoCent,
        seuLiquidoCent: liquidoCent - comissaoCent,
      },
    }
  }

  async exportarPedidos(f: FiltroDePedidos): Promise<string> {
    const periodo = periodoDe(f.de, f.ate)
    const aba = f.status && ABAS[f.status] ? ABAS[f.status] : null
    const linhas = await this.prisma.$queryRaw<LinhaDePedido[]>(Prisma.sql`
      SELECT x.* FROM (${this.consultaDePedidos(f, periodo)}) x
       WHERE (${aba}::text[] IS NULL OR x.status = ANY(${aba}::text[]))
       ORDER BY x."criadoEm" DESC
       LIMIT 100000`)
    const nomes: Record<string, string> = {
      AGUARDANDO: 'Aguardando',
      EM_PRODUCAO: 'Em produção',
      CONCLUIDO: 'Concluído',
      CANCELADO: 'Cancelado',
      REEMBOLSADO: 'Reembolsado',
    }
    return folha(
      [
        'Pedido',
        'Data',
        'Status',
        'Cliente',
        'E-mail',
        'Projeto',
        'Produto',
        'Conjuntos',
        'Valor',
        'Pagamento',
        'Pago em',
        'Taxa',
        'Taxa estimada',
        'Reembolsado',
        'Afiliado',
        'Código do afiliado',
        'Comissão',
        'Seu líquido',
      ],
      linhas.map((l) => {
        const comissao = l.comissaoCent != null && l.comissaoEstado !== 'CANCELADA'
          ? Math.max(0, l.comissaoCent - (l.comissaoEstornoCent ?? 0))
          : 0
        const taxa = l.pagoEm ? (l.taxaCent ?? 0) : 0
        const liquido = l.pagoEm ? l.totalCent - l.reembolsadoCent - taxa - comissao : null
        return [
          l.numero ? `#${l.numero}` : '',
          l.criadoEm,
          nomes[l.status] ?? l.status,
          l.clienteNome,
          l.clienteEmail,
          l.projeto,
          l.categoria,
          Number(l.conjuntos),
          naFolha(l.totalCent),
          l.meio === 'CARTAO' ? 'Cartão' : l.meio === 'PIX' ? 'Pix' : '',
          l.pagoEm,
          l.pagoEm ? naFolha(taxa) : null,
          l.pagoEm ? l.taxaEstimada : null,
          l.reembolsadoCent ? naFolha(l.reembolsadoCent) : null,
          l.afiliadoNome ?? 'Direto',
          l.afiliadoCodigo,
          l.afiliadoId ? naFolha(comissao) : null,
          naFolha(liquido),
        ]
      }),
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // CLIENTES
  // ─────────────────────────────────────────────────────────────────

  /**
   * Quem comprou, uma linha por pessoa.
   *
   * Uma pessoa é a conta, quando comprou com sessão; senão, o e-mail com que
   * pagou. As compras antigas feitas sem conta e antes de o pedido guardar o
   * e-mail não têm a quem se ligar — contam-se à parte, para o número bater.
   */
  async clientes(f: { busca?: string | null; pagina?: number; porPagina?: number }) {
    const porPagina = Math.min(100, Math.max(1, f.porPagina ?? 25))
    const pagina = Math.max(1, f.pagina ?? 1)
    const busca = f.busca?.trim() ? padraoDeBusca(f.busca) : null

    const [linhas, semIdentificacao] = await Promise.all([
      this.prisma.$queryRaw<LinhaDeCliente[]>(Prisma.sql`
        SELECT x.chave,
               MAX(x.nome) AS nome,
               MAX(x.email) AS email,
               MAX(x.avatar) AS "avatarUrl",
               BOOL_OR(x.conta) AS "temConta",
               COUNT(*) AS pedidos,
               COALESCE(SUM(x.gasto), 0) AS gasto,
               MIN(x."pagoEm") AS primeira,
               MAX(x."pagoEm") AS ultima,
               COUNT(*) FILTER (WHERE x."viaAfiliado") AS "viaAfiliado",
               BOOL_OR(x."eAfiliado") AS "eAfiliado",
               COUNT(*) OVER () AS total
          FROM (
            SELECT COALESCE(p."userId"::text, lower(p."emailDoComprador")) AS chave,
                   COALESCE(p."nomeDoComprador", u."displayName") AS nome,
                   COALESCE(CASE WHEN u.status = 'DELETED' THEN NULL ELSE u.email END, p."emailDoComprador") AS email,
                   u."avatarUrl" AS avatar,
                   p."userId" IS NOT NULL AS conta,
                   p."totalCent" - p."reembolsadoCent" AS gasto,
                   p."pagoEm",
                   p."afiliadoId" IS NOT NULL AS "viaAfiliado",
                   EXISTS (SELECT 1 FROM afiliados af WHERE af."userId" = p."userId") AS "eAfiliado"
              FROM pedidos_de_cartoes p
              LEFT JOIN users u ON u.id = p."userId"
             WHERE p."pagoEm" IS NOT NULL
               AND (p."userId" IS NOT NULL OR p."emailDoComprador" IS NOT NULL)
          ) x
         WHERE (${busca}::text IS NULL OR x.nome ILIKE ${busca}::text OR x.email ILIKE ${busca}::text)
         GROUP BY x.chave
         ORDER BY MAX(x."pagoEm") DESC
         LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`),
      this.prisma.pedidoDeCartoes.count({
        where: { pagoEm: { not: null }, userId: null, emailDoComprador: null },
      }),
    ])

    return {
      total: linhas.length ? Number(linhas[0].total) : 0,
      pagina,
      porPagina,
      semIdentificacao,
      clientes: linhas.map((l) => ({
        chave: l.chave,
        nome: l.nome,
        email: l.email,
        avatarUrl: l.avatarUrl,
        temConta: l.temConta,
        pedidos: Number(l.pedidos),
        gastoCent: Number(l.gasto),
        primeira: l.primeira,
        ultima: l.ultima,
        viaAfiliado: Number(l.viaAfiliado),
        eAfiliado: l.eAfiliado,
      })),
    }
  }

  async cliente(chave: string) {
    const porConta = UUID.test(chave)
    const email = chave.trim().toLowerCase()
    if (!porConta && !email.includes('@')) throw new BadRequestException('Cliente inválido.')
    const pedidos = await this.prisma.pedidoDeCartoes.findMany({
      where: porConta
        ? { userId: chave, referenciaExterna: { not: null } }
        : { userId: null, emailDoComprador: { equals: email, mode: 'insensitive' }, referenciaExterna: { not: null } },
      orderBy: { criadoEm: 'desc' },
      take: 200,
      include: {
        user: { select: { displayName: true, email: true, avatarUrl: true, username: true, createdAt: true, status: true } },
        categoria: { select: { nome: true } },
        project: { select: { name: true } },
        afiliado: { include: { user: { select: { displayName: true } } } },
        _count: { select: { criancas: { where: { selecionada: true } } } },
      },
    })
    if (pedidos.length === 0) throw new NotFoundException('Cliente não encontrado.')
    const primeiro = pedidos[0]
    const afiliado = porConta
      ? await this.prisma.afiliado.findUnique({ where: { userId: chave }, select: { id: true, codigo: true, estado: true } })
      : null
    return {
      chave,
      nome: primeiro.nomeDoComprador ?? primeiro.user?.displayName ?? null,
      email: emailDaConta(primeiro.user) ?? primeiro.emailDoComprador ?? null,
      avatarUrl: primeiro.user?.avatarUrl ?? null,
      username: primeiro.user?.username ?? null,
      temConta: porConta,
      contaDesde: primeiro.user?.createdAt ?? null,
      afiliado,
      gastoCent: pedidos.filter((p) => p.pagoEm).reduce((t, p) => t + p.totalCent - p.reembolsadoCent, 0),
      pedidos: pedidos.map((p) => ({
        id: p.id,
        numero: p.numero,
        criadoEm: p.criadoEm,
        pagoEm: p.pagoEm,
        status: statusDoPedido(p),
        totalCent: p.totalCent,
        meio: p.meio,
        categoria: p.categoria?.nome ?? null,
        projeto: p.project.name,
        conjuntos: p._count.criancas,
        afiliado: p.afiliado ? p.afiliado.user.displayName : null,
      })),
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PRODUTOS
  // ─────────────────────────────────────────────────────────────────

  async produtos(de?: string | null, ate?: string | null) {
    const periodo = periodoDe(de, ate)
    const [categorias, precos, vendas] = await Promise.all([
      this.prisma.categoriaDeCartoes.findMany({
        orderBy: [{ project: { name: 'asc' } }, { ordem: 'asc' }, { nome: 'asc' }],
        include: {
          project: { select: { id: true, name: true, slug: true } },
          _count: { select: { modelos: { where: { ativo: true } } } },
        },
      }),
      this.prisma.precoDeCartoes.findMany(),
      this.prisma.$queryRaw<
        Array<{ categoriaId: string | null; pedidos: bigint; conjuntos: bigint; bruto: bigint; reembolsos: bigint }>
      >`
        SELECT p."categoriaId",
               COUNT(*) AS pedidos,
               COALESCE(SUM((SELECT COUNT(*) FROM criancas_do_pedido cr WHERE cr."pedidoId" = p.id AND cr.selecionada)), 0) AS conjuntos,
               COALESCE(SUM(p."totalCent"), 0) AS bruto,
               COALESCE(SUM(p."reembolsadoCent"), 0) AS reembolsos
          FROM pedidos_de_cartoes p
         WHERE p."pagoEm" >= ${emUtc(periodo.inicio)} AND p."pagoEm" < ${emUtc(periodo.fim)}
         GROUP BY p."categoriaId"`,
    ])

    const precoDoProjeto = new Map(precos.map((p) => [p.projectId, p]))
    const porCategoria = new Map(vendas.map((v) => [v.categoriaId, v]))
    return {
      periodo: { de: periodo.de, ate: periodo.ate },
      produtos: categorias.map((c) => {
        const tabela = precoDoProjeto.get(c.projectId)
        const v = porCategoria.get(c.id)
        const preco = c.precoUnitarioCent ?? tabela?.precoUnitarioCent ?? null
        const riscado = c.precoDeTabelaCent ?? tabela?.precoDeTabelaCent ?? null
        return {
          id: c.id,
          nome: c.nome,
          slug: c.slug,
          capaUrl: c.capaUrl,
          ativo: c.ativo,
          emBreve: c.ofertaEmBreve,
          cartoes: c._count.modelos,
          projeto: c.project.name,
          projectSlug: c.project.slug,
          precoCent: preco,
          precoDeTabelaCent: riscado && preco != null && riscado > preco ? riscado : null,
          moeda: tabela?.moeda ?? 'BRL',
          pedidos: Number(v?.pedidos ?? 0),
          conjuntos: Number(v?.conjuntos ?? 0),
          brutoCent: Number(v?.bruto ?? 0),
          reembolsosCent: Number(v?.reembolsos ?? 0),
        }
      }),
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // FINANCEIRO
  // ─────────────────────────────────────────────────────────────────

  async financeiro(de?: string | null, ate?: string | null) {
    const periodo = periodoDe(de, ate)
    const [resumo, aPagar, pagamentos, pagoNoPeriodo, comissoes] = await Promise.all([
      this.resumo(periodo.de, periodo.ate),
      this.painel.aPagar(),
      this.prisma.pagamentoAoAfiliado.findMany({
        where: { pagoEm: { gte: periodo.inicio, lt: periodo.fim } },
        orderBy: { pagoEm: 'desc' },
        take: 300,
        include: {
          afiliado: { include: { user: { select: { displayName: true, email: true } } } },
          pagoPor: { select: { displayName: true } },
        },
      }),
      this.prisma.pagamentoAoAfiliado.aggregate({
        where: { pagoEm: { gte: periodo.inicio, lt: periodo.fim } },
        _sum: { valorCent: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ pendente: bigint; disponivel: bigint; adescontar: bigint }>>`
        SELECT COALESCE(SUM("valorCent") FILTER (WHERE estado = 'PENDENTE' AND "liberaEm" > ${AGORA}), 0) AS pendente,
               COALESCE(SUM("valorCent") FILTER (WHERE estado = 'PENDENTE' AND "liberaEm" <= ${AGORA}), 0) AS disponivel,
               COALESCE(SUM("estornoCent" - "estornoDescontadoCent") FILTER (WHERE estado IN ('PAGA', 'ESTORNADA')), 0) AS adescontar
          FROM comissoes_de_afiliados`,
    ])

    const c = comissoes[0]
    return {
      periodo: resumo.periodo,
      resumo,
      comissoes: {
        pendenteCent: Number(c.pendente),
        disponivelCent: Number(c.disponivel),
        aDescontarCent: Number(c.adescontar),
        aPagarCent: aPagar.totalCent,
        afiliadosAPagar: aPagar.afiliados.length,
        acimaDoMinimo: aPagar.acimaDoMinimo,
        minimoParaPagamentoCent: aPagar.minimoParaPagamentoCent,
        pagoNoPeriodoCent: pagoNoPeriodo._sum.valorCent ?? 0,
        pagamentosNoPeriodo: pagoNoPeriodo._count._all,
      },
      aPagar: aPagar.afiliados.slice(0, 100),
      pagamentos: pagamentos.map((p) => ({
        id: p.id,
        pagoEm: p.pagoEm,
        afiliadoId: p.afiliadoId,
        afiliado: p.afiliado.user.displayName,
        email: p.afiliado.user.email,
        codigo: p.afiliado.codigo,
        comissoesCent: p.comissoesCent,
        descontosCent: p.descontosCent,
        valorCent: p.valorCent,
        chavePix: p.chavePix,
        nomeDoTitular: p.nomeDoTitular,
        observacao: p.observacao,
        pagoPor: p.pagoPor?.displayName ?? null,
      })),
    }
  }

  async exportarPagamentos(de?: string | null, ate?: string | null): Promise<string> {
    const periodo = periodoDe(de, ate)
    const pagamentos = await this.prisma.pagamentoAoAfiliado.findMany({
      where: { pagoEm: { gte: periodo.inicio, lt: periodo.fim } },
      orderBy: { pagoEm: 'desc' },
      include: {
        afiliado: { include: { user: { select: { displayName: true, email: true } } } },
        pagoPor: { select: { displayName: true } },
      },
    })
    return folha(
      ['Data', 'Afiliado', 'E-mail', 'Código', 'Comissões', 'Descontos', 'Valor pago', 'Chave Pix', 'Titular', 'Observação', 'Marcado por'],
      pagamentos.map((p) => [
        p.pagoEm,
        p.afiliado.user.displayName,
        p.afiliado.user.email,
        p.afiliado.codigo,
        naFolha(p.comissoesCent),
        naFolha(p.descontosCent),
        naFolha(p.valorCent),
        p.chavePix,
        p.nomeDoTitular,
        p.observacao,
        p.pagoPor?.displayName ?? null,
      ]),
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // RELATÓRIOS
  // ─────────────────────────────────────────────────────────────────

  async relatorios(de?: string | null, ate?: string | null) {
    const periodo = periodoDe(de, ate)
    const { inicio, fim } = periodo

    const [resumo, serie, porMeio, porOrigem, topAfiliados, funil, cliques] = await Promise.all([
      this.resumo(periodo.de, periodo.ate),
      this.prisma.$queryRaw<Array<{ dia: string; pedidos: bigint; bruto: bigint; comissoes: bigint }>>`
        WITH v AS (
          SELECT (p."pagoEm" - interval '3 hours')::date AS dia,
                 COUNT(*) FILTER (WHERE p."reembolsadoCent" < p."totalCent") AS pedidos,
                 COALESCE(SUM(p."totalCent" - p."reembolsadoCent"), 0) AS bruto,
                 COALESCE(SUM(c."valorCent" - c."estornoCent") FILTER (WHERE c.estado <> 'CANCELADA'), 0) AS comissoes
            FROM pedidos_de_cartoes p
            LEFT JOIN comissoes_de_afiliados c ON c."pedidoId" = p.id
           WHERE p."pagoEm" >= ${emUtc(inicio)} AND p."pagoEm" < ${emUtc(fim)}
           GROUP BY 1
        )
        SELECT to_char(d::date, 'YYYY-MM-DD') AS dia,
               COALESCE(v.pedidos, 0) AS pedidos,
               COALESCE(v.bruto, 0) AS bruto,
               COALESCE(v.comissoes, 0) AS comissoes
          FROM generate_series(${periodo.de}::date, ${periodo.ate}::date, interval '1 day') d
          LEFT JOIN v ON v.dia = d::date
         ORDER BY d`,
      this.prisma.$queryRaw<Array<{ meio: string | null; pedidos: bigint; bruto: bigint }>>`
        SELECT p.meio::text AS meio,
               COUNT(*) FILTER (WHERE p."reembolsadoCent" < p."totalCent") AS pedidos,
               COALESCE(SUM(p."totalCent" - p."reembolsadoCent"), 0) AS bruto
          FROM pedidos_de_cartoes p
         WHERE p."pagoEm" >= ${emUtc(inicio)} AND p."pagoEm" < ${emUtc(fim)}
         GROUP BY p.meio`,
      this.prisma.$queryRaw<Array<{ origem: string; pedidos: bigint; bruto: bigint }>>`
        SELECT CASE WHEN p."afiliadoId" IS NULL THEN 'direto' ELSE 'afiliado' END AS origem,
               COUNT(*) FILTER (WHERE p."reembolsadoCent" < p."totalCent") AS pedidos,
               COALESCE(SUM(p."totalCent" - p."reembolsadoCent"), 0) AS bruto
          FROM pedidos_de_cartoes p
         WHERE p."pagoEm" >= ${emUtc(inicio)} AND p."pagoEm" < ${emUtc(fim)}
         GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ id: string; nome: string; codigo: string; vendas: bigint; bruto: bigint; comissao: bigint }>>`
        SELECT a.id, u."displayName" AS nome, a.codigo,
               COUNT(*) AS vendas,
               COALESCE(SUM(p."totalCent" - p."reembolsadoCent"), 0) AS bruto,
               COALESCE(SUM(c."valorCent" - c."estornoCent"), 0) AS comissao
          FROM comissoes_de_afiliados c
          JOIN pedidos_de_cartoes p ON p.id = c."pedidoId"
          JOIN afiliados a ON a.id = c."afiliadoId"
          JOIN users u ON u.id = a."userId"
         WHERE c.estado IN ('PENDENTE', 'PAGA')
           AND p."pagoEm" >= ${emUtc(inicio)} AND p."pagoEm" < ${emUtc(fim)}
         GROUP BY a.id, u."displayName", a.codigo
         ORDER BY vendas DESC, bruto DESC
         LIMIT 10`,
      this.prisma.$queryRaw<Array<{ criados: bigint; pagamento: bigint; pagos: bigint }>>`
        SELECT COUNT(*) AS criados,
               COUNT(*) FILTER (WHERE "referenciaExterna" IS NOT NULL) AS pagamento,
               COUNT(*) FILTER (WHERE "pagoEm" IS NOT NULL) AS pagos
          FROM pedidos_de_cartoes
         WHERE "criadoEm" >= ${emUtc(inicio)} AND "criadoEm" < ${emUtc(fim)}`,
      this.prisma.cliqueDeAfiliado.count({
        where: { dia: { gte: new Date(`${periodo.de}T00:00:00Z`), lte: new Date(`${periodo.ate}T00:00:00Z`) } },
      }),
    ])

    const f = funil[0]
    const vendasPorAfiliados = Number(porOrigem.find((o) => o.origem === 'afiliado')?.pedidos ?? 0)
    return {
      periodo: resumo.periodo,
      resumo,
      serie: serie.map((s) => ({
        dia: s.dia,
        pedidos: Number(s.pedidos),
        brutoCent: Number(s.bruto),
        comissoesCent: Number(s.comissoes),
      })),
      porMeio: porMeio.map((m) => ({ meio: m.meio, pedidos: Number(m.pedidos), brutoCent: Number(m.bruto) })),
      porOrigem: porOrigem.map((o) => ({ origem: o.origem, pedidos: Number(o.pedidos), brutoCent: Number(o.bruto) })),
      topAfiliados: topAfiliados.map((a) => ({
        id: a.id,
        nome: a.nome,
        codigo: a.codigo,
        vendas: Number(a.vendas),
        brutoCent: Number(a.bruto),
        comissaoCent: Number(a.comissao),
      })),
      funil: {
        criados: Number(f.criados),
        chegaramAoPagamento: Number(f.pagamento),
        pagos: Number(f.pagos),
      },
      afiliados: {
        cliques,
        vendas: vendasPorAfiliados,
        conversao: cliques > 0 ? vendasPorAfiliados / cliques : 0,
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────

  /** As categorias, para o filtro "Todos os produtos". */
  async filtros() {
    const categorias = await this.prisma.categoriaDeCartoes.findMany({
      orderBy: [{ project: { name: 'asc' } }, { ordem: 'asc' }],
      select: { id: true, nome: true, project: { select: { name: true } } },
    })
    return { categorias: categorias.map((c) => ({ id: c.id, nome: c.nome, projeto: c.project.name })) }
  }
}

/** O e-mail de uma conta, ou nada se ela foi apagada: ver `apagarConta`. */
function emailDaConta(u: { email: string; status: string } | null | undefined): string | null {
  return u && u.status !== 'DELETED' ? u.email : null
}

interface LinhaDePedido {
  id: string
  numero: number | null
  criadoEm: Date
  pagoEm: Date | null
  prontoEm: Date | null
  expiraEm: Date
  estado: string
  meio: string | null
  totalCent: number
  reembolsadoCent: number
  reembolsadoEm: Date | null
  taxaCent: number | null
  taxaEstimada: boolean
  moeda: string
  status: StatusDoPedido
  clienteNome: string | null
  clienteEmail: string | null
  clienteAvatar: string | null
  userId: string | null
  categoria: string | null
  rotuloSingular: string | null
  rotuloPlural: string | null
  projeto: string
  projectSlug: string
  conjuntos: bigint
  afiliadoId: string | null
  afiliadoCodigo: string | null
  afiliadoNome: string | null
  comissaoCent: number | null
  comissaoEstornoCent: number | null
  comissaoBp: number | null
  comissaoEstado: string | null
}

interface LinhaDeCliente {
  chave: string
  nome: string | null
  email: string | null
  avatarUrl: string | null
  temConta: boolean
  pedidos: bigint
  gasto: bigint
  primeira: Date
  ultima: Date
  viaAfiliado: bigint
  eAfiliado: boolean
  total: bigint
}
