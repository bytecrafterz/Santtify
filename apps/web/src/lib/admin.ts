'use client'

import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'

export type StatusConteudo = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type TipoBloco = 'TEXT' | 'RICH_TEXT' | 'AUDIO' | 'VIDEO' | 'IMAGE' | 'EMBED' | 'LINK'

export interface ItemAdmin {
  id: string
  slug: string
  title: string
  subtitle: string | null
  status: StatusConteudo
  position: number
  publishedAt: string | null
  updatedAt: string
  stats: { views: number; likes: number; comments: number; shares: number } | null
  qrCode: string | null
  blocosPreenchidos: number
  blocosTotal: number
}

export interface AssetAdmin {
  shareCardUrl?: string | null
  width?: number | null
  height?: number | null
  id: string
  kind: string
  url: string
  mimeType: string | null
  title: string | null
  sizeBytes: number | null
}

export interface BlocoAdmin {
  id: string
  type: TipoBloco
  label: string | null
  text: string | null
  url: string | null
  position: number
  assetId: string | null
  asset: AssetAdmin | null
}

export interface DetalheAdmin {
  project: { id: string; slug: string; name: string }
  content: {
    id: string
    slug: string
    title: string
    subtitle: string | null
    summary: string | null
    status: StatusConteudo
    position: number
    coverUrl: string | null
    shareCardUrl: string | null
    blocks: BlocoAdmin[]
    metadata: Record<string, unknown> | null
    qrCode: string | null
    qrUrl: string | null
  }
}

export interface ComentarioAdmin {
  id: string
  body: string
  status: 'PUBLISHED' | 'HIDDEN' | 'DELETED'
  createdAt: string
  user: { id: string; displayName: string; email: string; status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' }
  content: { slug: string; title: string }
}

export interface PublicacaoPendente {
  id: string
  body: string | null
  createdAt: string
  imageAsset: { url: string; title: string | null } | null
  user: { id: string; displayName: string; email: string }
  content: { slug: string; title: string; subtitle: string | null; project: { slug: string } }
}

/** Igual ao `chamar`, mas sem o prefixo `/admin` — a remoção de comentário é a
 *  mesma rota que o autor usa, e o servidor decide pelo papel de quem chama. */
function chamarRaiz<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  return chamar<T>(caminho, init, false, true)
}

async function chamar<T>(
  caminho: string,
  init: RequestInit = {},
  tentouRenovar = false,
  semPrefixo = false,
): Promise<T> {
  const res = await fetch(`${API_URL}${semPrefixo ? '' : '/admin'}${caminho}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 401 && !tentouRenovar) {
    if (await renovarSessao()) return chamar<T>(caminho, init, true, semPrefixo)
  }
  if (res.status === 204) return undefined as T

  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message
    throw new ErroDeApi(res.status, msg ?? 'Não foi possível concluir.')
  }
  return corpo as T
}

export const admin = {
  listar: (projectSlug: string) =>
    chamar<{
      project: { id: string; slug: string; name: string; photoApprovalRequired: boolean }
      contents: ItemAdmin[]
    }>(`/projects/${projectSlug}/contents`),

  /** Liga e desliga a aprovação prévia das fotos publicadas pelos usuários. */
  definirAprovacaoDeFoto: (projectSlug: string, exigir: boolean) =>
    chamar<{ slug: string; name: string; photoApprovalRequired: boolean }>(
      `/projects/${projectSlug}/photo-approval`,
      { method: 'POST', body: JSON.stringify({ exigir }) },
    ),

  detalhe: (projectSlug: string, contentSlug: string) =>
    chamar<DetalheAdmin>(`/projects/${projectSlug}/contents/${contentSlug}`),

  criarConteudo: (projectSlug: string, dados: { slug: string; title: string; subtitle?: string }) =>
    chamar(`/projects/${projectSlug}/contents`, { method: 'POST', body: JSON.stringify(dados) }),

  atualizarConteudo: (id: string, dados: Record<string, unknown>) =>
    chamar(`/contents/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),

  publicar: (id: string, publicar: boolean) =>
    chamar(`/contents/${id}/publish`, { method: 'POST', body: JSON.stringify({ publicar }) }),

  salvarBloco: (id: string, dados: Record<string, unknown>) =>
    chamar<BlocoAdmin>(`/blocks/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),

  criarBloco: (contentId: string, dados: { type: TipoBloco; label?: string }) =>
    chamar<BlocoAdmin>(`/contents/${contentId}/blocks`, {
      method: 'POST',
      body: JSON.stringify(dados),
    }),

  removerBloco: (id: string) => chamar<void>(`/blocks/${id}`, { method: 'DELETE' }),

  salvarMetadados: (id: string, dados: Record<string, unknown>) =>
    chamar(`/contents/${id}/metadata`, { method: 'PATCH', body: JSON.stringify(dados) }),

  /**
   * Upload. Sem Content-Type manual: o browser precisa definir o boundary do
   * multipart sozinho, e defini-lo à mão quebra o parse no servidor.
   */
  async enviarArquivo(arquivo: File): Promise<AssetAdmin> {
    const dados = new FormData()
    dados.append('file', arquivo)
    return chamar<AssetAdmin>('/upload', { method: 'POST', body: dados })
  },

  /** Define (ou remove) a capa da letra. */
  definirCapa: (contentId: string, assetId: string | null) =>
    chamar<{ id: string; coverUrl: string | null; shareCardUrl: string | null }>(
      `/contents/${contentId}/cover`,
      { method: 'PATCH', body: JSON.stringify({ assetId }) },
    ),

  /** Comentários recentes do projeto, para revisar e agir. */
  comentarios: (projectSlug: string) =>
    chamar<{ project: { name: string }; comments: ComentarioAdmin[] }>(
      `/projects/${projectSlug}/comments`,
    ),

  /** Bloqueia ou libera uma conta. */
  bloquearConta: (userId: string, bloquear: boolean, motivo?: string) =>
    chamar<{ id: string; displayName: string; status: string }>(`/users/${userId}/block`, {
      method: 'POST',
      body: JSON.stringify({ bloquear, motivo }),
    }),

  /** Apaga um comentário impróprio. Rota fora do prefixo do painel. */
  apagarComentario: (id: string) => chamarRaiz<void>(`/comments/${id}`, { method: 'DELETE' }),

  /** Fila de aprovação das fotos publicadas no My Post. */
  publicacoesPendentes: (projectSlug: string) =>
    chamar<{
      project: { id: string; name: string; photoApprovalRequired: boolean }
      posts: PublicacaoPendente[]
    }>(`/projects/${projectSlug}/posts/pending`),

  moderarPublicacao: (id: string, aprovar: boolean, nota?: string) =>
    chamar(`/posts/${id}/moderate`, { method: 'POST', body: JSON.stringify({ aprovar, nota }) }),

  urlQrSvg: (projectSlug: string, contentSlug: string) =>
    `${API_URL}/projects/${projectSlug}/contents/${contentSlug}/qr.svg`,
}
