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

async function buscar<T>(caminho: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${caminho}`, { next: { revalidate } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    // A API fora do ar não pode derrubar a renderização: a página mostra o
    // estado vazio e o erro fica visível no log do servidor.
    console.error(`Falha ao buscar ${caminho}`)
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
