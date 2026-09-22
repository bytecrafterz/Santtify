/**
 * O NOME DE UMA CASA DO PROJETO, escrito em português correcto.
 *
 * Cada projeto diz como se chama uma das suas casas — "Letra", "Dia",
 * "Atributo" — e isso vive em `Project.unidade`. Ele pediu-o em 21/09, com
 * estas palavras: "o que muda de um projeto para outro é o conteúdo e a
 * identificação da unidade — no Alfabeto é Letra A; no Minha Identidade é Dia
 * 1. A estrutura de gerenciamento e publicação deve continuar a mesma."
 *
 * O nome sozinho não chega para escrever uma frase: "a letra precisa" mas "o
 * dia precisa", "todas as letras" mas "todos os dias". Estas três funções são
 * o mínimo para que o ecrã não fique a falar torto, e estão aqui em vez de
 * copiadas nos dois componentes que precisam delas — a grade pública e o
 * painel.
 */

/**
 * As femininas que ele usa, ou pode vir a usar.
 *
 * A regra do -a final não serve: `dia` acaba em -a e é masculino. E como o nome
 * é escrito por ele no painel, não há como adivinhar sempre. O que não estiver
 * nesta lista fica em masculino, que é o caso da maioria das palavras.
 */
const FEMININAS = new Set([
  'letra',
  'carta',
  'pagina',
  'página',
  'semana',
  'etapa',
  'fase',
  'licao',
  'lição',
  'historia',
  'história',
])

export function ehFeminina(unidade: string) {
  return FEMININAS.has(unidade.trim().toLowerCase())
}

/**
 * "1 letra liberada", "3 dias liberados".
 *
 * O particípio concorda com a palavra, em género E em número, e por isso não dá
 * para o escrever no ecrã com um "s" pendurado no fim. Fica aqui, ao lado da
 * lista que sabe quais são femininas.
 */
export function liberadas(unidade: string, quantas: number) {
  const nome = quantas === 1 ? unidade : plural(unidade)
  const f = ehFeminina(unidade)
  const particípio = quantas === 1 ? (f ? 'liberada' : 'liberado') : f ? 'liberadas' : 'liberados'
  return `${nome.toLowerCase()} ${particípio}`
}

/** "uma letra", "um dia". */
export function artigoIndefinido(unidade: string) {
  return ehFeminina(unidade) ? 'uma' : 'um'
}

/** Primeira letra em maiúscula, para começar uma frase. */
export function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Quantas casas tem a grade deste projeto.
 *
 * Num alfabeto são sempre 26, e é o próprio alfabeto que o diz — não faz
 * sentido guardar 26 num campo que alguém possa pôr a 25. Nos outros é a
 * quantidade que ele escreveu no painel.
 */
export function casasDesteProjeto(projeto: {
  sequencia?: 'LETRAS' | 'NUMEROS'
  blocos?: number
}) {
  return projeto.sequencia === 'LETRAS' ? 26 : (projeto.blocos ?? 0)
}

/** "a letra", "o dia". */
export function artigoDefinido(unidade: string) {
  return ehFeminina(unidade) ? 'a' : 'o'
}

/**
 * COMO SE ANUNCIA UMA CASA, e nunca "Letra B — Letra B".
 *
 * O nome de uma casa é "Letra N" e o título dela é o que ele escreveu: "N de
 * Nascimento e Nozes". Juntos com um travessão lêem-se bem — desde que sejam
 * duas coisas diferentes.
 *
 * As letras que ele ainda não preencheu nascem com o título "Letra N", que é
 * exactamente o nome da casa. A junção às cegas devolvia "Letra B — Letra B",
 * que foi o que ele viu em 22/09 no fim da Letra N e que parece defeito
 * porque é defeito. O mesmo vale para "em breve", que é a casa que ainda nem
 * existe na base.
 *
 * Quando o título não acrescenta nada, fica só o nome da casa.
 */
export function nomeDaCasa(
  unidade: string,
  casa: string | number | null | undefined,
  titulo: string | null | undefined,
) {
  const nome = `${capitalizar(unidade.trim())} ${casa ?? ''}`.trim()
  const escrito = (titulo ?? '').trim()
  if (!escrito) return nome
  const igual = escrito.toLocaleLowerCase('pt') === nome.toLocaleLowerCase('pt')
  if (igual || escrito.toLocaleLowerCase('pt') === 'em breve') return nome
  return `${nome} — ${escrito}`
}

/** "todas as letras", "todos os dias". */
export function todosOsPlural(unidade: string) {
  return ehFeminina(unidade)
    ? `todas as ${plural(unidade).toLowerCase()}`
    : `todos os ${plural(unidade).toLowerCase()}`
}

/**
 * O plural.
 *
 * Um "s" chega para Letra, Dia, Bloco, Atributo, Semana e Fase. Lição faz
 * "lições", e é a única irregular que vale a pena prever, porque é uma palavra
 * que este projeto pode mesmo usar.
 */
export function plural(unidade: string) {
  const u = unidade.trim()
  if (/ção$/i.test(u)) return u.replace(/ção$/i, 'ções')
  if (/[rzs]$/i.test(u)) return `${u}es`
  return `${u}s`
}
