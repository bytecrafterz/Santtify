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
  // Com arquivo, o próprio navegador escreve o Content-Type com a fronteira
  // que separa os campos. Escrever à mão aqui apagaria essa fronteira e o
  // servidor receberia um envio que não consegue ler.
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

export interface PublicacaoCriada {
  aguardandoAprovacao: boolean
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED'
  imageAsset: { url: string; title: string | null } | null
  id: string
  body: string | null
  createdAt: string
  content: { slug: string; title: string; subtitle: string | null; project: { slug: string } }
}

export const social = {
  /**
   * "My Post": publica no perfil.
   *
   * A foto vai na mesma requisição que a legenda, e não em duas etapas: se a
   * segunda falhasse, o arquivo ficaria no servidor sem publicação nenhuma
   * apontando para ele.
   */
  publicar: (contentId: string, projectId: string, body?: string, foto?: File) => {
    if (!foto) {
      return chamar<PublicacaoCriada>(`/contents/${contentId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ projectId, body }),
      })
    }
    const form = new FormData()
    form.append('projectId', projectId)
    if (body) form.append('body', body)
    form.append('foto', foto)
    return chamar<PublicacaoCriada>(`/contents/${contentId}/publish`, {
      method: 'POST',
      body: form,
    })
  },

  removerPublicacao: (id: string) => chamar<void>(`/posts/${id}`, { method: 'DELETE' }),

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
