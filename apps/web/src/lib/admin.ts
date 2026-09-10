'use client'

import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'

export type StatusConteudo = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type TipoBloco = 'TEXT' | 'RICH_TEXT' | 'AUDIO' | 'VIDEO' | 'IMAGE' | 'EMBED' | 'LINK'

export interface ItemAdmin {
  id: string
  slug: string
  title: string
  subtitle: string | null
  status: StatusConteudo
  position: number
  publishedAt: string | null
  updatedAt: string
  stats: { views: number; likes: number; comments: number; shares: number } | null
  qrCode: string | null
  blocosPreenchidos: number
  blocosTotal: number
}

export interface AssetAdmin {
  shareCardUrl?: string | null
  width?: number | null
  height?: number | null
  id: string
  kind: string
  url: string
  mimeType: string | null
  title: string | null
  sizeBytes: number | null
}

export interface BlocoAdmin {
  categoryId?: string | null
  imageAssetId?: string | null
  imageAsset?: { url: string } | null
  id: string
  type: TipoBloco
  label: string | null
  text: string | null
  url: string | null
  position: number
  assetId: string | null
  asset: AssetAdmin | null
}

export interface DetalheAdmin {
  project: { id: string; slug: string; name: string }
  content: {
    id: string
    slug: string
    title: string
    subtitle: string | null
    summary: string | null
    status: StatusConteudo
    position: number
    coverUrl: string | null
    shareCardUrl: string | null
    freeFileUrl: string | null
    freeFileName: string | null
    blocks: BlocoAdmin[]
    metadata: Record<string, unknown> | null
    qrCode: string | null
    qrUrl: string | null
  }
}

export interface CategoriaAdmin {
  id: string
  name: string
  slug: string
  position: number
  audios?: number
}

export interface ComentarioAdmin {
  id: string
  body: string
  status: 'PUBLISHED' | 'HIDDEN' | 'DELETED'
  createdAt: string
  user: {
    id: string
    displayName: string
    email: string
    status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  }
  /** Nulo quando o comentário é de um perfil e não de uma letra. */
  content: { slug: string; title: string } | null
  /** Presente quando o comentário é de uma faixa e não da letra inteira. */
  block: { id: string; label: string | null; category: { name: string } | null } | null
}

export interface PublicacaoPendente {
  id: string
  body: string | null
  createdAt: string
  imageAsset: { url: string; title: string | null } | null
  user: { id: string; displayName: string; email: string }
  content: { slug: string; title: string; subtitle: string | null; project: { slug: string } }
}

/** Igual ao `chamar`, mas sem o prefixo `/admin` — a remoção de comentário é a
 *  mesma rota que o autor usa, e o servidor decide pelo papel de quem chama. */
function chamarRaiz<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  return chamar<T>(caminho, init, false, true)
}

async function chamar<T>(
  caminho: string,
  init: RequestInit = {},
  tentouRenovar = false,
  semPrefixo = false,
): Promise<T> {
  const res = await fetch(`${API_URL}${semPrefixo ? '' : '/admin'}${caminho}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 401 && !tentouRenovar) {
    if (await renovarSessao()) return chamar<T>(caminho, init, true, semPrefixo)
  }
  if (res.status === 204) {
    esquecerPaginasGuardadas(init.method)
    return undefined as T
  }

  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message
    throw new ErroDeApi(res.status, msg ?? 'Não foi possível concluir.')
  }
  esquecerPaginasGuardadas(init.method)
  return corpo as T
}

/**
 * Depois de mudar alguma coisa no painel, manda o site esquecer o que tem
 * guardado.
 *
 * AQUI, E NÃO EM CADA ECRÃ. Isto estava escrito à mão em dois sítios — na
 * edição do perfil e no editor do Produto Vivo — e por isso valia só para
 * esses dois. Em 03/09 ele publicou uma música com imagem e ela só apareceu
 * depois de recarregar: guardar um cartão de uma letra nunca avisou ninguém.
 *
 * Passar por aqui significa que qualquer coisa que o painel mude — gravar um
 * cartão, pôr no ar, tirar do ar, trocar a foto, o áudio, duplicar, reordenar —
 * apaga o que estava guardado, sem eu ter de me lembrar de cada botão.
 *
 * Só nas escritas: um GET não muda nada e não tem o que esquecer.
 */
function esquecerPaginasGuardadas(metodo?: string) {
  if (!metodo || metodo.toUpperCase() === 'GET') return
  if (typeof window === 'undefined') return
  const projeto = window.location.pathname.split('/').filter(Boolean)[0]
  if (!projeto) return
  /* Não bloqueia nem estraga nada se falhar: o pior que acontece é a página
     ficar guardada os 30 segundos que já ficava antes. */
  void fetch('/revalidar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectSlug: projeto }),
  }).catch(() => {})
}

export interface DenunciaAdmin {
  id: string
  targetType: 'CONTENT' | 'BLOCK' | 'COMMENT' | 'POST' | 'PROFILE'
  targetId: string
  reason: string
  note: string | null
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED'
  createdAt: string
  reporter: { id: string; displayName: string } | null
}

/** Um cartão do painel: a peça inteira, com o que lhe falta à vista. */
export interface CartaoAdmin {
  id: string
  /** A casa dentro da letra: 1 a 4. Nulo nas cópias. */
  slot: number | null
  papel: 'CARTAO' | 'IMPRESSAO'
  estado: 'RASCUNHO' | 'PUBLICADO'
  /** Nome da casa — só para o painel, nunca para a página. */
  nomeInterno: string | null
  titulo: string | null
  /** Opcional, só no Produto Vivo. Ver a nota em `salvarCartao`. */
  subtitulo?: string | null
  /** Tirado do ar à mão: existe no painel e não aparece na página pública. */
  foraDoAr?: boolean
  descricao: string | null
  linkUpgrade: string | null
  audio: { id: string; url: string; title: string | null; durationMs: number | null } | null
  imagem: string | null
  /** A categoria, que alimenta o filtro do tocador na página. */
  categoriaId?: string | null
  categoriaNome?: string | null
  /** A folha A4, só no cartão de impressão. */
  folhaA4?: string | null
}

/** Um vagão da composição: a letra e os seus cartões. */
export interface VagaoAdmin {
  letra: string
  contentId: string | null
  slug: string | null
  title: string
  publicado: boolean
  coverUrl: string | null
  cartoes: CartaoAdmin[]
  /** Quantas das quatro casas de origem estão no ar. */
  prontos: number
  /** Publicações que ele criou além das quatro casas e que têm alguma coisa. */
  extras: number
  /** Tudo o que está no ar nesta letra, casas e criações dele. */
  noAr: number
}

/** Um pedido de reposição de senha, tal como o responsável o vê. */
export interface PedidoDeReposicao {
  id: string
  emailPedido: string
  createdAt: string
  atendidoEm: string | null
  usedAt: string | null
  expiresAt: string | null
  user: { id: string; displayName: string } | null
}

export const admin = {
  // ── Publicação numa tela só (20/08) ───────────────────────────────
  //
  // Estes três embrulham a sequência que o painel antigo obrigava a fazer à
  // mão: enviar o ficheiro, criar o bloco, ligar um ao outro. Quem publica não
  // tem de saber que existem blocos.

  async definirCapaComArquivo(contentId: string, arquivo: File) {
    const asset = await this.enviarArquivo(arquivo)
    return this.definirCapa(contentId, asset.id)
  },

  async criarBlocoDeTexto(contentId: string, texto: string) {
    const bloco = await this.criarBloco(contentId, { type: 'RICH_TEXT', label: 'Texto' })
    return this.salvarBloco(bloco.id, { text: texto })
  },

  async criarBlocoDeAudio(contentId: string, arquivo: File) {
    const asset = await this.enviarArquivo(arquivo)
    const bloco = await this.criarBloco(contentId, { type: 'AUDIO', label: 'Áudio' })
    return this.salvarBloco(bloco.id, { assetId: asset.id })
  },

  /**
   * Material grátis num só passo: o servidor aceita PDF ou fotografia e
   * converte a fotografia em PDF pelo caminho.
   */
  enviarMaterialGratis: (contentId: string, arquivo: File) => {
    const form = new FormData()
    form.append('file', arquivo)
    return chamar<unknown>(`/admin/contents/${contentId}/free-file/upload`, {
      method: 'POST',
      body: form,
    })
  },

  denuncias: (projectSlug: string) =>
    chamar<{ reports: DenunciaAdmin[] }>(`/admin/projects/${projectSlug}/reports`),

  decidirDenuncia: (id: string, status: 'REVIEWED' | 'DISMISSED') =>
    chamar<{ id: string; status: string }>(`/admin/reports/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  listar: (projectSlug: string) =>
    chamar<{
      project: {
        id: string
        slug: string
        name: string
        photoApprovalRequired: boolean
        checkoutUrl?: string | null
      }
      contents: ItemAdmin[]
    }>(`/projects/${projectSlug}/contents`),

  /** Liga e desliga a aprovação prévia das fotos publicadas pelos usuários. */
  definirAprovacaoDeFoto: (projectSlug: string, exigir: boolean) =>
    chamar<{ slug: string; name: string; photoApprovalRequired: boolean }>(
      `/projects/${projectSlug}/photo-approval`,
      { method: 'POST', body: JSON.stringify({ exigir }) },
    ),

  detalhe: (projectSlug: string, contentSlug: string) =>
    chamar<DetalheAdmin>(`/projects/${projectSlug}/contents/${contentSlug}`),

  criarConteudo: (
    projectSlug: string,
    dados: { slug: string; title: string; subtitle?: string; position?: number },
  ) =>
    chamar<{ id: string; slug: string }>(`/projects/${projectSlug}/contents`, {
      method: 'POST',
      body: JSON.stringify(dados),
    }),

  atualizarConteudo: (id: string, dados: Record<string, unknown>) =>
    chamar(`/contents/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),

  publicar: (id: string, publicar: boolean) =>
    chamar(`/contents/${id}/publish`, { method: 'POST', body: JSON.stringify({ publicar }) }),

  salvarBloco: (id: string, dados: Record<string, unknown>) =>
    chamar<BlocoAdmin>(`/blocks/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),

  criarBloco: (contentId: string, dados: { type: TipoBloco; label?: string }) =>
    chamar<BlocoAdmin>(`/contents/${contentId}/blocks`, {
      method: 'POST',
      body: JSON.stringify(dados),
    }),

  removerBloco: (id: string) => chamar<void>(`/blocks/${id}`, { method: 'DELETE' }),

  salvarMetadados: (id: string, dados: Record<string, unknown>) =>
    chamar(`/contents/${id}/metadata`, { method: 'PATCH', body: JSON.stringify(dados) }),

  /**
   * Upload. Sem Content-Type manual: o browser precisa definir o boundary do
   * multipart sozinho, e defini-lo à mão quebra o parse no servidor.
   */
  async enviarArquivo(arquivo: File): Promise<AssetAdmin> {
    const dados = new FormData()
    dados.append('file', arquivo)
    return chamar<AssetAdmin>('/upload', { method: 'POST', body: dados })
  },

  // ── O cartão como peça única (23/08) ──────────────────────────────
  //
  // Um cartão guarda-se INTEIRO numa chamada. Não há aqui "guardar o título" e
  // "guardar a imagem" em separado, porque foi de peças guardadas em separado
  // que nasceu o problema que isto veio fechar.

  estruturaRaiz: (projectSlug: string) =>
    chamar<{
      project: { id: string; slug: string; name: string }
      perfil: {
        id: string
        displayName: string
        avatarUrl: string | null
        bio: string | null
      } | null
      introducao: {
        contentId: string
        title: string
        coverUrl: string | null
        cartoes: CartaoAdmin[]
      } | null
      produtoVivo: { contentId: string; title: string; cartoes: CartaoAdmin[] }
      alfabeto: { letras: string[]; publicadas: number }
    }>(`/projects/${projectSlug}/estrutura`),

  duplicarIntroducao: (contentId: string) =>
    chamar<CartaoAdmin>(`/contents/${contentId}/duplicate-intro`, { method: 'POST' }),

  alfabeto: (projectSlug: string) =>
    chamar<{
      project: { id: string; slug: string; name: string }
      vagoes: VagaoAdmin[]
    }>(`/projects/${projectSlug}/alfabeto`),

  salvarCartao: (
    id: string,
    dados: {
      titulo?: string | null
      /** Opcional, e só o Produto Vivo o usa. Guardado no `meta` do cartão. */
      subtitulo?: string | null
      descricao?: string | null
      assetId?: string | null
      imageAssetId?: string | null
      linkUpgrade?: string | null
      folhaA4AssetId?: string | null
    },
  ) => chamar<CartaoAdmin>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),

  /** Sai do ar e fica guardado — reversível, para o engano com pressa. */
  tirarCartaoDoAr: (id: string) =>
    chamar<{ estado: string }>(`/cards/${id}/unpublish`, { method: 'POST' }),

  /** Volta ao ar. Só se estiver inteiro; a regra é sempre a mesma. */
  porCartaoNoAr: (id: string) =>
    chamar<{ estado: string }>(`/cards/${id}/publish`, { method: 'POST' }),

  /** Apaga de vez. Nas quatro casas de uma letra, esvazia em vez de apagar. */
  apagarCartaoDeVez: (id: string) =>
    chamar<{ apagado: boolean; esvaziado: boolean }>(`/cards/${id}/forever`, { method: 'DELETE' }),

  duplicarCartao: (id: string) => chamar<CartaoAdmin>(`/cards/${id}/duplicate`, { method: 'POST' }),

  /** Um cartão novo e vazio numa publicação da raiz — sem precisar de original. */
  acrescentarCartaoDaRaiz: (contentId: string) =>
    chamar<CartaoAdmin>(`/contents/${contentId}/cards`, { method: 'POST' }),

  /** Esvazia um original (a casa fica) ou remove uma cópia. */
  esvaziarCartao: (id: string) =>
    chamar<{ removido: boolean }>(`/cards/${id}`, { method: 'DELETE' }),

  /** Grava a ordem toda de uma vez: meia ordem gravada é pior do que nenhuma. */
  ordenarCartoes: (contentId: string, ids: string[]) =>
    chamar<{ ordenados: number }>(`/contents/${contentId}/card-order`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  criarCartaoDeImpressao: (contentId: string) =>
    chamar<CartaoAdmin>(`/contents/${contentId}/print-card`, { method: 'POST' }),

  /** Envia a foto e guarda-a no cartão numa só acção de quem publica. */
  async porFotoNoCartao(cartaoId: string, arquivo: File) {
    const asset = await this.enviarArquivo(arquivo)
    return this.salvarCartao(cartaoId, { imageAssetId: asset.id })
  },

  /** O mesmo para o som. */
  async porAudioNoCartao(cartaoId: string, arquivo: File) {
    const asset = await this.enviarArquivo(arquivo)
    return this.salvarCartao(cartaoId, { assetId: asset.id })
  },

  /** E a folha A4, que só o cartão de impressão tem. */
  async porFolhaA4NoCartao(cartaoId: string, arquivo: File) {
    const asset = await this.enviarArquivo(arquivo)
    return this.salvarCartao(cartaoId, { folhaA4AssetId: asset.id })
  },

  // ── Ajuda e suporte (23/08) ───────────────────────────────────────

  pedidosDeReposicao: (projectSlug: string) =>
    chamar<{
      pedidos: PedidoDeReposicao[]
      resumo: { porAtender: number; pessoasAfectadas: number; semConta: number }
    }>(`/projects/${projectSlug}/recovery-requests`),

  /** Gera o link de uso único. Só se vê UMA vez. */
  atenderPedido: (id: string) =>
    chamar<{ url: string; validoAte: string }>(`/recovery-requests/${id}/link`, { method: 'POST' }),

  // ── Categorias de áudio ─────────────────────────────────────────
  categorias: (projectSlug: string) =>
    chamar<{ categorias: CategoriaAdmin[] }>(`/projects/${projectSlug}/categories`),

  criarCategoria: (projectSlug: string, nome: string) =>
    chamar<CategoriaAdmin>(`/projects/${projectSlug}/categories`, {
      method: 'POST',
      body: JSON.stringify({ nome }),
    }),

  renomearCategoria: (id: string, nome: string) =>
    chamar<CategoriaAdmin>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome }),
    }),

  removerCategoria: (id: string) =>
    chamar<{ removida: string; audiosDesclassificados: number }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  classificarBloco: (blocoId: string, categoryId: string | null) =>
    chamar(`/blocks/${blocoId}/category`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryId }),
    }),

  /** Define (ou remove) a arte própria de uma faixa. */
  definirArteDoBloco: (blocoId: string, assetId: string | null) =>
    chamar(`/blocks/${blocoId}/image`, { method: 'PATCH', body: JSON.stringify({ assetId }) }),

  moverBloco: (blocoId: string, direcao: 'cima' | 'baixo') =>
    chamar<{ movido: boolean }>(`/blocks/${blocoId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ direcao }),
    }),

  /** Define (ou remove) o PDF gratuito da letra. */
  definirMaterialGratis: (contentId: string, assetId: string | null) =>
    chamar<{ id: string; freeFileUrl: string | null; freeFileName: string | null }>(
      `/contents/${contentId}/free-file`,
      { method: 'PATCH', body: JSON.stringify({ assetId }) },
    ),

  /** Define (ou remove) o link externo de compra do projeto. */
  definirLinkDeCompra: (projectSlug: string, url: string | null) =>
    chamar<{ id: string; checkoutUrl: string | null }>(`/projects/${projectSlug}/checkout-url`, {
      method: 'PATCH',
      body: JSON.stringify({ url }),
    }),

  /** Define (ou remove) a capa da letra. */
  definirCapa: (contentId: string, assetId: string | null) =>
    chamar<{ id: string; coverUrl: string | null; shareCardUrl: string | null }>(
      `/contents/${contentId}/cover`,
      { method: 'PATCH', body: JSON.stringify({ assetId }) },
    ),

  /** Comentários recentes do projeto, para revisar e agir. */
  comentarios: (projectSlug: string) =>
    chamar<{ project: { name: string }; comments: ComentarioAdmin[] }>(
      `/projects/${projectSlug}/comments`,
    ),

  /** Bloqueia ou libera uma conta. */
  bloquearConta: (userId: string, bloquear: boolean, motivo?: string) =>
    chamar<{ id: string; displayName: string; status: string }>(`/users/${userId}/block`, {
      method: 'POST',
      body: JSON.stringify({ bloquear, motivo }),
    }),

  /** Apaga um comentário impróprio. Rota fora do prefixo do painel. */
  apagarComentario: (id: string) => chamarRaiz<void>(`/comments/${id}`, { method: 'DELETE' }),

  /**
   * A lista completa de quem se registou. Passa pelas guardas de administração.
   *
   * Ia por um `fetch` solto e sem sessão, o que funcionava enquanto a rota
   * estava aberta a toda a gente. Ele fechou-a em 26/08 e agora ela precisa de
   * ir por aqui, que é onde vive o token.
   */
  pessoasDoProjeto: (projectSlug: string) =>
    chamarRaiz<{
      total: number
      pessoas: Array<{
        id: string
        displayName: string
        avatarUrl: string | null
        createdAt: string
      }>
    }>(`/projects/${projectSlug}/people`),

  /** Fila de aprovação das fotos publicadas no My Post. */
  publicacoesPendentes: (projectSlug: string) =>
    chamar<{
      project: { id: string; name: string; photoApprovalRequired: boolean }
      posts: PublicacaoPendente[]
    }>(`/projects/${projectSlug}/posts/pending`),

  moderarPublicacao: (id: string, aprovar: boolean, nota?: string) =>
    chamar(`/posts/${id}/moderate`, { method: 'POST', body: JSON.stringify({ aprovar, nota }) }),

  urlQrSvg: (projectSlug: string, contentSlug: string) =>
    `${API_URL}/projects/${projectSlug}/contents/${contentSlug}/qr.svg`,

  /** O mesmo QR em PNG. O WhatsApp não mostra SVG, e é por lá que ele partilha. */
  urlQrPng: (projectSlug: string, contentSlug: string, baixar = false) =>
    `${API_URL}/projects/${projectSlug}/contents/${contentSlug}/qr.png${baixar ? '?baixar=1' : ''}`,

  /** O mesmo ficheiro A4 que a pessoa recebe, para ele conferir antes de publicar. */
  urlCartaoPdf: (projectSlug: string, contentSlug: string, baixar = false) =>
    `${API_URL}/projects/${projectSlug}/contents/${contentSlug}/cartao.pdf${baixar ? '?baixar=1' : ''}`,
}

// ─────────────────────────────────────────────────────────────────────
// CARTÕES PERSONALIZADOS E CARROSSEL
// ─────────────────────────────────────────────────────────────────────

/**
 * As rotas dos cartões escrevem o `/admin` por extenso.
 *
 * O `chamar` normal acrescenta-o sozinho, o que serve a maior parte deste
 * ficheiro. As rotas daqui para baixo não vivem todas debaixo de um projeto —
 * `/admin/carrossel` e `/admin/projetos` são globais — por isso é mais claro
 * lê-las inteiras do que adivinhar onde o prefixo entra.
 */
const chamarAdmin = chamarRaiz

export interface ModeloAdmin {
  id: string
  slug: string
  dia: number
  nome: string
  ativo: boolean
  ordem: number
  arteUrl: string | null
  arteImpressaoUrl: string | null
  fotoX: number
  fotoY: number
  fotoLargura: number
  fotoAltura: number
  fotoFormato: 'CIRCULO' | 'ELIPSE' | 'RETANGULO'
  nomeX: number
  nomeY: number
  nomeLargura: number
  nomeAltura: number
  nomeCorHex: string
  nomeCorpoMinimo: number
  nomeCorpoMaximo: number
  nomeMaiusculas: boolean
  /** O que falta neste modelo, em português. Nulo quando está pronto. */
  aviso: string | null
}

export interface PrecoAdmin {
  precoUnitarioCent: number
  moeda: string
  descontoPercentagem: number
  descontoAPartirDe: number
}

export interface ProjetoNoPainel {
  slug: string
  nome: string
  tagline: string | null
  capa: string | null
  destaque: 'ESQUERDA' | 'DIREITA' | null
  /** Falso enquanto o projeto está em rascunho e ninguém de fora o vê. */
  publicado: boolean
  numeros: { views: number; likes: number; comments: number; shares: number }
}

export interface PedidoAdmin {
  id: string
  projeto: string
  projectSlug: string
  estado: string
  meio: string | null
  referenciaExterna: string | null
  totalCent: number
  moeda: string
  criadoEm: string
  pagoEm: string | null
  expiraEm: string
  conjuntos: number
  criancas: Array<{ nome: string; confirmada: boolean }>
}

/**
 * O painel dos cartões e do carrossel.
 *
 * Tudo o que o cliente pediu para ficar nas mãos dele passa por aqui: as
 * medidas dos modelos, o preço, o desconto, os dois destaques e a criação de
 * projetos novos. Nenhuma destas coisas precisa de programação outra vez.
 */
export const painelDeCartoes = {
  modelos: (projeto: string) =>
    chamarAdmin<ModeloAdmin[]>(`/admin/projects/${projeto}/modelos-de-cartao`),

  criarModelo: (projeto: string, dados: Partial<ModeloAdmin>) =>
    chamarAdmin<ModeloAdmin>(`/admin/projects/${projeto}/modelos-de-cartao`, {
      method: 'POST',
      body: JSON.stringify(dados),
    }),

  actualizarModelo: (id: string, dados: Partial<ModeloAdmin>) =>
    chamarAdmin<ModeloAdmin>(`/admin/modelos-de-cartao/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    }),

  removerModelo: (id: string) =>
    chamarAdmin<{ removido: boolean }>(`/admin/modelos-de-cartao/${id}`, { method: 'DELETE' }),

  enviarArte: (id: string, ficheiro: File) => {
    const corpo = new FormData()
    corpo.append('file', ficheiro)
    return chamarAdmin<ModeloAdmin & { largura: number; aviso: string | null }>(
      `/admin/modelos-de-cartao/${id}/arte`,
      { method: 'POST', body: corpo },
    )
  },

  preco: (projeto: string) => chamarAdmin<PrecoAdmin>(`/admin/projects/${projeto}/preco-de-cartoes`),

  guardarPreco: (projeto: string, dados: Partial<PrecoAdmin>) =>
    chamarAdmin<PrecoAdmin>(`/admin/projects/${projeto}/preco-de-cartoes`, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    }),

  carrossel: () => chamarAdmin<ProjetoNoPainel[]>('/admin/carrossel'),

  destacar: (projeto: string, destaque: 'ESQUERDA' | 'DIREITA' | null) =>
    chamarAdmin<ProjetoNoPainel[]>(`/admin/projects/${projeto}/destaque`, {
      method: 'PATCH',
      body: JSON.stringify({ destaque }),
    }),

  guardarCartaoDoCarrossel: (
    projeto: string,
    dados: { tagline?: string; coverUrl?: string; ordemNoCarrossel?: number },
  ) =>
    chamarAdmin<ProjetoNoPainel[]>(`/admin/projects/${projeto}/cartao-do-carrossel`, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    }),

  criarProjeto: (dados: { slug: string; nome: string; blocos: number; tagline?: string }) =>
    chamarAdmin<{ slug: string; nome: string; blocos: number }>('/admin/projetos', {
      method: 'POST',
      body: JSON.stringify(dados),
    }),

  pedidos: () => chamarAdmin<PedidoAdmin[]>('/admin/pedidos-de-cartoes'),

  confirmarPagamento: (pedidoId: string, referencia: string) =>
    chamarAdmin<{ pago?: boolean; repetido?: boolean }>(
      `/admin/pedidos-de-cartoes/${pedidoId}/confirmar`,
      { method: 'POST', body: JSON.stringify({ referencia }) },
    ),

  correrExpurgo: () =>
    chamarAdmin<{ pedidos: number }>('/admin/cartoes/expurgo', { method: 'POST' }),
}
