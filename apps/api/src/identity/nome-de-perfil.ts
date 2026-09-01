/**
 * O nome do perfil tem de ser um nome.
 *
 * Pedido dele em 01/09: "o campo Nome deve ser para nome próprio e não aceitar
 * números ou combinações claramente inválidas, como AF, 123456, 24055,
 * AF123456". Vem logo a seguir ao perfil "Pf 005981" que o levou a pedir o
 * cadastro com identificação, e é a mesma preocupação: uma plataforma usada por
 * famílias precisa de saber quem está lá dentro.
 *
 * A REGRA VIVE AQUI E SÓ AQUI, e é medida no cadastro E na edição do perfil.
 * Só no cadastro não servia de nada: bastava criar a conta com um nome bom e
 * trocá-lo a seguir por "24055".
 *
 * ONDE ELA PÁRA, e porquê. Não tento adivinhar se um nome é verdadeiro — não
 * dá, e tentar acabaria a recusar o nome de alguém, que é muito pior do que
 * deixar passar um inventado. O que isto recusa é o que NÃO É UM NOME: dígitos,
 * símbolos, e cadeias curtas de mais para o serem.
 *
 * TRÊS LETRAS, e é aqui que faço um juízo que ele deve conhecer. "AF" tem uma
 * vogal e uma consoante, exactamente como "Zé", e nenhuma regra distingue as
 * duas. Escolhi exigir três letras no nome todo, o que recusa "AF" e recusa
 * também "Zé" sozinho — mas aceita "Zé Maria". Ele listou "AF" como inválido e
 * é a plataforma dele; se um dia aparecer um "Zé" a queixar-se, mudo isto e não
 * o resto.
 */

/** As vogais, com acentos, porque "Ângela" tem de passar. */
const VOGAIS = /[aeiouáàâãéêíóôõúü]/i

/** Letras de qualquer alfabeto latino, espaço, hífen, apóstrofo e ponto. */
const SO_LETRAS = /^[\p{L}\p{M}\s'’.-]+$/u

export function limparNomeDePerfil(bruto: string): string {
  // Espaços a mais colados de um teclado de telemóvel não são erro da pessoa.
  return bruto.trim().replace(/\s+/g, ' ')
}

/**
 * Devolve o que está errado, por palavras, ou `null` se estiver bom.
 *
 * A frase é a que a pessoa lê enquanto se cadastra, e por isso diz o que fazer
 * em vez de dizer que ela falhou.
 */
export function problemaNoNomeDePerfil(bruto: string): string | null {
  const nome = limparNomeDePerfil(bruto)
  if (!nome) return 'Escreva o nome do perfil.'
  if (/\d/.test(nome)) return 'O nome não pode ter números. Escreva o nome da pessoa.'
  if (!SO_LETRAS.test(nome)) return 'O nome só pode ter letras. Escreva o nome da pessoa.'

  const letras = nome.replace(/[^\p{L}]/gu, '')
  if (letras.length < 3) return 'Escreva o nome completo da pessoa, com pelo menos 3 letras.'
  if (!VOGAIS.test(letras)) return 'Isto não parece um nome. Escreva o nome da pessoa.'
  // "aaaa", "XXXXX": uma letra repetida não é nome de ninguém.
  if (new Set(letras.toLowerCase()).size === 1) {
    return 'Isto não parece um nome. Escreva o nome da pessoa.'
  }
  if (nome.length > 80) return 'O nome pode ter no máximo 80 caracteres.'
  return null
}
