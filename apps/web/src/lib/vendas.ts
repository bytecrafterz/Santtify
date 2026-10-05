'use client'

import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'
import type { EstadoDaVenda, TipoDeChavePix } from '@/lib/afiliados'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

// ── Tipos ─────────────────────────────────────────────────────────────

export type StatusDoPedido = 'AGUARDANDO' | 'EM_PRODUCAO' | 'CONCLUIDO' | 'CANCELADO' | 'REEMBOLSADO'
export type AbaDePedidos = 'AGUARDANDO' | 'EM_PRODUCAO' | 'CONCLUIDO' | 'CANCELADO'

export interface Numeros {
  pedidos: number
  conjuntos: number
  brutoCent: number
  reembolsosCent: number
  taxasCent: number
  comissoesCent: number
  liquidoCent: number
}

export interface Resumo extends Numeros {
  periodo: { de: string; ate: string; dias: number }
  ticketMedioCent: number
  variacao: { pedidos: number | null; brutoCent: number | null; comissoesCent: number | null; liquidoCent: number | null }
  anterior: Numeros
}

export interface LinhaDePedido {
  id: string
  numero: number | null
  criadoEm: string
  pagoEm: string | null
  status: StatusDoPedido
  reembolsoParcial: boolean
  cliente: { nome: string | null; email: string | null; avatarUrl: string | null; temConta: boolean }
  produto: {
    categoria: string | null
    projeto: string
    projectSlug: string
    conjuntos: number
    rotuloSingular: string | null
    rotuloPlural: string | null
  }
  totalCent: number
  reembolsadoCent: number
  moeda: string
  meio: 'PIX' | 'CARTAO' | null
  afiliado: {
    id: string
    nome: string | null
    codigo: string | null
    comissaoCent: number | null
    comissaoBp: number | null
    comissaoEstado: string | null
  } | null
}

export interface ListaDePedidos {
  periodo: { de: string; ate: string }
  abas: { todos: number } & Record<AbaDePedidos, number>
  total: number
  pagina: number
  porPagina: number
  pedidos: LinhaDePedido[]
}

export interface DetalheDoPedido {
  id: string
  numero: number | null
  status: StatusDoPedido
  criadoEm: string
  pagoEm: string | null
  prontoEm: string | null
  expiraEm: string
  arquivosExpirados: boolean
  reembolsadoEm: string | null
  aprovacaoEm: string | null
  cliente: { nome: string | null; email: string | null; avatarUrl: string | null; userId: string | null }
  produto: {
    projeto: string
    projectSlug: string
    categoria: string | null
    capaUrl: string | null
    rotuloSingular: string
    rotuloPlural: string
    conjuntos: number
    prontos: number
    nomes: string[]
  }
  pagamento: { meio: 'PIX' | 'CARTAO' | null; referencia: string | null; eventos: Array<{ tipo: string; recebidoEm: string }> }
  afiliado: { id: string; codigo: string; nome: string; email: string; avatarUrl: string | null } | null
  comissao: {
    id: string
    estado: EstadoDaVenda
    comissaoBp: number
    valorCent: number
    estornoCent: number
    liberaEm: string
  } | null
  valores: {
    moeda: string
    subtotalCent: number
    descontoCent: number
    totalCent: number
    reembolsadoCent: number
    taxaCent: number
    taxaEstimada: boolean
    liquidoCent: number
    comissaoCent: number
    seuLiquidoCent: number
  }
}

export interface LinhaDeAfiliado {
  id: string
  codigo: string
  link: string
  estado: 'ATIVO' | 'SUSPENSO'
  origem: string
  desde: string
  nome: string
  email: string
  avatarUrl: string | null
  username: string | null
  temPix: boolean
  cliques: number
  vendas: number
  conversao: number
  geradaCent: number
  pendenteCent: number
  disponivelCent: number
  aDescontarCent: number
  aPagarCent: number
  recebidoCent: number
}

export interface ListaDeAfiliados {
  periodo: { de: string; ate: string }
  kpis: {
    afiliados: number
    novosNoPeriodo: number
    novosVariacao: number | null
    vendasNoPeriodo: number
    vendasVariacao: number | null
    pendenteCent: number
    disponivelCent: number
    aDescontarCent: number
  }
  abas: { todos: number; ativos: number; suspensos: number }
  total: number
  pagina: number
  porPagina: number
  afiliados: LinhaDeAfiliado[]
}

export interface DetalheDoAfiliado {
  id: string
  codigo: string
  link: string
  estado: 'ATIVO' | 'SUSPENSO'
  origem: string
  desde: string
  suspensoEm: string | null
  motivoDaSuspensao: string | null
  pix: { tipo: TipoDeChavePix | null; chave: string; titular: string | null } | null
  pessoa: { id: string; nome: string; email: string; avatarUrl: string | null; username: string | null }
  resumo: {
    cliques: number
    conversao: number
    vendas: number
    geradaCent: number
    pendenteCent: number
    disponivelCent: number
    aDescontarCent: number
    aPagarCent: number
    recebidoCent: number
  }
  cliquesPorDia: Array<{ dia: string; cliques: number }>
  comissoes: Array<{
    id: string
    estado: EstadoDaVenda
    criadaEm: string
    liberaEm: string
    pagaEm: string | null
    valorCent: number
    estornoCent: number
    baseCent: number
    comissaoBp: number
    motivoDoCancelamento: string | null
    pedido: {
      id: string
      numero: number | null
      totalCent: number
      reembolsadoCent: number
      pagoEm: string | null
      cliente: string | null
      email: string | null
    }
  }>
  pagamentos: Array<{
    id: string
    pagoEm: string
    valorCent: number
    comissoesCent: number
    descontosCent: number
    chavePix: string | null
    nomeDoTitular: string | null
    observacao: string | null
    pagoPor: string | null
  }>
}

export interface ConfiguracaoDeAfiliados {
  ativo: boolean
  comissaoBp: number
  diasDeCarencia: number
  diasDeAtribuicao: number
  minimoParaPagamentoCent: number
  destino: string | null
  destinoResolvido: string | null
  mensagemDoWhatsapp: string
  regulamento: string | null
  taxaPixBp: number
  taxaCartaoBp: number
  emailDeAvisos: string | null
  vagas: number
  /** Só leitura: quantos afiliados há agora. */
  vagasOcupadas: number
  simulacaoKits: number
  simulacaoPrecoNormalCent: number
  simulacaoPrecoPromocionalCent: number
  atualizadoEm: string
}

export interface LinhaDeCliente {
  chave: string
  nome: string | null
  email: string | null
  avatarUrl: string | null
  temConta: boolean
  pedidos: number
  gastoCent: number
  primeira: string
  ultima: string
  viaAfiliado: number
  eAfiliado: boolean
}

export interface DetalheDoCliente {
  chave: string
  nome: string | null
  email: string | null
  avatarUrl: string | null
  username: string | null
  temConta: boolean
  contaDesde: string | null
  afiliado: { id: string; codigo: string; estado: string } | null
  gastoCent: number
  pedidos: Array<{
    id: string
    numero: number | null
    criadoEm: string
    pagoEm: string | null
    status: StatusDoPedido
    totalCent: number
    meio: 'PIX' | 'CARTAO' | null
    categoria: string | null
    projeto: string
    conjuntos: number
    afiliado: string | null
  }>
}

export interface Produto {
  id: string
  nome: string
  slug: string
  capaUrl: string | null
  ativo: boolean
  emBreve: boolean
  cartoes: number
  projeto: string
  projectSlug: string
  precoCent: number | null
  precoDeTabelaCent: number | null
  moeda: string
  pedidos: number
  conjuntos: number
  brutoCent: number
  reembolsosCent: number
}

export interface Financeiro {
  periodo: { de: string; ate: string; dias: number }
  resumo: Resumo
  comissoes: {
    pendenteCent: number
    disponivelCent: number
    aDescontarCent: number
    aPagarCent: number
    afiliadosAPagar: number
    acimaDoMinimo: number
    minimoParaPagamentoCent: number
    pagoNoPeriodoCent: number
    pagamentosNoPeriodo: number
  }
  aPagar: Array<
    LinhaDeAfiliado & {
      acimaDoMinimo: boolean
      pix: { tipo: TipoDeChavePix | null; chave: string; titular: string | null } | null
    }
  >
  pagamentos: Array<{
    id: string
    pagoEm: string
    afiliadoId: string
    afiliado: string
    email: string
    codigo: string
    comissoesCent: number
    descontosCent: number
    valorCent: number
    chavePix: string | null
    nomeDoTitular: string | null
    observacao: string | null
    pagoPor: string | null
  }>
}

export interface Relatorios {
  periodo: { de: string; ate: string; dias: number }
  resumo: Resumo
  serie: Array<{ dia: string; pedidos: number; brutoCent: number; comissoesCent: number }>
  porMeio: Array<{ meio: string | null; pedidos: number; brutoCent: number }>
  porOrigem: Array<{ origem: string; pedidos: number; brutoCent: number }>
  topAfiliados: Array<{ id: string; nome: string; codigo: string; vendas: number; brutoCent: number; comissaoCent: number }>
  funil: { criados: number; chegaramAoPagamento: number; pagos: number }
  afiliados: { cliques: number; vendas: number; conversao: number }
}

// ── Chamadas ──────────────────────────────────────────────────────────

async function pedir(caminho: string, init: RequestInit = {}): Promise<Response> {
  const fazer = () =>
    fetch(`${API_URL}${caminho}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
        ...init.headers,
      },
    })
  let res = await fazer()
  if (res.status === 401 && (await renovarSessao())) res = await fazer()
  return res
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await pedir(caminho, init)
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message
    throw new ErroDeApi(res.status, msg ?? 'Não foi possível concluir. Tente de novo.')
  }
  return corpo as T
}

/** Os filtros como texto de endereço, sem os vazios. */
export function consulta(filtros: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(filtros)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v))
  const t = p.toString()
  return t ? `?${t}` : ''
}

/**
 * Descarregar uma folha do painel.
 *
 * Não é um link simples: a sessão vive só na memória do separador, e um
 * `<a href>` iria sem ela. Pede-se com o token, e o ficheiro nasce aqui.
 */
async function descarregar(caminho: string, nome: string): Promise<void> {
  const res = await pedir(caminho)
  if (!res.ok) throw new ErroDeApi(res.status, 'Não foi possível exportar agora.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

type Filtros = Record<string, string | number | null | undefined>

export const vendas = {
  resumo: (f: Filtros) => chamar<Resumo>(`/admin/vendas/resumo${consulta(f)}`),
  filtros: () => chamar<{ categorias: Array<{ id: string; nome: string; projeto: string }> }>('/admin/vendas/filtros'),
  pedidos: (f: Filtros) => chamar<ListaDePedidos>(`/admin/vendas/pedidos${consulta(f)}`),
  pedido: (id: string) => chamar<DetalheDoPedido>(`/admin/vendas/pedidos/${id}`),
  exportarPedidos: (f: Filtros) => descarregar(`/admin/vendas/pedidos/exportar.csv${consulta(f)}`, 'pedidos.csv'),
  confirmarPagamento: (pedidoId: string) =>
    chamar<unknown>(`/admin/pedidos-de-cartoes/${pedidoId}/confirmar`, {
      method: 'POST',
      body: JSON.stringify({ referencia: 'painel de vendas' }),
    }),
  reembolsar: (pedidoId: string, valorCent: number | null, motivo: string) =>
    chamar<unknown>(`/admin/pedidos-de-cartoes/${pedidoId}/reembolso`, {
      method: 'POST',
      body: JSON.stringify({ ...(valorCent ? { valorCent } : {}), ...(motivo ? { motivo } : {}) }),
    }),
  clientes: (f: Filtros) =>
    chamar<{ total: number; pagina: number; porPagina: number; semIdentificacao: number; clientes: LinhaDeCliente[] }>(
      `/admin/vendas/clientes${consulta(f)}`,
    ),
  cliente: (chave: string) => chamar<DetalheDoCliente>(`/admin/vendas/clientes/detalhe${consulta({ chave })}`),
  produtos: (f: Filtros) => chamar<{ periodo: { de: string; ate: string }; produtos: Produto[] }>(`/admin/vendas/produtos${consulta(f)}`),
  financeiro: (f: Filtros) => chamar<Financeiro>(`/admin/vendas/financeiro${consulta(f)}`),
  exportarPagamentos: (f: Filtros) =>
    descarregar(`/admin/vendas/financeiro/pagamentos.csv${consulta(f)}`, 'pagamentos-a-afiliados.csv'),
  relatorios: (f: Filtros) => chamar<Relatorios>(`/admin/vendas/relatorios${consulta(f)}`),

  afiliados: (f: Filtros) => chamar<ListaDeAfiliados>(`/admin/afiliados${consulta(f)}`),
  afiliado: (id: string) => chamar<DetalheDoAfiliado>(`/admin/afiliados/${id}`),
  exportarAfiliados: (f: Filtros) => descarregar(`/admin/afiliados/exportar.csv${consulta(f)}`, 'afiliados.csv'),
  pagarAfiliado: (id: string, observacao: string) =>
    chamar<{ valorCent: number }>(`/admin/afiliados/${id}/pagar`, {
      method: 'POST',
      body: JSON.stringify(observacao ? { observacao } : {}),
    }),
  suspender: (id: string, motivo: string) =>
    chamar<unknown>(`/admin/afiliados/${id}/suspender`, { method: 'POST', body: JSON.stringify(motivo ? { motivo } : {}) }),
  reativar: (id: string) => chamar<unknown>(`/admin/afiliados/${id}/reativar`, { method: 'POST', body: '{}' }),
  cancelarComissao: (id: string, motivo: string) =>
    chamar<unknown>(`/admin/afiliados/comissoes/${id}/cancelar`, {
      method: 'POST',
      body: JSON.stringify(motivo ? { motivo } : {}),
    }),
  liberar: (email: string) =>
    chamar<{ criado: boolean; afiliado: { id: string; codigo: string } }>('/admin/afiliados/liberar', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  configuracao: () => chamar<ConfiguracaoDeAfiliados>('/admin/afiliados/configuracao'),
  guardarConfiguracao: (dados: Partial<ConfiguracaoDeAfiliados>) =>
    chamar<ConfiguracaoDeAfiliados>('/admin/afiliados/configuracao', { method: 'PATCH', body: JSON.stringify(dados) }),
}

export const NOME_DO_STATUS: Record<StatusDoPedido, string> = {
  AGUARDANDO: 'Aguardando',
  EM_PRODUCAO: 'Em produção',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  REEMBOLSADO: 'Reembolsado',
}

export const NOME_DO_MEIO: Record<string, string> = { PIX: 'Pix', CARTAO: 'Cartão' }
