'use client'

import { useEffect, useState } from 'react'
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
  ultima: { texto: string; minha: boolean; em: string; vista: boolean } | null
  naoLidas: number
  ultimaEm: string
  /** Só o administrador designado (o Kanari) pode tirar a conversa da lista. */
  podeApagar: boolean
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

/**
 * O último número de por ler que se soube, e de quem — para o sinal da barra
 * de baixo (ver `usePorLer`). `null` quando deixou de valer.
 */
let porLerGuardado: number | null = null
let porLerDe: string | null = null

export const mensagens = {
  listar: async () => {
    const lista = await comRenovacao<ResumoDaConversa[]>('/me/conversas')
    // A lista traz o número de cada conversa: o total fica certo.
    porLerGuardado = lista.reduce((t, c) => t + c.naoLidas, 0)
    return lista
  },
  naoLidas: async () => {
    const r = await comRenovacao<{ naoLidas: number; conversas: number }>('/me/conversas/nao-lidas')
    porLerGuardado = r.naoLidas
    return r
  },
  abrir: (comUserId: string) =>
    comRenovacao<{ id: string }>('/me/conversas', {
      method: 'POST',
      body: JSON.stringify({ comUserId }),
    }),
  ver: async (id: string) => {
    const r = await comRenovacao<{
      id: string
      outra: PessoaDaConversa
      /** Só o administrador designado (o Kanari) pode apagar mensagens. */
      podeApagar: boolean
      mensagens: MensagemPrivada[]
    }>(`/me/conversas/${id}`)
    // Abrir a conversa lê-a: o número guardado deixa de valer.
    porLerGuardado = null
    return r
  },
  apagarMensagens: (id: string, ids: string[]) =>
    comRenovacao<{ apagadas: number }>(`/me/conversas/${id}/mensagens/apagar`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  apagarHistorico: (id: string) =>
    comRenovacao<{ apagadas: number }>(`/me/conversas/${id}/mensagens`, { method: 'DELETE' }),
  /** A conversa inteira, para os dois: sai da lista com mensagens e arquivos. */
  apagarConversa: (id: string) =>
    comRenovacao<{ apagada: boolean }>(`/me/conversas/${id}`, { method: 'DELETE' }),
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

/* ── O sinal na barra de baixo (28/09) ───────────────────────────────── */

/** De quanto em quanto tempo a barra pergunta, enquanto a página está à vista. */
const INTERVALO_DO_SINAL = 30000

/**
 * QUANTAS POR LER, PARA O SINAL EM "MEU PERFIL".
 *
 * "if there is unread message, make the tag appear over the profile of
 * bottom tool bar" — 28/09. As mensagens moram no perfil; sem o sinal, só se
 * sabia delas indo lá.
 *
 * Pergunta ao abrir a página, de 30 em 30 segundos enquanto ela está à vista,
 * e ao voltar a ela. Sem sessão não pergunta nada. Começa pelo último número
 * que se soube: a barra é desenhada de novo em cada página, e a partir do
 * zero o sinal piscava a cada toque nela.
 */
export function usePorLer(userId: string | null): number {
  const [n, definirN] = useState(() => (userId && userId === porLerDe ? (porLerGuardado ?? 0) : 0))

  useEffect(() => {
    if (porLerDe !== userId) {
      // Outra pessoa, ou ninguém: o número guardado não é desta.
      porLerGuardado = null
      porLerDe = userId
      definirN(0)
    }
    if (!userId) return
    let vivo = true
    const perguntar = () => {
      if (document.visibilityState !== 'visible') return
      mensagens
        .naoLidas()
        .then((r) => {
          if (vivo) definirN(r.naoLidas)
        })
        .catch(() => {})
    }
    perguntar()
    const t = setInterval(perguntar, INTERVALO_DO_SINAL)
    document.addEventListener('visibilitychange', perguntar)
    return () => {
      vivo = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', perguntar)
    }
  }, [userId])

  return userId ? n : 0
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
