import { Injectable, NotFoundException } from '@nestjs/common'
import { EstadoDaComissao, Prisma } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { AfiliadosService, estadoVisivel } from './afiliados.service'
import { folha, naFolha, periodoDe, somarDias, variacao } from './dinheiro'
import { AGORA } from './sql'

export type OrdemDosAfiliados = 'vendas' | 'saldo' | 'cliques' | 'recentes' | 'nome'

/** A ordem é escolhida de uma lista fechada: nunca texto de fora dentro do SQL. */
const ORDENS: Record<OrdemDosAfiliados, Prisma.Sql> = {
  vendas: Prisma.sql`vendas DESC, a."criadoEm" DESC`,
  saldo: Prisma.sql`(COALESCE(co.disponivel, 0) - COALESCE(co.adescontar, 0)) DESC, vendas DESC`,
  cliques: Prisma.sql`cliques DESC, vendas DESC`,
  recentes: Prisma.sql`a."criadoEm" DESC`,
  nome: Prisma.sql`u."displayName" ASC`,
}

/** "Maria" num ILIKE, sem deixar "%" e "_" de quem escreve virarem curingas. */
export function padraoDeBusca(busca: string): string {
  return `%${busca.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/**
 * O painel dos afiliados, do lado do administrador.
 *
 * A LISTA SOMA NA BASE, NÃO AQUI. Com mil afiliados, trazer as comissões de
 * todos para somar em memória era trazer a tabela inteira a cada página; o
 * `GROUP BY` faz o mesmo em milissegundos, e a página traz só as vinte linhas
 * que mostra.
 */
@Injectable()
export class PainelDeAfiliadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly afiliados: AfiliadosService,
  ) {}

  private consulta(filtro: { estado?: string | null; busca?: string | null }) {
    const estado = filtro.estado === 'ATIVO' || filtro.estado === 'SUSPENSO' ? filtro.estado : null
    const busca = filtro.busca?.trim() ? padraoDeBusca(filtro.busca) : null
    return Prisma.sql`
      WITH co AS (
        SELECT "afiliadoId",
               COUNT(*) FILTER (WHERE estado IN ('PENDENTE', 'PAGA')) AS vendas,
               COALESCE(SUM("valorCent" - "estornoCent") FILTER (WHERE estado <> 'CANCELADA'), 0) AS gerada,
               COALESCE(SUM("valorCent") FILTER (WHERE estado = 'PENDENTE' AND "liberaEm" > ${AGORA}), 0) AS pendente,
               COALESCE(SUM("valorCent") FILTER (WHERE estado = 'PENDENTE' AND "liberaEm" <= ${AGORA}), 0) AS disponivel,
               COALESCE(SUM("estornoCent" - "estornoDescontadoCent") FILTER (WHERE estado IN ('PAGA', 'ESTORNADA')), 0) AS adescontar
          FROM comissoes_de_afiliados
         GROUP BY "afiliadoId"
      ),
      cl AS (
        SELECT "afiliadoId", COUNT(*) AS cliques FROM cliques_de_afiliados GROUP BY "afiliadoId"
      ),
      pg AS (
        SELECT "afiliadoId", SUM("valorCent") AS recebido FROM pagamentos_a_afiliados GROUP BY "afiliadoId"
      )
      SELECT a.id, a.codigo, a.estado::text AS estado, a.origem::text AS origem, a."criadoEm",
             a."tipoDaChavePix", a."chavePix", a."nomeDoTitular",
             u.id AS "userId", u."displayName" AS nome, CASE WHEN u.status = 'DELETED' THEN NULL ELSE u.email END AS email, u."avatarUrl", u.username,
             COALESCE(cl.cliques, 0) AS cliques,
             COALESCE(co.vendas, 0) AS vendas,
             COALESCE(co.gerada, 0) AS gerada,
             COALESCE(co.pendente, 0) AS pendente,
             COALESCE(co.disponivel, 0) AS disponivel,
             COALESCE(co.adescontar, 0) AS adescontar,
             COALESCE(pg.recebido, 0) AS recebido,
             COUNT(*) OVER () AS total
        FROM afiliados a
        JOIN users u ON u.id = a."userId"
        LEFT JOIN co ON co."afiliadoId" = a.id
        LEFT JOIN cl ON cl."afiliadoId" = a.id
        LEFT JOIN pg ON pg."afiliadoId" = a.id
       WHERE (${estado}::text IS NULL OR a.estado::text = ${estado}::text)
         AND (${busca}::text IS NULL
              OR u."displayName" ILIKE ${busca}::text
              OR u.email ILIKE ${busca}::text
              OR a.codigo ILIKE ${busca}::text
              OR u.username ILIKE ${busca}::text)`
  }

  private linha(l: LinhaDeAfiliado) {
    const disponivel = Number(l.disponivel)
    const aDescontar = Number(l.adescontar)
    const cliques = Number(l.cliques)
    const vendas = Number(l.vendas)
    return {
      id: l.id,
      codigo: l.codigo,
      link: this.afiliados.linkPublico(l.codigo),
      estado: l.estado as 'ATIVO' | 'SUSPENSO',
      origem: l.origem,
      desde: l.criadoEm,
      nome: l.nome,
      email: l.email,
      avatarUrl: l.avatarUrl,
      username: l.username,
      temPix: Boolean(l.chavePix),
      cliques,
      vendas,
      conversao: cliques > 0 ? vendas / cliques : 0,
      geradaCent: Number(l.gerada),
      pendenteCent: Number(l.pendente),
      disponivelCent: disponivel,
      aDescontarCent: aDescontar,
      aPagarCent: Math.max(0, disponivel - aDescontar),
      recebidoCent: Number(l.recebido),
    }
  }

  async listar(filtro: {
    estado?: string | null
    busca?: string | null
    ordem?: string | null
    pagina?: number
    porPagina?: number
    de?: string | null
    ate?: string | null
  }) {
    const porPagina = Math.min(100, Math.max(1, filtro.porPagina ?? 20))
    const pagina = Math.max(1, filtro.pagina ?? 1)
    const ordem = ORDENS[(filtro.ordem as OrdemDosAfiliados) ?? 'vendas'] ?? ORDENS.vendas
    const periodo = periodoDe(filtro.de, filtro.ate)

    const [linhas, abas, kpis] = await Promise.all([
      this.prisma.$queryRaw<LinhaDeAfiliado[]>(Prisma.sql`
        ${this.consulta(filtro)}
        ORDER BY ${ordem}
        LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`),
      this.prisma.afiliado.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.kpis(periodo),
    ])

    const contar = (e: string) => abas.find((a) => a.estado === e)?._count._all ?? 0
    return {
      periodo: { de: periodo.de, ate: periodo.ate },
      kpis,
      abas: { todos: contar('ATIVO') + contar('SUSPENSO'), ativos: contar('ATIVO'), suspensos: contar('SUSPENSO') },
      total: linhas.length ? Number(linhas[0].total) : 0,
      pagina,
      porPagina,
      afiliados: linhas.map((l) => this.linha(l)),
    }
  }

  /** Os quatro números do topo, com o período anterior do mesmo tamanho. */
  private async kpis(periodo: ReturnType<typeof periodoDe>) {
    const novos = (inicio: Date, fim: Date) =>
      this.prisma.afiliado.count({ where: { criadoEm: { gte: inicio, lt: fim } } })
    const vendas = (inicio: Date, fim: Date) =>
      this.prisma.comissaoDeAfiliado.count({
        where: {
          criadaEm: { gte: inicio, lt: fim },
          estado: { in: [EstadoDaComissao.PENDENTE, EstadoDaComissao.PAGA] },
        },
      })
    const [total, novosAgora, novosAntes, vendasAgora, vendasAntes, dinheiro] = await Promise.all([
      this.prisma.afiliado.count(),
      novos(periodo.inicio, periodo.fim),
      novos(periodo.anteriorInicio, periodo.anteriorFim),
      vendas(periodo.inicio, periodo.fim),
      vendas(periodo.anteriorInicio, periodo.anteriorFim),
      this.prisma.$queryRaw<Array<{ pendente: bigint; disponivel: bigint; adescontar: bigint }>>`
        SELECT COALESCE(SUM("valorCent") FILTER (WHERE estado = 'PENDENTE' AND "liberaEm" > ${AGORA}), 0) AS pendente,
               COALESCE(SUM("valorCent") FILTER (WHERE estado = 'PENDENTE' AND "liberaEm" <= ${AGORA}), 0) AS disponivel,
               COALESCE(SUM("estornoCent" - "estornoDescontadoCent") FILTER (WHERE estado IN ('PAGA', 'ESTORNADA')), 0) AS adescontar
          FROM comissoes_de_afiliados`,
    ])
    const d = dinheiro[0]
    return {
      afiliados: total,
      novosNoPeriodo: novosAgora,
      novosVariacao: variacao(novosAgora, novosAntes),
      vendasNoPeriodo: vendasAgora,
      vendasVariacao: variacao(vendasAgora, vendasAntes),
      pendenteCent: Number(d.pendente),
      disponivelCent: Number(d.disponivel),
      aDescontarCent: Number(d.adescontar),
    }
  }

  async detalhe(id: string) {
    const afiliado = await this.prisma.afiliado.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true, username: true, createdAt: true } },
      },
    })
    if (!afiliado) throw new NotFoundException('Afiliado não encontrado.')

    const agora = new Date()
    const inicio = somarDias(agora, -29)
    const [saldo, cliques, porDia, comissoes, pagamentos] = await Promise.all([
      this.afiliados.saldo(id),
      this.prisma.cliqueDeAfiliado.count({ where: { afiliadoId: id } }),
      this.prisma.cliqueDeAfiliado.groupBy({
        by: ['dia'],
        where: { afiliadoId: id, dia: { gte: new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate())) } },
        _count: { _all: true },
        orderBy: { dia: 'asc' },
      }),
      this.prisma.comissaoDeAfiliado.findMany({
        where: { afiliadoId: id },
        orderBy: { criadaEm: 'desc' },
        take: 100,
        include: {
          pedido: {
            select: {
              id: true,
              numero: true,
              totalCent: true,
              reembolsadoCent: true,
              pagoEm: true,
              emailDoComprador: true,
              nomeDoComprador: true,
              user: { select: { displayName: true, email: true, status: true } },
            },
          },
        },
      }),
      this.prisma.pagamentoAoAfiliado.findMany({
        where: { afiliadoId: id },
        orderBy: { pagoEm: 'desc' },
        take: 100,
        include: { pagoPor: { select: { displayName: true } } },
      }),
    ])

    return {
      id: afiliado.id,
      codigo: afiliado.codigo,
      link: this.afiliados.linkPublico(afiliado.codigo),
      estado: afiliado.estado,
      origem: afiliado.origem,
      desde: afiliado.criadoEm,
      suspensoEm: afiliado.suspensoEm,
      motivoDaSuspensao: afiliado.motivoDaSuspensao,
      pix: afiliado.chavePix
        ? { tipo: afiliado.tipoDaChavePix, chave: afiliado.chavePix, titular: afiliado.nomeDoTitular }
        : null,
      pessoa: {
        id: afiliado.user.id,
        nome: afiliado.user.displayName,
        email: afiliado.user.email,
        avatarUrl: afiliado.user.avatarUrl,
        username: afiliado.user.username,
      },
      resumo: { cliques, conversao: cliques > 0 ? saldo.vendas / cliques : 0, ...saldo },
      cliquesPorDia: porDia.map((d) => ({ dia: d.dia.toISOString().slice(0, 10), cliques: d._count._all })),
      comissoes: comissoes.map((c) => ({
        id: c.id,
        estado: estadoVisivel(c, agora),
        criadaEm: c.criadaEm,
        liberaEm: c.liberaEm,
        pagaEm: c.pagaEm,
        valorCent: c.valorCent,
        estornoCent: c.estornoCent,
        baseCent: c.baseCent,
        comissaoBp: c.comissaoBp,
        motivoDoCancelamento: c.motivoDoCancelamento,
        pedido: {
          id: c.pedido.id,
          numero: c.pedido.numero,
          totalCent: c.pedido.totalCent,
          reembolsadoCent: c.pedido.reembolsadoCent,
          pagoEm: c.pedido.pagoEm,
          cliente: c.pedido.nomeDoComprador ?? c.pedido.user?.displayName ?? null,
          email: c.pedido.emailDoComprador ?? (c.pedido.user?.status === 'DELETED' ? null : c.pedido.user?.email) ?? null,
        },
      })),
      pagamentos: pagamentos.map((p) => ({
        id: p.id,
        pagoEm: p.pagoEm,
        valorCent: p.valorCent,
        comissoesCent: p.comissoesCent,
        descontosCent: p.descontosCent,
        chavePix: p.chavePix,
        nomeDoTitular: p.nomeDoTitular,
        observacao: p.observacao,
        pagoPor: p.pagoPor?.displayName ?? null,
      })),
    }
  }

  /** Quem tem saldo para receber agora, do maior para o menor. */
  async aPagar() {
    const cfg = await this.afiliados.configuracao()
    const linhas = await this.prisma.$queryRaw<LinhaDeAfiliado[]>(Prisma.sql`
      SELECT * FROM (${this.consulta({})}) x
       WHERE x.disponivel - x.adescontar > 0
       ORDER BY x.disponivel - x.adescontar DESC
       LIMIT 500`)
    // A chave Pix vai junto: é a lista de quem pagar, e pagar é copiar a chave.
    const afiliados = linhas.map((l) => ({
      ...this.linha(l),
      pix: l.chavePix ? { tipo: l.tipoDaChavePix, chave: l.chavePix, titular: l.nomeDoTitular } : null,
    }))
    return {
      minimoParaPagamentoCent: cfg.minimoParaPagamentoCent,
      totalCent: afiliados.reduce((t, a) => t + a.aPagarCent, 0),
      acimaDoMinimo: afiliados.filter((a) => a.aPagarCent >= cfg.minimoParaPagamentoCent).length,
      afiliados: afiliados.map((a) => ({ ...a, acimaDoMinimo: a.aPagarCent >= cfg.minimoParaPagamentoCent })),
    }
  }

  async exportar(filtro: { estado?: string | null; busca?: string | null }): Promise<string> {
    const linhas = await this.prisma.$queryRaw<LinhaDeAfiliado[]>(Prisma.sql`
      ${this.consulta(filtro)}
      ORDER BY vendas DESC, a."criadoEm" DESC
      LIMIT 100000`)
    return folha(
      [
        'Código',
        'Link',
        'Nome',
        'E-mail',
        'Estado',
        'Afiliado desde',
        'Cliques',
        'Vendas',
        'Comissão gerada',
        'Pendente',
        'Disponível',
        'A descontar',
        'Recebido',
        'Tipo da chave Pix',
        'Chave Pix',
        'Titular',
      ],
      linhas.map((l) => {
        const a = this.linha(l)
        return [
          a.codigo,
          a.link,
          a.nome,
          a.email,
          a.estado === 'ATIVO' ? 'Ativo' : 'Suspenso',
          a.desde,
          a.cliques,
          a.vendas,
          naFolha(a.geradaCent),
          naFolha(a.pendenteCent),
          naFolha(a.disponivelCent),
          naFolha(a.aDescontarCent),
          naFolha(a.recebidoCent),
          l.tipoDaChavePix,
          l.chavePix,
          l.nomeDoTitular,
        ]
      }),
    )
  }
}

interface LinhaDeAfiliado {
  id: string
  codigo: string
  estado: string
  origem: string
  criadoEm: Date
  tipoDaChavePix: string | null
  chavePix: string | null
  nomeDoTitular: string | null
  userId: string
  nome: string
  email: string
  avatarUrl: string | null
  username: string | null
  cliques: bigint
  vendas: bigint
  gerada: bigint
  pendente: bigint
  disponivel: bigint
  adescontar: bigint
  recebido: bigint
  total: bigint
}
