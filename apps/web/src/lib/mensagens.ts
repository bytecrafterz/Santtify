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

export interface AnexoDaMensagem {
  tipo: 'IMAGEM' | 'AUDIO' | 'ARQUIVO'
  nome: string
  mime: string
  bytes: number
  duracaoSeg: number | null
}

export interface MensagemPrivada {
  id: string
  texto: string
  minha: boolean
  em: string
  vista: boolean
  anexo: AnexoDaMensagem | null
}

/** Mesma mecânica de `cartoes.ts`: token, renovação uma vez, erro tipado. */
async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${caminho}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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
    comRenovacao<{
      id: string
      outra: PessoaDaConversa
      /** Só quem abriu a conversa pode apagar mensagens nela. */
      podeApagar: boolean
      mensagens: MensagemPrivada[]
    }>(`/me/conversas/${id}`),
  apagarMensagem: (id: string, mensagemId: string) =>
    comRenovacao<{ apagada: string }>(`/me/conversas/${id}/mensagens/${mensagemId}`, {
      method: 'DELETE',
    }),
  apagarHistorico: (id: string) =>
    comRenovacao<{ apagadas: number }>(`/me/conversas/${id}/mensagens`, { method: 'DELETE' }),
  enviar: (id: string, texto: string) =>
    comRenovacao<MensagemPrivada>(`/me/conversas/${id}/mensagens`, {
      method: 'POST',
      body: JSON.stringify({ texto }),
    }),

  /** Um ficheiro, ou uma gravação (`voz`), com texto opcional. */
  enviarAnexo: (
    id: string,
    arquivo: Blob,
    nome: string,
    opcoes: { texto?: string; voz?: boolean; duracaoSeg?: number } = {},
  ) => {
    const corpo = new FormData()
    corpo.append('arquivo', arquivo, nome)
    if (opcoes.texto) corpo.append('texto', opcoes.texto)
    if (opcoes.voz) corpo.append('voz', 'true')
    if (opcoes.duracaoSeg != null) corpo.append('duracaoSeg', String(opcoes.duracaoSeg))
    // Sem Content-Type: o navegador põe o do multipart, com a fronteira.
    return comRenovacao<MensagemPrivada>(`/me/conversas/${id}/anexos`, {
      method: 'POST',
      body: corpo,
      headers: {},
    })
  },

  /**
   * O ficheiro, como Blob.
   *
   * Não pode ser um `<img src>` directo: o token vive só em memória e um
   * endereço solto não o leva. Descarrega-se com o token, e o ecrã mostra-o por
   * um endereço `blob:` local.
   */
  baixarAnexo: async (id: string, mensagemId: string): Promise<Blob> => {
    const pedir = () =>
      fetch(`${API_URL}/me/conversas/${id}/anexos/${mensagemId}`, {
        credentials: 'include',
        headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
      })
    let res = await pedir()
    if (res.status === 401 && (await renovarSessao())) res = await pedir()
    if (!res.ok) throw new ErroDeApi(res.status, 'Não foi possível abrir o arquivo.')
    return res.blob()
  },
}

/** "2,4 MB", "830 KB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** "0:07", "2:15". */
export function duracaoLegivel(seg: number): string {
  const s = Math.max(0, Math.round(seg))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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
