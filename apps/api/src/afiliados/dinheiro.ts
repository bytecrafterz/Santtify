/**
 * As contas de dinheiro dos afiliados e das vendas.
 *
 * TUDO EM CÊNTIMOS INTEIROS, como o resto do pedido. Um `0.1 + 0.2` numa
 * comissão é um cêntimo a mais ou a menos no extracto de alguém, e ao fim de
 * mil vendas é uma conversa difícil com um afiliado que fez as contas à mão.
 */

/** A comissão de uma base, em pontos-base (4000 = 40%). Arredonda ao cêntimo. */
export function comissaoDe(baseCent: number, bp: number): number {
  if (baseCent <= 0 || bp <= 0) return 0
  return Math.round((baseCent * bp) / 10_000)
}

/**
 * A taxa do processador, estimada pela percentagem do painel.
 *
 * Só para quando o aviso não a diz — e quem guarda o resultado marca-o como
 * estimado, para o painel nunca o fazer passar por exacto.
 */
export function taxaEstimadaDe(
  totalCent: number,
  meio: string | null | undefined,
  taxas: { taxaPixBp: number; taxaCartaoBp: number },
): number {
  const bp = meio === 'CARTAO' ? taxas.taxaCartaoBp : taxas.taxaPixBp
  return Math.max(0, Math.round((totalCent * bp) / 10_000))
}

/** "R$ 12,00" — para os e-mails. O ecrã formata do lado dele. */
export function reais(cent: number, moeda = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(cent / 100)
}

/**
 * "Maria Silva Santos" → "Maria S."
 *
 * É o que o AFILIADO vê de quem comprou pelo link dele: o bastante para
 * reconhecer uma venda ("foi a Maria da igreja"), e nada mais. Combinado com
 * o cliente em 25/09, por causa da LGPD. Os nomes das crianças nunca saem
 * daqui para ninguém.
 */
export function nomeResumido(nome: string | null | undefined): string | null {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return null
  const primeiro = partes[0]
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : null
  return ultimo ? `${primeiro} ${ultimo.charAt(0).toUpperCase()}.` : primeiro
}

// ── CSV ──────────────────────────────────────────────────────────────

/** Um valor de dinheiro já escrito como a folha o quer: "12,50". */
export interface DinheiroNaFolha {
  readonly dinheiro: string
}

export function naFolha(cent: number | null | undefined): DinheiroNaFolha | null {
  return cent == null ? null : { dinheiro: (cent / 100).toFixed(2).replace('.', ',') }
}

type Celula = string | number | boolean | Date | DinheiroNaFolha | null | undefined

/**
 * Uma folha para o Excel em português.
 *
 * Ponto e vírgula, e não vírgula, porque a vírgula é a casa decimal no Brasil —
 * com vírgula, o Excel dele parte "12,50" em duas colunas. BOM no início para
 * os acentos abrirem certos, e quebras CRLF, que é o que o Excel espera.
 *
 * E NUNCA UMA FÓRMULA. Um nome começado por "=" ou "+" seria executado pelo
 * Excel ao abrir a folha: um cliente chamado "=HYPERLINK(...)" transformava a
 * exportação do painel numa armadilha. Esses textos levam um apóstrofo à
 * frente, que é o que o Excel entende como "isto é texto".
 */
export function folha(cabecalho: string[], linhas: Celula[][]): string {
  const celula = (v: Celula): string => {
    if (v == null) return ''
    if (typeof v === 'object' && 'dinheiro' in v) return v.dinheiro
    if (v instanceof Date) return v.toISOString().replace('T', ' ').slice(0, 19)
    if (typeof v === 'number') return String(v)
    if (typeof v === 'boolean') return v ? 'sim' : 'não'
    let t = v
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
    return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const linha = (l: Celula[]) => l.map(celula).join(';')
  return '﻿' + [cabecalho, ...linhas].map(linha).join('\r\n') + '\r\n'
}

// ── DATAS ────────────────────────────────────────────────────────────

const DIA = 86_400_000

export function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * DIA)
}

/** O dia de uma data em UTC, à meia-noite — a chave do clique único por dia. */
export function diaUtc(data = new Date()): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()))
}

/**
 * O fuso das contas do painel: o de São Paulo.
 *
 * Fixo em -03:00, e pode sê-lo: o Brasil acabou com o horário de verão em
 * 2019. "Vendas de hoje" é o dia dele, e não o de Greenwich — às 22h de São
 * Paulo já é amanhã em UTC, e a venda das 22h caía no dia errado do gráfico.
 */
const FUSO_MS = 3 * 60 * 60 * 1000

/** "2026-09-28" → o instante em que esse dia começa em São Paulo. */
export function inicioDoDia(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + FUSO_MS)
  return Number.isNaN(d.getTime()) ? null : d
}

/** O dia de São Paulo de um instante, como "2026-09-28". */
export function diaEmSaoPaulo(data: Date): string {
  return new Date(data.getTime() - FUSO_MS).toISOString().slice(0, 10)
}

export interface Periodo {
  inicio: Date
  /** Exclusivo: o começo do dia a seguir ao último. */
  fim: Date
  anteriorInicio: Date
  anteriorFim: Date
  dias: number
  de: string
  ate: string
}

/**
 * O período dos filtros do painel, com o período anterior do mesmo tamanho —
 * o "vs. período anterior" dos mockups dele.
 *
 * Sem datas: os últimos 30 dias até hoje. Datas inválidas ou trocadas caem
 * para isso também, em vez de rebentarem num erro que o painel teria de
 * explicar.
 */
export function periodoDe(de?: string | null, ate?: string | null, agora = new Date()): Periodo {
  const hoje = diaEmSaoPaulo(agora)
  let fimDia = (ate && inicioDoDia(ate) ? ate : hoje) as string
  let inicioDia = de && inicioDoDia(de) ? de : diaEmSaoPaulo(somarDias(inicioDoDia(fimDia)!, -29))
  if (inicioDoDia(inicioDia)! > inicioDoDia(fimDia)!) {
    ;[inicioDia, fimDia] = [fimDia, inicioDia]
  }
  const inicio = inicioDoDia(inicioDia)!
  let fim = somarDias(inicioDoDia(fimDia)!, 1)
  // Três anos no máximo: um painel a somar uma década de uma vez é um painel
  // que demora, e ninguém decide nada olhando para uma década.
  if (fim.getTime() - inicio.getTime() > 1096 * DIA) fim = somarDias(inicio, 1096)
  const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA)
  return {
    inicio,
    fim,
    anteriorInicio: somarDias(inicio, -dias),
    anteriorFim: inicio,
    dias,
    de: diaEmSaoPaulo(inicio),
    ate: diaEmSaoPaulo(somarDias(fim, -1)),
  }
}

/** A variação entre dois números, em fracção (0.12 = +12%). Nula sem base. */
export function variacao(agora: number, antes: number): number | null {
  if (!antes) return agora ? null : 0
  return (agora - antes) / antes
}
