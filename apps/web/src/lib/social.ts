'use client'

import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

export interface Comentario {
  id: string
  body: string
  createdAt: string
  parentId: string | null
  user: { id: string; displayName: string; avatarUrl: string | null }
}

export interface EstadoSocial {
  curtidas: number
  comentarios: number
  compartilhamentos: number
  curtidoPorMim: boolean
  lista: Comentario[]
}

export type CanalDeCompartilhamento =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'TIKTOK'
  | 'PRODUTO_VIVO'

async function chamar<T>(caminho: string, init: RequestInit = {}, jaRenovou = false): Promise<T> {
  const res = await fetch(`${API_URL}${caminho}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 401 && !jaRenovou && tokens.refresh) {
    if (await renovarSessao()) return chamar<T>(caminho, init, true)
  }
  if (res.status === 204) return undefined as T

  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message
    throw new ErroDeApi(res.status, msg ?? 'Não foi possível concluir.')
  }
  return corpo as T
}

export const social = {
  estado: (contentId: string) => chamar<EstadoSocial>(`/contents/${contentId}/social`),

  curtir: (contentId: string, projectId: string) =>
    chamar<{ curtido: boolean; total: number }>(`/contents/${contentId}/like`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    }),

  comentar: (contentId: string, projectId: string, body: string, parentId?: string) =>
    chamar<Comentario>(`/contents/${contentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ projectId, body, parentId }),
    }),

  removerComentario: (id: string) => chamar<void>(`/comments/${id}`, { method: 'DELETE' }),

  /**
   * Gera o link identificável de compartilhamento.
   *
   * O canal é registrado porque é o que permite responder "quantos vieram por
   * WhatsApp" separadamente de "quantos vieram do Instagram" — e o cliente
   * pediu essa separação explicitamente.
   */
  compartilhar: (contentId: string, projectId: string, canal: CanalDeCompartilhamento) =>
    chamar<{ url: string; code: string }>(`/contents/${contentId}/share`, {
      method: 'POST',
      body: JSON.stringify({ projectId, canal }),
    }),
}
