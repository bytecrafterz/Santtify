'use client'

import { definirCategoriaATocar } from './categoria-a-tocar'
import { botoesDaSessao, descreverNaSessao } from './sessao-de-midia'
import { faixaNaFila, prepararFila, projetoDaFila, proximaDaFila, type FaixaDaFila } from './tocar-em-sequencia'
import { rastrear } from './track'

/**
 * UM SÓ `<audio>` PARA AS PUBLICAÇÕES DA PÁGINA (08/10).
 *
 * Cada publicação tinha o seu próprio elemento, e a sequência passava de um
 * para o outro: acabava a Explicação da Letra A e mandava tocar o elemento da
 * Letra B — às vezes depois de a página abrir a letra. Com o ecrã aceso
 * funcionava. Com o telefone bloqueado, o iPhone não deixa começar um elemento
 * diferente nem esperar pela página, e a música parava no fim da faixa. Foi o
 * que o cliente descreveu: "quando termina uma faixa, não passa automaticamente
 * para a seguinte. Quero que continue mesmo com o telefone bloqueado."
 *
 * Agora há um elemento só, que é o que a pessoa tocou com o dedo. No fim de
 * cada faixa, a seguinte entra NELE, no próprio `ended`: troca-se a fonte e
 * toca-se ali, com o endereço que já veio na fila (`tocar-em-sequencia`). Cada
 * tocador de onda é uma vista deste: mostra o tempo e o botão quando a faixa
 * que está a tocar é a sua.
 *
 * Vive no `body` para a regra de "um som de cada vez" o ver: tocar o karaokê
 * ou outro áudio pára este, e o contrário.
 *
 * ── E É O TOCADOR DA PLATAFORMA INTEIRA (10/10) ─────────────────────────
 *
 * "Se estou ouvindo uma música no projeto Quem é Jesus? e entro no Jesus
 * Alfabeto Saudável, a música não pode parar. Só deve parar quando eu
 * escolher outra música ou apertar Pausar."
 *
 * O elemento já sobrevivia à troca de página — está no `body`, fora do que o
 * React desenha. Era eu que o parava: sem tocadores na página, parava ao fim
 * de um segundo e meio. Isso saiu. A música continua, a sequência continua
 * de faixa em faixa do projeto onde começou, e o `TocadorGlobal` mostra-a em
 * baixo, com pausar, seguinte e fechar, sempre que o cartão dela não está à
 * vista. A playlist passou a tocar aqui também, com a sua própria lista.
 */

export interface FaixaATocar {
  id: string
  url: string
  titulo: string
  rotulo: string | null
  capa: string | null
  contentId: string
  /** O que acende no menu das categorias: a categoria, ou o nome da casa. */
  categoria: string | null
  /** Para as estatísticas: o nome do bloco, como sempre se registou. */
  nomeDoBloco: string | null
  duracaoMs: number | null
  /** O que mais vai no registo de MEDIA_PLAY/COMPLETE (a playlist diz de onde veio). */
  rastreio?: Record<string, unknown>
}

export interface EstadoDoTocador {
  faixaId: string | null
  tocando: boolean
  agora: number
  total: number
}

const PARADO: EstadoDoTocador = { faixaId: null, tocando: false, agora: 0, total: 0 }
let estado: EstadoDoTocador = PARADO
const ouvintes = new Set<() => void>()
let elemento: HTMLAudioElement | null = null
let faixa: FaixaATocar | null = null
let projectId: string | null = null
let saltarPara: number | null = null
/** Quem quer saber que uma faixa acabou (o contador de reproduções de cada tocador). */
const aoAcabar = new Map<string, Set<() => void>>()
/** A página sabe abrir outras casas sem sair dela (a experiência contínua). */
let quemAbreCasas = 0
/**
 * A lista de uma página que tem a sua (a playlist, com o filtro dela). Manda
 * sobre a fila do projeto enquanto se toca a partir dela, e acaba no fim —
 * como a playlist sempre acabou.
 */
let filaPropria: FaixaATocar[] | null = null
/** A página onde a faixa foi tocada com o dedo: para onde o tocador global leva. */
let paginaDeOrigem: string | null = null

function publicar(parcial: Partial<EstadoDoTocador>) {
  estado = { ...estado, ...parcial }
  ouvintes.forEach((f) => f())
}

export function assinarTocador(f: () => void) {
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
  }
}
export const lerTocador = () => estado
export const lerTocadorNoServidor = () => PARADO

function oElemento(): HTMLAudioElement {
  if (elemento) return elemento
  const a = document.createElement('audio')
  a.preload = 'auto'
  a.setAttribute('controlsList', 'nodownload')
  a.addEventListener('contextmenu', (e) => e.preventDefault())
  a.addEventListener('timeupdate', () => publicar({ agora: a.currentTime }))
  const medir = () => {
    if (Number.isFinite(a.duration) && a.duration > 0) publicar({ total: a.duration })
    if (saltarPara !== null) {
      a.currentTime = saltarPara
      saltarPara = null
    }
  }
  a.addEventListener('loadedmetadata', medir)
  a.addEventListener('durationchange', medir)
  a.addEventListener('play', aoComecar)
  a.addEventListener('pause', () => publicar({ tocando: false }))
  a.addEventListener('ended', aoTerminar)
  document.body.appendChild(a)
  elemento = a
  return a
}

function carregar(f: FaixaATocar) {
  const a = oElemento()
  faixa = f
  a.src = f.url
  publicar({ faixaId: f.id, agora: 0, total: f.duracaoMs ? f.duracaoMs / 1000 : 0 })
  descreverNaSessao({ titulo: f.titulo, rotulo: f.rotulo, capa: f.capa })
  // A cada faixa: outra página (a playlist) pode ter ficado com estes botões.
  botoesDaSessao({
    tocar: () => void a.play().catch(() => {}),
    pausar: () => a.pause(),
    seguinte: () => avancar(),
    anterior: () => recuar(),
  })
}

function aoComecar() {
  publicar({ tocando: true })
  if (!faixa) return
  /* Diz à página inteira o que está a tocar: é o que acende a categoria certa
     no menu, também quando a faixa seguinte entra sozinha. */
  definirCategoriaATocar(faixa.categoria)
  if (projectId) {
    void rastrear({
      projectId,
      contentId: faixa.contentId,
      type: 'MEDIA_PLAY',
      props: { bloco: faixa.nomeDoBloco, blockId: faixa.id, ...faixa.rastreio },
    })
  }
}

function aoTerminar() {
  const terminada = faixa
  publicar({ tocando: false })
  if (!terminada) return
  aoAcabar.get(terminada.id)?.forEach((f) => f())
  if (projectId) {
    void rastrear({
      projectId,
      contentId: terminada.contentId,
      type: 'MEDIA_COMPLETE',
      props: { bloco: terminada.nomeDoBloco, blockId: terminada.id, ...terminada.rastreio },
    })
  }
  avancar()
}

/**
 * Passa à faixa seguinte NO MESMO ELEMENTO, já — é isto que funciona com o
 * telefone bloqueado.
 */
function avancar() {
  const actual = faixa
  if (!actual) return

  // A lista própria (a playlist) manda enquanto se toca a partir dela.
  if (filaPropria) {
    const i = filaPropria.findIndex((f) => f.id === actual.id)
    const daLista = i >= 0 ? filaPropria[i + 1] : undefined
    if (!daLista) return
    carregar(daLista)
    void oElemento()
      .play()
      .catch(() => publicar({ tocando: false }))
    return
  }

  const seguinte = proximaDaFila(actual.id)
  if (!seguinte) return

  /*
    ATRAVESSA SEMPRE (10/10). Até aqui a sequência só passava para outra casa
    onde a página a soubesse mostrar, e parava no fim do dia aberto. Com o
    tocador global ela segue: a faixa seguinte aparece em baixo, no
    `TocadorGlobal`, mesmo que a página seja outra — é a música a continuar
    enquanto ele navega, que foi o pedido.
  */
  const estaNaPagina = Boolean(document.getElementById(`cartao-${seguinte.id}`))

  carregar(paraTocar(seguinte, actual))
  void oElemento()
    .play()
    .catch(() => publicar({ tocando: false }))

  /* Com o ecrã aceso, a página acompanha: abre a casa e leva até à faixa. Com o
     ecrã apagado isto fica para quando a pessoa voltar — o som não espera. */
  window.dispatchEvent(
    new CustomEvent('pv:faixa-a-tocar', { detail: { slug: seguinte.slug, blockId: seguinte.id } }),
  )
  if (estaNaPagina && document.visibilityState === 'visible') {
    const caixa = document.getElementById(`cartao-${seguinte.id}`)
    caixa?.closest('.publicacao')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function paraTocar(f: FaixaDaFila, anterior: FaixaATocar): FaixaATocar {
  return {
    id: f.id,
    url: f.url,
    titulo: f.title,
    rotulo: f.rotulo,
    capa: f.coverUrl,
    contentId: f.contentId,
    categoria: f.categoriaNome ?? f.rotulo ?? anterior.categoria,
    nomeDoBloco: f.rotulo,
    duracaoMs: f.durationMs,
  }
}

/** A faixa anterior: na lista própria volta uma; senão recomeça esta. */
function recuar() {
  const a = oElemento()
  const actual = faixa
  if (!actual) return
  if (a.currentTime > 3 || !filaPropria) {
    a.currentTime = 0
    return
  }
  const i = filaPropria.findIndex((f) => f.id === actual.id)
  const anterior = i > 0 ? filaPropria[i - 1] : undefined
  if (!anterior) {
    a.currentTime = 0
    return
  }
  carregar(anterior)
  void a.play().catch(() => publicar({ tocando: false }))
}

function lembrarDeOnde() {
  paginaDeOrigem = window.location.pathname + window.location.search
}

/** O play e a pausa de um tocador: é sempre o dedo de alguém. */
export function alternarFaixa(f: FaixaATocar, opcoes: { projectId: string }) {
  projectId = opcoes.projectId
  const a = oElemento()
  if (faixa?.id === f.id && a.getAttribute('src')) {
    if (a.paused) void a.play().catch(() => {})
    else a.pause()
    return
  }
  // Tocar uma faixa de um cartão é sair da lista da playlist, se se estava nela.
  filaPropria = null
  lembrarDeOnde()
  carregar(f)
  void a.play().catch(() => publicar({ tocando: false }))
  // A fila vem já, para o fim desta faixa encontrar a seguinte sem esperar. É
  // a do projeto DESTA página: tocar noutro projeto troca de fila.
  void prepararFila()
}

/**
 * Tocar uma faixa de uma lista própria (a playlist). A seguinte é a seguinte
 * DESTA lista, e no fim pára. Devolve se começou — o navegador pode recusar.
 */
export async function tocarDaLista(
  lista: FaixaATocar[],
  indice: number,
  opcoes: { projectId: string },
): Promise<boolean> {
  const f = lista[indice]
  if (!f) return false
  projectId = opcoes.projectId
  filaPropria = lista
  lembrarDeOnde()
  const a = oElemento()
  if (faixa?.id === f.id && a.getAttribute('src')) a.currentTime = 0
  else carregar(f)
  try {
    await a.play()
    return true
  } catch {
    publicar({ tocando: false })
    return false
  }
}

/** Pausar ou continuar o que está a tocar, sem saber qual é (o tocador global). */
export function alternarOQueToca() {
  const a = elemento
  if (!a || !faixa) return
  if (a.paused) void a.play().catch(() => {})
  else a.pause()
}

/** A seguinte, a pedido (o botão do tocador global). */
export function tocarSeguinte() {
  avancar()
}

/** A anterior, a pedido. */
export function tocarAnterior() {
  recuar()
}

/** Fechar o tocador global: pára e esquece a faixa. */
export function pararTudo() {
  elemento?.pause()
  faixa = null
  filaPropria = null
  publicar(PARADO)
  botoesDaSessao({})
}

/** A faixa carregada agora, com o que o tocador global precisa de mostrar. */
export function faixaAtual(): FaixaATocar | null {
  return faixa
}

/**
 * Para onde leva tocar no título do tocador global: a página da casa (a letra,
 * o dia) já no cartão desta faixa, quando a faixa é de uma casa; senão, a
 * página onde ela foi tocada.
 *
 * A página da casa, e não o `?letra=&pub=` da página do projeto: esse só se lê
 * ao abrir a página de raiz, e vindo de outro projeto pela navegação da
 * aplicação a página do projeto pode já estar montada e não o ler. A âncora
 * `#cartao-` a página da casa lê sempre, abre o cartão e leva até ele.
 */
export function enderecoDaFaixaAtual(): string | null {
  if (!faixa) return null
  const naFila = faixaNaFila(faixa.id)
  const projeto = projetoDaFila()
  if (naFila && projeto) return `/${projeto}/${encodeURIComponent(naFila.slug)}#cartao-${faixa.id}`
  return paginaDeOrigem
}

/** Tocar na onda: salta para aquele ponto (e começa a faixa, se não era esta). */
export function irParaPonto(f: FaixaATocar, segundos: number, opcoes: { projectId: string }) {
  if (faixa?.id === f.id && elemento) {
    elemento.currentTime = segundos
    return
  }
  saltarPara = segundos
  alternarFaixa(f, opcoes)
}

/** O contador de reproduções de um tocador sobe quando a SUA faixa acaba. */
export function quandoAcabar(faixaId: string, f: () => void) {
  const lista = aoAcabar.get(faixaId) ?? new Set<() => void>()
  lista.add(f)
  aoAcabar.set(faixaId, lista)
  return () => {
    lista.delete(f)
  }
}

/**
 * Cada tocador desenhado regista-se.
 *
 * Servia para PARAR a música quando a página deixava de ter tocadores — a
 * pessoa ia para o perfil, para outro projeto. Desde 10/10 é o contrário que
 * ele quer: a música segue pela plataforma toda, e quem a mostra fora da
 * página dela é o `TocadorGlobal`. Fica o registo, sem parar nada; o karaokê
 * continua a pará-la, pela regra de um som de cada vez.
 */
export function registarTocador() {
  return () => {}
}

/** A página que abre letras e dias sem sair dela diz que está cá. */
export function registarQuemAbreCasas() {
  quemAbreCasas++
  return () => {
    quemAbreCasas--
  }
}

/** Há uma página que abre casas? (A sequência leva-a até à faixa seguinte.) */
export const haQuemAbraCasas = () => quemAbreCasas > 0
