/**
 * A chave Pix do afiliado, conferida antes de ser guardada.
 *
 * O pagamento é feito à mão, pelo cliente, no banco dele — e uma chave com um
 * dígito trocado é dinheiro que vai para outra pessoa ou que volta dias
 * depois. Conferir aqui, onde o afiliado ainda está a escrever, é a única
 * altura em que o erro custa zero.
 */

export const TIPOS_DE_CHAVE_PIX = ['CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'] as const
export type TipoDeChavePix = (typeof TIPOS_DE_CHAVE_PIX)[number]

function soDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const digito = (ate: number) => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10])
}

function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false
  const digito = (ate: number) => {
    const pesos = ate === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(cnpj[i]) * pesos[i]
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito(12) === Number(cnpj[12]) && digito(13) === Number(cnpj[13])
}

/**
 * A chave como fica guardada, ou a razão de não servir.
 *
 * Guardada normalizada — só dígitos no CPF e no CNPJ, +55 no telefone,
 * minúsculas no e-mail e na aleatória — porque é assim que o banco a aceita
 * quando o cliente a cola na hora de pagar.
 */
export function normalizarChavePix(
  tipo: TipoDeChavePix,
  bruta: string,
): { chave: string } | { erro: string } {
  const texto = bruta.trim()
  switch (tipo) {
    case 'CPF': {
      const cpf = soDigitos(texto)
      return cpfValido(cpf) ? { chave: cpf } : { erro: 'Este CPF não é válido. Confira os números.' }
    }
    case 'CNPJ': {
      const cnpj = soDigitos(texto)
      return cnpjValido(cnpj) ? { chave: cnpj } : { erro: 'Este CNPJ não é válido. Confira os números.' }
    }
    case 'EMAIL': {
      const email = texto.toLowerCase()
      // O Pix aceita e-mails até 77 caracteres.
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 77
        ? { chave: email }
        : { erro: 'Escreva um e-mail válido.' }
    }
    case 'TELEFONE': {
      let numero = soDigitos(texto)
      if (numero.length === 10 || numero.length === 11) numero = `55${numero}`
      return /^55\d{10,11}$/.test(numero)
        ? { chave: `+${numero}` }
        : { erro: 'Escreva o telefone com DDD, por exemplo (11) 98765-4321.' }
    }
    case 'ALEATORIA': {
      const chave = texto.toLowerCase()
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(chave)
        ? { chave }
        : { erro: 'A chave aleatória tem 32 letras e números, separados por traços.' }
    }
  }
}
