'use client'

/**
 * Cliente de autenticação.
 *
 * Sobre onde os tokens ficam: o access token vive apenas em memória e o
 * refresh token no localStorage. Não é o esquema mais forte possível — cookie
 * httpOnly seria melhor contra XSS — mas é o equilíbrio adequado para esta
 * fase: são contas de baixo valor num app educacional infantil, sem pagamento
 * dentro da plataforma, e o access token some ao fechar a aba.
 *
 * Se um dia houver pagamento aqui dentro, este é o arquivo a revisitar. Todo
 * o armazenamento está concentrado neste módulo justamente para isso.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'
const CHAVE_REFRESH = 'pv_refresh'

export interface Usuario {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  role: string
  createdAt: string
}

/** Só em memória: não sobrevive ao fechar a aba, e XSS não lê do storage. */
let accessTokenEmMemoria: string | null = null

export const tokens = {
  get access() {
    return accessTokenEmMemoria
  },
  set access(valor: string | null) {
    accessTokenEmMemoria = valor
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(CHAVE_REFRESH)
  },
  set refresh(valor: string | null) {
    if (typeof window === 'undefined') return
    if (valor) window.localStorage.setItem(CHAVE_REFRESH, valor)
    else window.localStorage.removeItem(CHAVE_REFRESH)
  },
  limpar() {
    accessTokenEmMemoria = null
    if (typeof window !== 'undefined') window.localStorage.removeItem(CHAVE_REFRESH)
  },
}

export class ErroDeApi extends Error {
  constructor(
    public readonly status: number,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${caminho}`, {
    ...init,
    credentials: 'include', // o cookie pv_anon precisa ir junto
    headers: {
      'Content-Type': 'application/json',
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

/**
 * Chamada autenticada com renovação automática.
 *
 * Se o access token expirou (15 min), tenta renovar uma vez e repete. Sem
 * isso, a pessoa seria deslogada no meio do uso — inaceitável num app que a
 * criança abre e fecha o dia todo.
 */
async function chamarAutenticado<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  try {
    return await chamar<T>(caminho, init)
  } catch (erro) {
    if (!(erro instanceof ErroDeApi) || erro.status !== 401) throw erro
    const renovou = await renovarSessao()
    if (!renovou) throw erro
    return chamar<T>(caminho, init)
  }
}

export async function renovarSessao(): Promise<boolean> {
  const refresh = tokens.refresh
  if (!refresh) return false
  try {
    const r = await chamar<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    })
    tokens.access = r.accessToken
    tokens.refresh = r.refreshToken
    return true
  } catch {
    tokens.limpar()
    return false
  }
}

export const auth = {
  async cadastrar(dados: {
    projectId: string
    email: string
    password: string
    displayName: string
  }): Promise<Usuario> {
    const r = await chamar<{ user: Usuario; accessToken: string; refreshToken: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(dados) },
    )
    tokens.access = r.accessToken
    tokens.refresh = r.refreshToken
    return r.user
  },

  async entrar(dados: { projectId: string; email: string; password: string }): Promise<Usuario> {
    const r = await chamar<{ user: Usuario; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(dados) },
    )
    tokens.access = r.accessToken
    tokens.refresh = r.refreshToken
    return r.user
  },

  async sair(): Promise<void> {
    const refresh = tokens.refresh
    tokens.limpar()
    if (!refresh) return
    await chamar('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => {
      // Sessão local já foi limpa; falha no servidor não deve travar a saída.
    })
  },

  me: () => chamarAutenticado<Usuario>('/auth/me'),
  perfil: () => chamarAutenticado<PerfilResposta>('/me/profile'),
  publicacoes: () => chamarAutenticado<Publicacao[]>('/me/posts'),
  registro: () => chamarAutenticado<ItemDeRegistro[]>('/me/record'),
}

export interface PerfilResposta {
  user: {
    id: string
    displayName: string
    email: string
    avatarUrl: string | null
    bio: string | null
    createdAt: string
  }
  estatisticas: {
    comentarios: number
    curtidas: number
    compartilhamentos: number
    conteudosVistos: number
  }
}

export interface Publicacao {
  id: string
  body: string
  createdAt: string
  content: { slug: string; title: string; project: { slug: string } }
}

export interface ItemDeRegistro {
  id: string
  type: string
  occurredAt: string
  props: Record<string, unknown>
  content: { slug: string; title: string; project: { slug: string } } | null
}

// ── Consentimento ───────────────────────────────────────────────────

export interface SituacaoDeConsentimento {
  status: 'PENDING' | 'GRANTED' | 'DENIED' | 'REVOKED'
  precisaPerguntar: boolean
  policyVersion: string
}

export const consentimento = {
  situacao: () => chamar<SituacaoDeConsentimento>('/consent'),
  registrar: (dados: {
    projectId: string
    granted: boolean
    analytics?: boolean
    marketing?: boolean
  }) => chamar<{ status: string }>('/consent', { method: 'POST', body: JSON.stringify(dados) }),
}
