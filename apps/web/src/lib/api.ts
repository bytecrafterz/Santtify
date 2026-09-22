/** Cliente da API. Um lugar só para saber onde a API mora. */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'

export interface Projeto {
  id: string
  slug: string
  name: string
  description: string | null
  branding: Record<string, unknown>
  /** Link externo de compra, quando o dono já tiver cadastrado. */
  checkoutUrl?: string | null
  /** Como este projeto numera as casas da grade: A–Z ou 1..N. */
  sequencia?: 'LETRAS' | 'NUMEROS'
  /** Quantas casas tem a grade deste projeto. Nos alfabetos, 26. */
  blocos?: number
  /**
   * Como se chama UMA casa deste projeto: "Letra", "Dia", "Atributo".
   *
   * O ecrã junta-lhe o número ou a letra ("Dia 1", "Letra A") e usa-a também no
   * plural simples, com um "s". Ver `Project.unidade` no schema.
   */
  unidade?: string
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
  /** A casa do cartão dentro da letra: 1 a 4. Nulo nas cópias. */
  slot: number | null
  /** CARTAO ou IMPRESSAO. */
  papel: 'CARTAO' | 'IMPRESSAO'
  /** Nome interno do quadrado. NÃO aparece na página — regra dele, 23/08. */
  label: string | null
  /** O título grande que a pessoa lê. */
  titulo: string | null
  text: string | null
  url: string | null
  /** Hotmart, Kiwify ou outra: alimenta o botão de upgrade. */
  linkUpgrade: string | null
  /** A que grupo esta faixa pertence, para o filtro do tocador. */
  categoria: string | null
  categoriaNome: string | null
  asset: Asset | null
  /** Arte própria desta faixa, quando o dono enviou uma. */
  arte: string | null
  /** As medidas da arte, para reservar o espaço dela antes de chegar. */
  arteLargura?: number | null
  arteAltura?: number | null
  meta: Record<string, unknown>
  /** Esta faixa tem o Modo Karaokê publicado. */
  karaoke?: boolean
}

export interface Conteudo {
  id: string
  slug: string
  /** "A".."Z" — a identidade real da letra. O slug pode estar trocado. */
  letra: string | null
  title: string
  subtitle: string | null
  summary: string | null
  coverUrl: string | null
  shareCardUrl: string | null
  /** PDF gratuito desta letra, quando houver. */
  freeFileUrl: string | null
  freeFileName: string | null
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
    /** A seguinte traz a arte e a casa, para se anunciar como na página inicial. */
    proximo: {
      slug: string
      title: string
      coverUrl?: string | null
      letra?: string | null
      ordinal?: number | null
    } | null
  }
}

export interface ItemIndice {
  id: string
  slug: string
  title: string
  subtitle: string | null
  coverUrl: string | null
  position: number
  /** A letra a que pertence: "A".."Z", ou nulo quando não é uma letra. */
  letra: string | null
  /** O número do bloco, nos projetos que não são alfabetos. Ver `sequencia`. */
  ordinal?: number | null
  /** Falso enquanto a letra ainda não tem conteúdo: aparece trancada na grade. */
  publicado: boolean
  stats: { views: number; likes: number; comments: number; shares: number } | null
}

/** O perfil que hospeda a experiência: o rosto do projeto. */
export interface PerfilAnfitriao {
  id: string
  displayName: string
  /** O @identificador. Nulo nas contas criadas antes de 01/09. */
  username?: string | null
  avatarUrl: string | null
  bio: string | null
  guardianName: string | null
  createdAt: string
}

export interface ProgressoDasLetras {
  liberadas: number
  total: number
}

export interface Faixa {
  /** Id do BLOCO, não da letra: uma letra tem várias faixas. */
  id: string
  contentId: string
  slug: string
  title: string
  subtitle: string | null
  coverUrl: string | null
  /** As medidas reais da arte, para o tocador guardar o espaço certo. */
  arteLargura: number | null
  arteAltura: number | null
  /** Como esta faixa se chama: "Explicação e música". */
  rotulo: string | null
  /** O que agrupa faixas entre letras: "musica", "explicacao". */
  categoria: string | null
  categoriaNome: string | null
  url: string
  mimeType: string | null
  durationMs: number | null
}

export interface CategoriaDeAudio {
  slug: string
  nome: string
  total: number
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
  indice: (slug: string) =>
    buscar<{
      project: Projeto
      anfitriao: PerfilAnfitriao | null
      contents: ItemIndice[]
      progresso: ProgressoDasLetras
      comunidade: { perfis: number; impressoes: number }
    }>(`/projects/${slug}/contents`),
  categorias: (slug: string) =>
    buscar<{ categorias: Array<{ id: string; slug: string; name: string }> }>(
      `/projects/${slug}/categories`,
    ),
  playlist: (slug: string) =>
    buscar<{ project: Projeto; categorias: CategoriaDeAudio[]; faixas: Faixa[] }>(
      `/projects/${slug}/playlist`,
    ),
  conteudo: (projeto: string, conteudo: string) =>
    buscar<PaginaConteudo>(`/projects/${projeto}/contents/${conteudo}`),
  qrSvgUrl: (projeto: string, conteudo: string) =>
    `${API_URL}/projects/${projeto}/contents/${conteudo}/qr.svg`,
  /**
   * O cartão sozinho, numa folha A4, feito no servidor.
   *
   * Não é o `window.print()` do navegador: aquilo imprime a PÁGINA, e foi por
   * isso que lhe saíram o cabeçalho, os comentários e o cartão cortado. Isto é
   * um ficheiro que só tem o cartão, e por isso imprime sempre igual, em
   * qualquer telemóvel e em qualquer impressora.
   */
  /** A folha em resolução de papel, usada só quando se manda imprimir. */
  cartaoImagemUrl: (projeto: string, conteudo: string) =>
    `${API_URL}/projects/${projeto}/contents/${conteudo}/cartao.jpg`,
  cartaoPdfUrl: (projeto: string, conteudo: string, baixar = false) =>
    `${API_URL}/projects/${projeto}/contents/${conteudo}/cartao.pdf${baixar ? '?baixar=1' : ''}`,
  url: API_URL,
}
