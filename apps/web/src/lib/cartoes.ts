'use client'

import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

export type FormatoDaMoldura = 'CIRCULO' | 'ELIPSE' | 'RETANGULO'
export type NivelDeQualidade = 'BOA' | 'ACEITAVEL' | 'INSUFICIENTE'
export type AlinhamentoDoNome = 'ESQUERDA' | 'CENTRO' | 'DIREITA'
export type EstadoDoPedido =
  | 'RASCUNHO'
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGO'
  | 'PRONTO'
  | 'EXPIRADO'

/** Os ladrilhos de uma arte: cada um em `{url}/{dpi}/{coluna}_{linha}.jpeg`. */
export interface MosaicoDaArte {
  url: string
  /** O lado de cada ladrilho, em pixéis, sem a sobreposição. */
  lado: number
  /** Os pixéis de cada ladrilho repetidos no vizinho, de cada lado. */
  sobreposicao: number
  /** Do mais leve ao mais pesado. */
  niveis: { dpi: number; largura: number; altura: number }[]
}

export interface ModeloDeCartao {
  id: string
  slug: string
  dia: number
  nome: string
  idioma: string
  arteUrl: string | null
  /** A arte a 300 dpi, só para a lupa. Nula em artes carregadas como imagem. */
  arteLupaUrl?: string | null
  /**
   * O PDF que o designer entregou. Quando existe, é ele que o ecrã desenha
   * (ver `ArteEmPdf`); as imagens ficam para o primeiro instante.
   */
  artePdfUrl?: string | null
  /** O mesmo PDF em ladrilhos desenhados no servidor, para a lupa (ver `ArteEmMosaico`). */
  arteMosaico?: MosaicoDaArte | null
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

/**
 * Uma criança do pedido, como o servidor a conhece: um lugar a pagar, e nada
 * mais.
 *
 * DESDE 03/10 O SERVIDOR NÃO SABE O NOME NEM VÊ A FOTO. O cliente pediu
 * "zero armazenamento": a foto fica só na memória do telemóvel, o PDF é
 * montado lá, e o servidor guarda o pagamento e o código de liberação. O nome
 * e o enquadramento vivem no ecrã (ver `EditorDeCartoes`).
 */
export interface CriancaDoPedido {
  id: string
  ordem: number
}

/**
 * Uma categoria de cartões: Crianças, Adultos, e as que o cliente criar.
 *
 * Os rótulos são o que o editor usa para falar: "quantas crianças?" numa,
 * "quantas pessoas?" noutra. Vêm da base de dados e não de um `if` aqui,
 * para uma categoria nova falar certo sem mexer neste ficheiro.
 */
export interface Categoria {
  slug: string
  nome: string
  descricao: string | null
  capaUrl: string | null
  /** A arte está de pé mas a porta ainda não abre. */
  emBreve: boolean
  /** A voz dele, por baixo da arte. */
  audioUrl: string | null
  rotuloSingular: string
  rotuloPlural: string
  cartoes: number
  preco: {
    precoUnitarioCent: number
    /** O riscado de um conjunto. Nulo quando não há. */
    precoDeTabelaCent: number | null
    descontoPercentagem: number
    descontoAPartirDe: number
    moeda: string
  }
}

export interface Pedido {
  id: string
  projectSlug: string
  categoria: {
    slug: string
    nome: string
    rotuloSingular: string
    rotuloPlural: string
  } | null
  idioma: string
  estado: EstadoDoPedido
  moeda: string
  preco: {
    quantidade: number
    subtotalCent: number
    descontoCent: number
    totalCent: number
    percentagemAplicada: number
    /** O riscado do pedido inteiro. Nulo quando não há. */
    deTabelaCent: number | null
  }
  meio: 'PIX' | 'CARTAO' | null
  pixCopiaECola: string | null
  pixQrSvg: string | null
  pagoEm: string | null
  expiraEm: string
  /**
   * O código de liberação: existe a partir do pagamento confirmado, e é ele que
   * deixa o telemóvel buscar as artes de impressão e montar o PDF. Serve também
   * para voltar a gerar noutro aparelho, até ao prazo.
   */
  codigoDeLiberacao: string | null
  /** Se o PDF já foi gerado num aparelho (o servidor só sabe que sim, não o vê). */
  gerado: boolean
  criancas: CriancaDoPedido[]
}

/** A arte de impressão de cada modelo, entregue depois do pagamento. */
export interface ArteLiberada {
  modeloId: string
  arte: { tipo: 'pdf' | 'imagem'; url: string } | null
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
  categorias: (projeto: string) =>
    chamarComRenovacao<Categoria[]>(`/projects/${projeto}/cartoes/categorias`),

  modelos: (projeto: string, categoria?: string) =>
    chamarComRenovacao<ModeloDeCartao[]>(
      `/projects/${projeto}/cartoes/modelos` +
        (categoria ? `?categoria=${encodeURIComponent(categoria)}` : ''),
    ),

  preco: (projeto: string) =>
    chamarComRenovacao<TabelaDePrecos>(`/projects/${projeto}/cartoes/preco`),

  criarPedido: (projeto: string, criancas: number, categoria?: string) =>
    chamarComRenovacao<Pedido>(`/projects/${projeto}/cartoes/pedidos`, {
      method: 'POST',
      body: JSON.stringify({ criancas, categoria }),
    }),

  verPedido: (projeto: string, pedidoId: string) =>
    chamarComRenovacao<Pedido>(`/projects/${projeto}/cartoes/pedidos/${pedidoId}`),

  /**
   * `aprovou`: a caixa da confirmação antes de pagar. `consentiu`: a do
   * responsável pela criança. O servidor recusa sem as duas.
   */
  pagar: (
    projeto: string,
    pedidoId: string,
    meio: 'PIX' | 'CARTAO',
    email: string,
    aprovou: boolean,
    consentiu: boolean,
  ) =>
    chamarComRenovacao<Pedido & { urlDeRedireccionamento: string | null }>(
      `/projects/${projeto}/cartoes/pedidos/${pedidoId}/pagamento`,
      { method: 'POST', body: JSON.stringify({ meio, email, aprovou, consentiu }) },
    ),

  /** Se há formulário de cartão na página (06/10), e a chave pública dele. */
  configuracaoDoPagamento: (projeto: string) =>
    chamar<{ chavePublicaDoCartao: string | null }>(`/projects/${projeto}/cartoes/pagamento`),

  /**
   * O cartão digitado na página: vai o token do formulário do Mercado Pago,
   * nunca o número. Recusado, lança com a frase do motivo.
   */
  pagarComCartao: (
    projeto: string,
    pedidoId: string,
    dados: {
      token: string
      metodo: string
      tipo: 'credit_card' | 'debit_card'
      parcelas: number
      documento: { tipo: string; numero: string } | null
      email: string
      aprovou: boolean
      consentiu: boolean
    },
  ) =>
    chamarComRenovacao<Pedido & { situacao: 'APROVADO' | 'EM_ANALISE'; motivo: string | null }>(
      `/projects/${projeto}/cartoes/pedidos/${pedidoId}/pagamento/cartao`,
      {
        method: 'POST',
        body: JSON.stringify({ ...dados, documento: dados.documento ?? undefined }),
      },
    ),

  /**
   * As artes de impressão do pedido pago, com o código de liberação.
   *
   * É o único passo em que o telemóvel pede alguma coisa ao servidor para
   * gerar o PDF — e o que vai no pedido é o código, nunca a foto.
   */
  liberacao: (projeto: string, pedidoId: string, codigo: string) =>
    chamarComRenovacao<{ expiraEm: string; artes: ArteLiberada[] }>(
      `/projects/${projeto}/cartoes/pedidos/${pedidoId}/liberacao?codigo=${encodeURIComponent(codigo)}`,
    ),

  /** Avisa que o PDF foi gerado no aparelho. Leva só o código: nem foto, nem nome. */
  marcarGerado: (projeto: string, pedidoId: string, codigo: string) =>
    chamarComRenovacao<void>(`/projects/${projeto}/cartoes/pedidos/${pedidoId}/gerado`, {
      method: 'POST',
      body: JSON.stringify({ codigo }),
    }),
}
