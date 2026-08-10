/** Cliente da API. Um lugar só para saber onde a API mora. */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'

export interface Projeto {
  id: string
  slug: string
  name: string
  description: string | null
  branding: Record<string, unknown>
}

export type TipoBloco = 'TEXT' | 'RICH_TEXT' | 'AUDIO' | 'VIDEO' | 'IMAGE' | 'EMBED' | 'LINK'

export interface Asset {
  id: string
  kind: string
  url: string
  mimeType: string | null
  durationMs: number | null
  title: string | null
  altText: string | null
}

export interface Bloco {
  id: string
  type: TipoBloco
  label: string | null
  text: string | null
  url: string | null
  asset: Asset | null
  meta: Record<string, unknown>
}

export interface Conteudo {
  id: string
  slug: string
  title: string
  subtitle: string | null
  summary: string | null
  coverUrl: string | null
  position: number
  blocks: Bloco[]
  stats: { views: number; likes: number; comments: number; shares: number }
  qrCode: string | null
  qrUrl: string | null
}

export interface PaginaConteudo {
  project: Projeto
  content: Conteudo
  navegacao: {
    anterior: { slug: string; title: string } | null
    proximo: { slug: string; title: string } | null
  }
}

export interface ItemIndice {
  id: string
  slug: string
  title: string
  subtitle: string | null
  coverUrl: string | null
  position: number
  stats: { views: number; likes: number; comments: number; shares: number } | null
}

/**
 * Tempo máximo esperando a API antes de desistir e renderizar o estado vazio.
 *
 * Sem isto, API fora do ar derruba a página de um jeito pior do que um erro:
 * ela simplesmente PENDURA. O visitante fica olhando uma tela em branco até o
 * navegador desistir sozinho, e o servidor segura a conexão o tempo todo.
 *
 * Descoberto testando a build de produção contra um domínio inexistente: as
 * páginas que buscam dados no servidor não respondiam, enquanto as que não
 * buscam abriam normalmente. O `catch` cobria erro, mas lentidão não é erro.
 */
const LIMITE_MS = 5000

async function buscar<T>(caminho: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${caminho}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(LIMITE_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (erro) {
    // A API fora do ar, ou lenta demais, não pode derrubar a renderização: a
    // página mostra o estado vazio e o motivo fica no log do servidor.
    const motivo = (erro as Error)?.name === 'TimeoutError' ? 'tempo esgotado' : 'falha'
    console.error(`API ${motivo} ao buscar ${caminho}`)
    return null
  }
}

export const api = {
  projeto: (slug: string) => buscar<Projeto>(`/projects/${slug}`),
  indice: (slug: string) => buscar<{ project: Projeto; contents: ItemIndice[] }>(`/projects/${slug}/contents`),
  conteudo: (projeto: string, conteudo: string) =>
    buscar<PaginaConteudo>(`/projects/${projeto}/contents/${conteudo}`),
  qrSvgUrl: (projeto: string, conteudo: string) =>
    `${API_URL}/projects/${projeto}/contents/${conteudo}/qr.svg`,
  url: API_URL,
}
