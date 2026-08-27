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
  // Com arquivo, o próprio navegador escreve o Content-Type com a fronteira que
  // separa os campos. Escrever à mão aqui apagaria essa fronteira e o servidor
  // receberia um envio que não consegue ler.
  const ehArquivo = init.body instanceof FormData

  const res = await fetch(`${API_URL}${caminho}`, {
    ...init,
    credentials: 'include', // o cookie pv_anon precisa ir junto
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

/**
 * A renovação em curso, para não haver duas ao mesmo tempo.
 *
 * O ecrã faz vários pedidos de uma vez (o perfil, os contadores, a lista) e ao
 * fim de quinze minutos TODOS falham com 401 ao mesmo tempo. Cada um chamava a
 * renovação por sua conta, com o MESMO token guardado. O servidor trocava-o
 * duas vezes, e a segunda resposta gravava um token nascido de um que já tinha
 * sido trocado.
 *
 * Vê-se na base dele: 331 sessões guardadas para uma pessoa, com pares de
 * trocas dentro do mesmo minuto (06:20 e 06:20, 06:26 e 06:26). A janela de
 * tolerância de um minuto salvava quase sempre, e "quase" é o que explica ele
 * ter aberto o Santtify em 27/08 e ter tido de entrar outra vez.
 *
 * Quem chega a meio de uma renovação espera pela mesma, em vez de começar outra.
 */
let renovacaoEmCurso: Promise<boolean> | null = null

export function renovarSessao(): Promise<boolean> {
  if (renovacaoEmCurso) return renovacaoEmCurso
  renovacaoEmCurso = renovarAgora().finally(() => {
    renovacaoEmCurso = null
  })
  return renovacaoEmCurso
}

async function renovarAgora(): Promise<boolean> {
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
  } catch (erro) {
    /**
     * FALHAR A REDE NÃO É PERDER A SESSÃO.
     *
     * Isto apagava o token guardado a qualquer erro — incluindo uma falha de
     * rede. Um telemóvel que acorda com o wi-fi ainda a ligar falha o primeiro
     * pedido quase sempre, e bastava isso para a pessoa ser posta fora da
     * conta. Era a outra metade do que o cliente descreveu em 24/08.
     *
     * Só um 401 apaga: aí o servidor disse mesmo que aquele token já não
     * serve. Qualquer outra coisa é um problema de caminho, e o token fica
     * guardado para a próxima tentativa.
     */
    if (erro instanceof ErroDeApi && erro.status === 401) tokens.limpar()
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

  /**
   * Troca de senha. O servidor revoga todas as sessões e devolve um par novo;
   * guardamos esse par aqui, senão a própria pessoa que trocou seria expulsa
   * na chamada seguinte.
   */
  async trocarSenha(dados: { senhaAtual: string; senhaNova: string }): Promise<void> {
    const r = await chamarAutenticado<{ accessToken: string; refreshToken: string }>(
      '/auth/change-password',
      { method: 'POST', body: JSON.stringify(dados) },
    )
    tokens.access = r.accessToken
    tokens.refresh = r.refreshToken
  },

  /** Edição do próprio perfil. Vai como formulário porque leva a fotografia. */
  async atualizarPerfil(dados: {
    displayName?: string
    bio?: string
    guardianName?: string
    foto?: File | null
  }): Promise<PerfilResposta> {
    const form = new FormData()
    if (dados.displayName !== undefined) form.append('displayName', dados.displayName)
    if (dados.bio !== undefined) form.append('bio', dados.bio)
    if (dados.guardianName !== undefined) form.append('guardianName', dados.guardianName)
    if (dados.foto) form.append('foto', dados.foto)
    return chamarAutenticado<PerfilResposta>('/me/profile', { method: 'PATCH', body: form })
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
    guardianName: string | null
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
  body: string | null
  createdAt: string
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED'
  moderationNote: string | null
  imageAsset: { url: string; title: string | null } | null
  content: { slug: string; title: string; subtitle: string | null; project: { slug: string } }
}

export interface ItemDeRegistro {
  id: string
  type: string
  occurredAt: string
  props: Record<string, unknown>
  content: { slug: string; title: string; project: { slug: string } } | null
}

/*
 * A vitrine de lançamentos saiu do perfil em 11/08, por decisão do cliente.
 * O cliente HTTP dela foi removido daqui para não pesar o bundle sem ter quem
 * chame; o endpoint `/projects/:slug/launches` e o CRUD do painel continuam na
 * API, intactos, caso ele volte atrás.
 */

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
