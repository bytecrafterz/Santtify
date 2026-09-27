'use client'

import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

export interface PessoaDaConversa {
  id: string
  displayName: string
  username: string | null
  avatarUrl: string | null
}

export interface ResumoDaConversa {
  id: string
  outra: PessoaDaConversa
  ultima: { texto: string; minha: boolean; em: string } | null
  naoLidas: number
  ultimaEm: string
}

export interface MensagemPrivada {
  id: string
  texto: string
  minha: boolean
  em: string
  vista: boolean
}

/** Mesma mecânica de `cartoes.ts`: token, renovação uma vez, erro tipado. */
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

export const mensagens = {
  listar: () => comRenovacao<ResumoDaConversa[]>('/me/conversas'),
  naoLidas: () => comRenovacao<{ naoLidas: number }>('/me/conversas/nao-lidas'),
  abrir: (comUserId: string) =>
    comRenovacao<{ id: string }>('/me/conversas', {
      method: 'POST',
      body: JSON.stringify({ comUserId }),
    }),
  ver: (id: string) =>
    comRenovacao<{ id: string; outra: PessoaDaConversa; mensagens: MensagemPrivada[] }>(
      `/me/conversas/${id}`,
    ),
  enviar: (id: string, texto: string) =>
    comRenovacao<MensagemPrivada>(`/me/conversas/${id}/mensagens`, {
      method: 'POST',
      body: JSON.stringify({ texto }),
    }),
}

/** "14:32" hoje, "ontem 14:32", ou "25/09 14:32". */
export function quando(iso: string): string {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return hora
  if (d.toDateString() === ontem.toDateString()) return `ontem ${hora}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`
}
