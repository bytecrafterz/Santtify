/**
 * O carrossel, do lado do servidor.
 *
 * FICHEIRO PRÓPRIO, SEM `'use client'`, e a separação é obrigatória e não
 * arrumação. O `lib/cartoes.ts` começa com `'use client'` porque o editor
 * precisa de estado e de token no navegador; tudo o que lá vive fica marcado
 * como código de cliente, e um componente de servidor que chame uma dessas
 * funções rebenta em tempo de execução — não no build.
 *
 * O carrossel é o contrário disso: uma lista que se lê e se desenha, sem
 * estado nenhum. Fica aqui, corre no servidor, e não manda JavaScript nenhum
 * para o telemóvel.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

export interface ProjetoNoCarrossel {
  slug: string
  nome: string
  tagline: string | null
  capa: string | null
  /** As medidas da imagem, para reservar a altura antes de ela chegar. */
  capaLargura?: number | null
  capaAltura?: number | null
  destaque: 'ESQUERDA' | 'DIREITA' | null
  numeros: { views: number; likes: number; comments: number; shares: number }
}

export async function projetosDoCarrossel(): Promise<ProjetoNoCarrossel[]> {
  try {
    const res = await fetch(`${API_URL}/carrossel/projetos`, {
      // Os números mudam com o uso, mas não a cada visita. Trinta segundos é o
      // mesmo fôlego que o resto do site usa em `lib/api.ts`.
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    return (await res.json()) as ProjetoNoCarrossel[]
  } catch {
    // O carrossel é um extra por baixo do perfil. Se a API não responder, some
    // sem levar o perfil atrás — que é o que o cliente pediu para nunca mexer.
    return []
  }
}
