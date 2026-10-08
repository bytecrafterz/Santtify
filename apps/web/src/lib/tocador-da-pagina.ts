'use client'

import { definirCategoriaATocar } from './categoria-a-tocar'
import { botoesDaSessao, descreverNaSessao } from './sessao-de-midia'
import { prepararFila, proximaDaFila, type FaixaDaFila } from './tocar-em-sequencia'
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
/** Os tocadores desenhados agora. Sem nenhum, a página deixou de os ter: pára. */
let tocadores = 0
let pararSemTocadores: ReturnType<typeof setTimeout> | null = null
/** A página sabe abrir outras casas sem sair dela (a experiência contínua). */
let quemAbreCasas = 0

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
    seguinte: () => avancar(false),
    anterior: () => {
      a.currentTime = 0
    },
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
      props: { bloco: faixa.nomeDoBloco, blockId: faixa.id },
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
      props: { bloco: terminada.nomeDoBloco, blockId: terminada.id },
    })
  }
  avancar(true)
}

/**
 * Passa à faixa seguinte NO MESMO ELEMENTO, já — é isto que funciona com o
 * telefone bloqueado. `sozinha`: veio do fim da faixa (e não do botão
 * "seguinte" do ecrã bloqueado).
 */
function avancar(sozinha: boolean) {
  const actual = faixa
  if (!actual) return
  const seguinte = proximaDaFila(actual.id)
  if (!seguinte) return

  /*
    SÓ ATRAVESSA PARA OUTRA CASA ONDE A PÁGINA A SABE MOSTRAR.

    Na página inicial do projeto (a experiência contínua) as letras e os dias
    abrem-se sem sair dela, e a sequência atravessa-os. Na página de um dia, a
    faixa seguinte de outro dia não está à vista e a página não a sabe abrir —
    aí a sequência fica no que a página tem, como sempre ficou.
  */
  const estaNaPagina = Boolean(document.getElementById(`cartao-${seguinte.id}`))
  if (sozinha && !estaNaPagina && quemAbreCasas === 0) return

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

/** O play e a pausa de um tocador: é sempre o dedo de alguém. */
export function alternarFaixa(f: FaixaATocar, opcoes: { projectId: string }) {
  projectId = opcoes.projectId
  const a = oElemento()
  if (faixa?.id === f.id && a.getAttribute('src')) {
    if (a.paused) void a.play().catch(() => {})
    else a.pause()
    return
  }
  carregar(f)
  void a.play().catch(() => publicar({ tocando: false }))
  // A fila vem já, para o fim desta faixa encontrar a seguinte sem esperar.
  void prepararFila()
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
 * Cada tocador desenhado regista-se. Quando a página deixa de ter tocadores —
 * a pessoa foi para o karaokê, para o perfil —, o som pára, como parava quando
 * cada tocador tinha o seu elemento. A folga cobre a troca de letra, em que os
 * tocadores de uma saem e os da outra entram.
 */
export function registarTocador() {
  tocadores++
  if (pararSemTocadores) {
    clearTimeout(pararSemTocadores)
    pararSemTocadores = null
  }
  return () => {
    tocadores--
    if (tocadores > 0) return
    pararSemTocadores = setTimeout(() => {
      // A página inicial a abrir outra letra não é "sair": os tocadores voltam.
      if (tocadores > 0 || quemAbreCasas > 0 || !elemento) return
      elemento.pause()
      faixa = null
      publicar(PARADO)
    }, 1500)
  }
}

/** A página que abre letras e dias sem sair dela diz que está cá. */
export function registarQuemAbreCasas() {
  quemAbreCasas++
  return () => {
    quemAbreCasas--
  }
}
