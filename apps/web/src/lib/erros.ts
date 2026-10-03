'use client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

/**
 * Manda um erro do aparelho para o registo da API (03/10).
 *
 * Em 03/10 o iPhone do cliente mostrou "Application error" ao escolher a foto
 * do cartão, e não havia como saber porquê: o erro morria no telemóvel. Isto
 * leva-o ao servidor — mensagem, pilha, página —, e nada da pessoa.
 *
 * Os erros de rede não interessam (a ligação caiu, o pedido foi cortado por uma
 * troca de página): não são defeitos do código e encheriam o registo.
 */
const RUIDO = /Load failed|Failed to fetch|NetworkError|access control checks|ResizeObserver loop|AbortError|The operation was aborted/i
const jaMandados = new Set<string>()

export function relatarErro(erro: {
  mensagem: string
  pilha?: string
  componentes?: string
  tipo?: 'render' | 'janela' | 'promessa' | 'editor'
  digest?: string
}) {
  if (typeof window === 'undefined') return
  if (!erro.mensagem || RUIDO.test(erro.mensagem)) return
  // O mesmo erro uma vez por visita: um ciclo de erros não é cem erros.
  const chave = `${erro.tipo}:${erro.mensagem}`
  if (jaMandados.has(chave) || jaMandados.size > 20) return
  jaMandados.add(chave)
  try {
    void fetch(`${API_URL}/erros-do-cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        mensagem: erro.mensagem.slice(0, 500),
        pilha: erro.pilha?.slice(0, 4000),
        componentes: erro.componentes?.slice(0, 2000),
        url: (location.pathname + location.search).slice(0, 300),
        tipo: erro.tipo ?? 'render',
        digest: erro.digest?.slice(0, 80),
      }),
    }).catch(() => {})
  } catch {
    /* Relatar um erro nunca pode causar outro. */
  }
}
