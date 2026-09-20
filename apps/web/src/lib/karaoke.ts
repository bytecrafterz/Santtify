'use client'

import type { Destaque, Frase } from '@pv/karaoke'
import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

export type KaraokeAcesso = 'TODOS' | 'CONTA' | 'DESLIGADO'
export type EstadoDaLetra = 'SEM_LETRA' | 'A_SINCRONIZAR' | 'SINCRONIZADA' | 'PUBLICADA'

export interface KaraokeParaTocar {
  projeto: { id: string; slug: string; nome: string }
  conteudo: { id: string; slug: string; titulo: string }
  faixa: {
    id: string
    titulo: string
    audio: string
    mimeType: string | null
    duracaoMs: number | null
    arte: string | null
  }
  frases: Frase[]
  destaques: Destaque[]
}

export interface PalavraDaLista {
  id: string
  exibicao: string
  palavra: string
  nivel: number
}

export interface PainelDoKaraoke {
  acesso: KaraokeAcesso
  palavras: PalavraDaLista[]
  faixas: Array<{
    id: string
    titulo: string
    categoria: string | null
    conteudoSlug: string
    conteudoTitulo: string
    estado: EstadoDaLetra
    frases: number
    sincronizadas: number
  }>
}

/** O estado de uma faixa na fila de quem ouve as músicas. */
export type EstadoDaTranscricao = 'PENDENTE' | 'A_OUVIR' | 'PRONTA' | 'FALHOU'

export interface FaixaAOuvir {
  id: string
  nome: string
  conteudo: string
  conteudoSlug: string
  duracaoMs: number | null
  estado: EstadoDaTranscricao | null
  progresso: number
  erro: string | null
  temLetra: boolean
  origem: 'MANUAL' | 'AUTOMATICA' | null
  frases: number
}

export interface AndamentoDasLetras {
  faixas: FaixaAOuvir[]
  resumo: {
    total: number
    prontas: number
    naFila: number
    falhadas: number
    aOuvirAgora: number
    percentagem: number
  }
}

export interface LetraDoCartao {
  faixa: {
    id: string
    titulo: string
    audio: string | null
    duracaoMs: number | null
    arte: string | null
    conteudoSlug: string
    conteudoTitulo: string
    projetoSlug: string
  }
  letra: { texto: string; frases: Frase[]; publicada: boolean; atualizadoEm: string | null }
  destaques: Destaque[]
}

/** Sem conta, num projeto que a pede: o ecrã convida a entrar. */
export class PrecisaDeConta extends Error {}

async function chamar<T>(caminho: string, init: RequestInit = {}, tentouRenovar = false): Promise<T> {
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
  /*
    O 403 DO KARAOKÊ TAMBÉM TENTA RENOVAR.

    O token de acesso vive só em memória, e a página do karaokê abre-se muitas
    vezes de fresco, por uma ligação. Nesse momento quem tem conta ainda não tem
    token, e a API responde como a um visitante. Renovar primeiro evita mandar
    entrar quem já está dentro.
  */
  const semSessao = res.status === 401 || (res.status === 403 && corpo?.precisaDeConta)
  if (semSessao && !tentouRenovar && (await renovarSessao())) {
    return chamar<T>(caminho, init, true)
  }
  if (res.status === 403 && corpo?.precisaDeConta) throw new PrecisaDeConta(corpo.message)
  if (!res.ok) {
    const msg = Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message
    throw new ErroDeApi(res.status, msg ?? 'Não foi possível concluir.')
  }
  return corpo as T
}

export const karaoke = {
  paraTocar: (projectSlug: string, blocoId: string) =>
    chamar<KaraokeParaTocar>(`/projects/${projectSlug}/karaoke/${blocoId}`),

  painel: (projectSlug: string) => chamar<PainelDoKaraoke>(`/admin/projects/${projectSlug}/karaoke`),
  definirAcesso: (projectSlug: string, acesso: KaraokeAcesso) =>
    chamar<PainelDoKaraoke>(`/admin/projects/${projectSlug}/karaoke`, {
      method: 'PATCH',
      body: JSON.stringify({ acesso }),
    }),
  definirPalavra: (projectSlug: string, palavra: string, nivel: number) =>
    chamar<PainelDoKaraoke>(`/admin/projects/${projectSlug}/karaoke/palavras`, {
      method: 'PUT',
      body: JSON.stringify({ palavra, nivel }),
    }),
  apagarPalavra: (id: string) =>
    chamar<PainelDoKaraoke>(`/admin/karaoke/palavras/${id}`, { method: 'DELETE' }),

  /* A oficina: as músicas a serem ouvidas e a percentagem que ele vê a subir. */
  andamento: (projectSlug: string) =>
    chamar<AndamentoDasLetras>(`/admin/projects/${projectSlug}/transcricoes`),
  ouvirTudo: (projectSlug: string, refazer = false) =>
    chamar<{ postas: number; total: number }>(`/admin/projects/${projectSlug}/transcricoes`, {
      method: 'POST',
      body: JSON.stringify({ refazer }),
    }),
  ouvirUma: (blocoId: string) =>
    chamar<{ id?: string; estado?: string; ignorado?: boolean; motivo?: string }>(
      `/admin/cards/${blocoId}/transcricao`,
      { method: 'POST' },
    ),

  letra: (blocoId: string) => chamar<LetraDoCartao>(`/admin/cards/${blocoId}/karaoke`),
  gravarLetra: (
    blocoId: string,
    dados: { texto?: string; frases?: Frase[]; publicada?: boolean },
  ) =>
    chamar<LetraDoCartao>(`/admin/cards/${blocoId}/karaoke`, {
      method: 'PUT',
      body: JSON.stringify(dados),
    }),
}
