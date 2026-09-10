'use client'

import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

export type FormatoDaMoldura = 'CIRCULO' | 'ELIPSE' | 'RETANGULO'
export type NivelDeQualidade = 'BOA' | 'ACEITAVEL' | 'INSUFICIENTE'
export type EstadoDoPedido =
  | 'RASCUNHO'
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGO'
  | 'PRONTO'
  | 'EXPIRADO'

export interface ModeloDeCartao {
  id: string
  slug: string
  dia: number
  nome: string
  arteUrl: string | null
  /** Tudo em milímetros sobre a folha A4, como no servidor. */
  moldura: {
    x: number
    y: number
    largura: number
    altura: number
    formato: FormatoDaMoldura
  }
  nomeCaixa: {
    x: number
    y: number
    largura: number
    altura: number
    corHex: string
    corpoMinimo: number
    corpoMaximo: number
    maiusculas: boolean
  }
}

export interface CriancaDoPedido {
  id: string
  ordem: number
  nome: string
  temFoto: boolean
  fotoLargura: number | null
  fotoAltura: number | null
  ajuste: { escala: number; deslocX: number; deslocY: number }
  tamanhoDoNome: number
  dpi: number | null
  nivel: NivelDeQualidade | null
  aprovada: boolean
  selecionada: boolean
  confirmada: boolean
  temPdf: boolean
}

export interface Pedido {
  id: string
  projectSlug: string
  estado: EstadoDoPedido
  moeda: string
  preco: {
    quantidade: number
    subtotalCent: number
    descontoCent: number
    totalCent: number
    percentagemAplicada: number
  }
  meio: 'PIX' | 'CARTAO' | null
  pixCopiaECola: string | null
  pixQrSvg: string | null
  pagoEm: string | null
  expiraEm: string
  criancas: CriancaDoPedido[]
}

export interface Veredicto {
  nivel: NivelDeQualidade
  dpi: number
  dpiSemZoom: number
  zoomMaximo: number
  aprovada: boolean
  mensagem: string
  minimo: { largura: number; altura: number }
  crianca: CriancaDoPedido
}

export interface TabelaDePrecos {
  precoUnitarioCent: number
  moeda: string
  descontoPercentagem: number
  descontoAPartirDe: number
}

/** Mesma mecânica de `social.ts`: token, renovação uma vez, erro tipado. */
async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const ehArquivo = init.body instanceof FormData

  const res = await fetch(`${API_URL}${caminho}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(ehArquivo ? {} : { 'Content-Type': 'application/json' }),
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 204) return undefined as T
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message
    throw new ErroDeApi(res.status, msg ?? 'Não foi possível concluir. Tente de novo.')
  }
  return corpo as T
}

async function chamarComRenovacao<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  try {
    return await chamar<T>(caminho, init)
  } catch (erro) {
    if (!(erro instanceof ErroDeApi) || erro.status !== 401) throw erro
    if (!(await renovarSessao())) throw erro
    return chamar<T>(caminho, init)
  }
}

export const cartoes = {
  modelos: (projeto: string) =>
    chamarComRenovacao<ModeloDeCartao[]>(`/projects/${projeto}/cartoes/modelos`),

  preco: (projeto: string) =>
    chamarComRenovacao<TabelaDePrecos>(`/projects/${projeto}/cartoes/preco`),

  criarPedido: (projeto: string, criancas: number) =>
    chamarComRenovacao<Pedido>(`/projects/${projeto}/cartoes/pedidos`, {
      method: 'POST',
      body: JSON.stringify({ criancas }),
    }),

  verPedido: (projeto: string, pedidoId: string) =>
    chamarComRenovacao<Pedido>(`/projects/${projeto}/cartoes/pedidos/${pedidoId}`),

  enviarFoto: (projeto: string, pedidoId: string, criancaId: string, ficheiro: File) => {
    const corpo = new FormData()
    corpo.append('foto', ficheiro)
    return chamarComRenovacao<Veredicto>(
      `/projects/${projeto}/cartoes/pedidos/${pedidoId}/criancas/${criancaId}/foto`,
      { method: 'POST', body: corpo },
    )
  },

  removerFoto: (projeto: string, pedidoId: string, criancaId: string) =>
    chamarComRenovacao<Pedido>(
      `/projects/${projeto}/cartoes/pedidos/${pedidoId}/criancas/${criancaId}/foto`,
      { method: 'DELETE' },
    ),

  actualizar: (
    projeto: string,
    pedidoId: string,
    criancaId: string,
    dados: Partial<{
      nome: string
      escala: number
      deslocX: number
      deslocY: number
      tamanhoDoNome: number
      selecionada: boolean
      confirmada: boolean
    }>,
  ) =>
    chamarComRenovacao<Pedido>(
      `/projects/${projeto}/cartoes/pedidos/${pedidoId}/criancas/${criancaId}`,
      { method: 'PATCH', body: JSON.stringify(dados) },
    ),

  pagar: (projeto: string, pedidoId: string, meio: 'PIX' | 'CARTAO') =>
    chamarComRenovacao<Pedido & { urlDeRedireccionamento: string | null }>(
      `/projects/${projeto}/cartoes/pedidos/${pedidoId}/pagamento`,
      { method: 'POST', body: JSON.stringify({ meio }) },
    ),

  /** O endereço da foto. Rota, nunca ficheiro estático — é foto de criança. */
  urlDaFoto: (projeto: string, pedidoId: string, criancaId: string) =>
    `${API_URL}/projects/${projeto}/cartoes/pedidos/${pedidoId}/criancas/${criancaId}/foto`,

  urlDoPdf: (projeto: string, pedidoId: string, criancaId: string) =>
    `${API_URL}/projects/${projeto}/cartoes/pedidos/${pedidoId}/criancas/${criancaId}/cartoes.pdf`,

  /**
   * A ligação assinada vem do servidor; o ecrã não a fabrica.
   *
   * Se fosse montada aqui, o prazo e a assinatura estariam do lado que
   * qualquer pessoa consegue abrir e mexer.
   */
  partilha: (projeto: string, pedidoId: string, criancaId: string) =>
    chamarComRenovacao<{
      url: string
      expiraEm: string
      nome: string
      textoParaWhatsApp: string
    }>(`/projects/${projeto}/cartoes/pedidos/${pedidoId}/criancas/${criancaId}/partilha`),

  enviarPorEmail: (projeto: string, pedidoId: string, criancaId: string, email: string) =>
    chamarComRenovacao<{ enviado: boolean; url: string; motivo?: string }>(
      `/projects/${projeto}/cartoes/pedidos/${pedidoId}/criancas/${criancaId}/email`,
      { method: 'POST', body: JSON.stringify({ email }) },
    ),
}
