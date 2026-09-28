'use client'

import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

/** "Disponível" é calculado pelo servidor a partir da data: ver o schema. */
export type EstadoDaVenda = 'PENDENTE' | 'DISPONIVEL' | 'PAGA' | 'CANCELADA' | 'ESTORNADA'

export interface VendaDoAfiliado {
  id: string
  em: string
  /** "Maria S." — nunca o nome inteiro nem o e-mail de quem comprou. */
  comprador: string | null
  conjuntos: number
  valorCent: number
  comissaoCent: number
  estado: EstadoDaVenda
  liberaEm: string
}

export interface RegrasDoPrograma {
  comissaoBp: number
  diasDeCarencia: number
  diasDeAtribuicao: number
  minimoParaPagamentoCent: number
  regulamento: string | null
}

export type TipoDeChavePix = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA'

export interface PainelDoAfiliado {
  programaAtivo: boolean
  estado: 'BLOQUEADO' | 'ATIVO' | 'SUSPENSO'
  regras: RegrasDoPrograma
  /** Onde comprar o primeiro conjunto — a porta da área bloqueada. */
  compraPath: string
  afiliado: {
    codigo: string
    link: string
    mensagemDoWhatsapp: string
    desde: string
    motivoDaSuspensao: string | null
    metricas: {
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
    pix: { tipo: TipoDeChavePix | null; chave: string; titular: string | null } | null
    recentes: VendaDoAfiliado[]
    novidades: { vendas: number; disponivelCent: number } | null
    proximaLiberacao: { em: string; valorCent: number } | null
  } | null
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${caminho}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init.headers,
    },
  })
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message
    throw new ErroDeApi(res.status, msg ?? 'Não foi possível concluir. Tente de novo.')
  }
  return corpo as T
}

async function comRenovacao<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  try {
    return await chamar<T>(caminho, init)
  } catch (erro) {
    if (!(erro instanceof ErroDeApi) || erro.status !== 401) throw erro
    if (!(await renovarSessao())) throw erro
    return chamar<T>(caminho, init)
  }
}

export const afiliados = {
  painel: () => comRenovacao<PainelDoAfiliado>('/me/afiliado'),
  vendas: (pagina = 1) =>
    comRenovacao<{ total: number; pagina: number; porPagina: number; vendas: VendaDoAfiliado[] }>(
      `/me/afiliado/vendas?pagina=${pagina}`,
    ),
  definirPix: (tipo: TipoDeChavePix, chave: string, titular: string) =>
    comRenovacao<{ tipo: TipoDeChavePix; chave: string; titular: string }>('/me/afiliado/pix', {
      method: 'PUT',
      body: JSON.stringify({ tipo, chave, titular }),
    }),
  marcarVisto: () => comRenovacao<{ ok: boolean }>('/me/afiliado/visto', { method: 'POST' }),
}

/** Como cada estado se lê, na área do afiliado e no painel. */
export const NOME_DO_ESTADO: Record<EstadoDaVenda, string> = {
  PENDENTE: 'Pendente',
  DISPONIVEL: 'Disponível',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
  ESTORNADA: 'Estornada',
}

export const NOME_DA_CHAVE: Record<TipoDeChavePix, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'E-mail',
  TELEFONE: 'Telefone',
  ALEATORIA: 'Chave aleatória',
}

/** O endereço do WhatsApp com a mensagem já escrita. */
export function linkDoWhatsapp(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`
}
