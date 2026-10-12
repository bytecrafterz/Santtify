/**
 * AS PÁGINAS POR ONDE SE PASSOU NESTA VISITA, para o Voltar ir à anterior (11/10).
 *
 * "Create a 'Return to Previous Page' button on every page." Os botões de
 * voltar da plataforma iam cada um para um sítio fixo — "Início", o nome do
 * projeto, "Meu perfil" — e quem chegava à playlist vindo de uma letra era
 * mandado para a página do projeto, e não para a letra. Na aplicação instalada
 * no iPhone não há seta do navegador: o Voltar da página é a única saída.
 *
 * O `history` do navegador não diz o que está para trás, por isso a lista é
 * feita aqui: cada `pushState` acrescenta, cada `replaceState` troca a última,
 * e um `popstate` (o gesto de voltar, ou o nosso Voltar) corta a lista até à
 * página a que se voltou. O Next navega por essas mesmas funções, e por isso
 * apanha-se tudo o que ele faz, incluindo o `replace` do fim do login — sem
 * ele, a página de entrar ficava na lista e o Voltar contava um passo a mais.
 *
 * Vive no `sessionStorage`: dura enquanto o separador (ou a aplicação) estiver
 * aberto e sobrevive a recarregar a página.
 */

const CHAVE = 'pv_paginas_visitadas'
const MAXIMO = 60

/**
 * O painel mudou o site: a aplicação larga as páginas que guardou na memória
 * do telemóvel. Lançado em `admin.ts`, ouvido em `RegistoDasPaginas`.
 */
export const PAGINAS_MUDARAM = 'pv:paginas-mudaram'

/**
 * Páginas de passagem: entrar, criar conta, recuperar a senha, a de boas-vindas
 * da aplicação. Voltar a uma delas depois de entrar é convidar a entrar quem já
 * entrou — o defeito que o `VoltarParaOInicio` foi escrito para evitar. Saltam-se,
 * a não ser que se esteja numa delas (de "recuperar" volta-se a "entrar").
 */
const DE_PASSAGEM = /\/(entrar|cadastrar|recuperar|repor-senha|instalar)(\/|$)/

/** O painel. Do painel não se recua para fora dele sem querer (27/08): sai-se pela Página pública. */
const DO_PAINEL = /^(\/[^/]+)?\/admin(\/|$)/

let pilha: string[] = []
let instalado = false
const ouvintes = new Set<() => void>()

function aqui(): string {
  return window.location.pathname + window.location.search
}

function caminhoDe(endereco: string): string {
  return endereco.split('?')[0]
}

function guardar() {
  if (pilha.length > MAXIMO) pilha = pilha.slice(-MAXIMO)
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(pilha))
  } catch {
    // Sem armazenamento (navegação privada): a lista vive só na memória.
  }
  avisar()
}

/**
 * Avisa quem está a ouvir, mas só depois de o Next acabar de mexer no
 * histórico: ele chama o `pushState` de dentro de um efeito do React, e
 * actualizar um componente ali é recusado.
 */
function avisar() {
  queueMicrotask(() => {
    for (const f of ouvintes) f()
  })
}

function depoisDeAcrescentar() {
  const u = aqui()
  if (pilha[pilha.length - 1] === u) return
  pilha.push(u)
  guardar()
}

function depoisDeTrocar() {
  const u = aqui()
  if (pilha[pilha.length - 1] === u) return
  if (pilha.length) pilha[pilha.length - 1] = u
  else pilha.push(u)
  guardar()
}

/** Voltou-se (ou avançou-se) pelo histórico: a lista acaba na página a que se chegou. */
function depoisDeRecuar() {
  const u = aqui()
  const i = pilha.lastIndexOf(u)
  if (i === -1) pilha.push(u)
  else pilha = pilha.slice(0, i + 1)
  guardar()
}

/** Começa a contar. Chamado uma vez, pela casca da aplicação (`RegistoDasPaginas`). */
export function instalarRegistoDasPaginas() {
  if (instalado || typeof window === 'undefined') return
  instalado = true
  try {
    const lida: unknown = JSON.parse(sessionStorage.getItem(CHAVE) ?? '[]')
    pilha = Array.isArray(lida) ? lida.filter((x): x is string => typeof x === 'string') : []
  } catch {
    pilha = []
  }

  // A página acabou de carregar: recarregada, vinda do histórico, ou nova.
  const u = aqui()
  const navegacao = performance.getEntriesByType?.('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined
  if (navegacao?.type === 'back_forward' && pilha.includes(u)) depoisDeRecuar()
  else if (pilha[pilha.length - 1] !== u) depoisDeAcrescentar()
  else avisar()

  const acrescentar = window.history.pushState
  window.history.pushState = function (...args: Parameters<History['pushState']>) {
    acrescentar.apply(this, args)
    depoisDeAcrescentar()
  }
  const trocar = window.history.replaceState
  window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
    trocar.apply(this, args)
    depoisDeTrocar()
  }
  window.addEventListener('popstate', depoisDeRecuar)
}

/**
 * A página para onde o Voltar leva, e quantos passos atrás ela está.
 *
 * Salta as entradas da mesma página (a letra com outro `?pub=` é a mesma
 * letra), as páginas de passagem, e — dentro do painel — tudo o que não é do
 * painel. Nula quando não há para onde: a página foi aberta direta, por um
 * link ou um QR Code, e então quem chama usa o destino de sempre.
 */
export function paginaAnterior(): { endereco: string; passos: number } | null {
  if (typeof window === 'undefined' || !instalado) return null
  // Sem mexer na lista: isto é lido enquanto o React desenha. Se a página de
  // agora ainda não entrou, está logo a seguir à última.
  const atual = pilha[pilha.length - 1] === aqui() ? pilha.length - 1 : pilha.length
  const caminho = window.location.pathname
  const emPassagem = DE_PASSAGEM.test(caminho)
  const noPainel = DO_PAINEL.test(caminho)
  for (let i = atual - 1; i >= 0; i--) {
    const antes = caminhoDe(pilha[i])
    if (antes === caminho) continue
    if (!emPassagem && DE_PASSAGEM.test(antes)) continue
    if (noPainel && !DO_PAINEL.test(antes)) return null
    return { endereco: pilha[i], passos: atual - i }
  }
  return null
}

/** Vai à página anterior, se houver. Diz se foi, para quem chama ir ao destino de sempre se não. */
export function voltarAPaginaAnterior(): boolean {
  const anterior = paginaAnterior()
  if (!anterior) return false
  window.history.go(-anterior.passos)
  return true
}

/** Para o `useSyncExternalStore` de quem precisa de saber se há página anterior. */
export function assinarPaginas(f: () => void) {
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
  }
}

export function haPaginaAnterior(): boolean {
  return paginaAnterior() !== null
}

export function haPaginaAnteriorNoServidor(): boolean {
  return false
}
