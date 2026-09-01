/**
 * O @identificador de cada pessoa.
 *
 * Pedido dele em 31/08: "duas pessoas podem ter o mesmo nome verdadeiro, isso
 * é normal, mas o identificador não pode se repetir". E disse para que serve:
 * "pesquisar, localizar e identificar exatamente uma determinada pessoa".
 *
 * A REGRA VIVE AQUI E SÓ AQUI. É medida no cadastro, na edição do perfil e na
 * consulta de disponibilidade, e já sei o que acontece quando a mesma regra é
 * escrita em três sítios: em 28/08 mudei uma das três cópias da régua do
 * cartão e o botão PUBLICAR passou a acender para cartões que o servidor
 * recusava. O navegador tem uma cópia desta régua, para o campo poder avisar
 * antes de haver pedido nenhum, e essa cópia não é a autoridade.
 */

/** Comprimento: curto o suficiente para caber num ecrã, longo para ser único. */
export const MIN = 3
export const MAX = 20

/**
 * Nomes que ninguém pode tomar.
 *
 * Não é uma lista de palavras feias, é uma lista de palavras que MENTEM: um
 * perfil `@suporte` ou `@santtify` parece a plataforma a falar, e numa
 * plataforma usada por famílias isso é a primeira ferramenta de quem se quer
 * fazer passar por outra pessoa. Os caminhos do site entram na mesma lista,
 * para nunca haver um `@perfil` que colida com o endereço /perfil.
 */
export const RESERVADOS = new Set([
  'admin',
  'administrador',
  'santtify',
  'produtovivo',
  'produto_vivo',
  'suporte',
  'ajuda',
  'contato',
  'contacto',
  'oficial',
  'root',
  'sistema',
  'system',
  'api',
  'perfil',
  'pessoa',
  'entrar',
  'cadastrar',
  'playlist',
  'alfabeto',
  'moderacao',
  'privacidade',
  'termos',
  'null',
  'undefined',
])

/**
 * Põe o que a pessoa escreveu na forma em que é guardado.
 *
 * Minúsculas sempre, acentos resolvidos para a letra sem acento (para "joão"
 * dar "joao" e não perder o caractere), e o resto do que não é permitido cai.
 * O `@` que ela escreveu à frente sai aqui, porque o `@` é do ecrã e não do
 * dado — guardá-lo faria `@@joao` existir.
 */
export function normalizarNomeDeUtilizador(bruto: string): string {
  return bruto
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, MAX)
}

/**
 * Devolve o que está errado, por palavras, ou `null` se estiver bom.
 *
 * Devolve a FRASE e não um sim/não pela mesma razão que a régua do cartão
 * devolve a lista do que falta: "identificador inválido" obriga a adivinhar
 * qual das cinco regras é que se partiu, e quem está a criar uma conta no
 * telemóvel desiste antes de adivinhar.
 */
export function problemaNoNomeDeUtilizador(nome: string): string | null {
  if (!nome) return 'Escolha um identificador.'
  if (nome.length < MIN) return `O identificador precisa de pelo menos ${MIN} caracteres.`
  if (nome.length > MAX) return `O identificador pode ter no máximo ${MAX} caracteres.`
  if (!/^[a-z]/.test(nome)) return 'O identificador precisa de começar por uma letra.'
  if (!/^[a-z0-9._]+$/.test(nome))
    return 'Use apenas letras, números, ponto e traço baixo, sem espaços nem acentos.'
  if (RESERVADOS.has(nome)) return 'Este identificador é reservado. Escolha outro.'
  return null
}

/**
 * Um ponto de partida a partir do nome que a pessoa escreveu.
 *
 * Serve para o campo já vir preenchido em vez de vazio, e serve para dar
 * identificador às contas que existiam antes desta regra. Não garante que
 * esteja livre: quem grava é que decide isso, contra a base.
 */
export function sugerirNomeDeUtilizador(displayName: string): string {
  const base = normalizarNomeDeUtilizador(displayName.replace(/\s+/g, ''))
  if (base.length >= MIN && /^[a-z]/.test(base)) return base
  // Sem nada aproveitável — um nome só de símbolos, ou começado por número —
  // vale mais uma letra à frente do que devolver vazio e obrigar quem chama a
  // tratar o caso outra vez.
  return `pessoa${base}`.slice(0, MAX)
}
