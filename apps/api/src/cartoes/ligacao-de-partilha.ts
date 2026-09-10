import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * A ligação assinada que vai no WhatsApp e no e-mail.
 *
 * POR QUE É QUE ISTO TEM DE EXISTIR: o cliente pediu, no ponto 8, que a mãe
 * pudesse enviar os cartões pelo WhatsApp e por e-mail. Nenhum dos dois aceita
 * um ficheiro vindo de uma página web — o que se envia é sempre um endereço. E
 * o endereço tem de abrir na gráfica, no telemóvel do marido, no computador da
 * escola: sítios onde ela não tem sessão iniciada.
 *
 * Uma rota aberta com o id do pedido no endereço já seria "difícil de
 * adivinhar", e difícil de adivinhar não é o mesmo que protegido — ainda mais
 * tratando-se da fotografia de uma criança. Por isso o endereço leva uma
 * assinatura e um prazo:
 *
 *   - assinada, logo ninguém a fabrica sem a chave;
 *   - com prazo, logo deixa de servir sozinha;
 *   - o prazo é o MESMO do expurgo, por isso a ligação nunca sobrevive ao
 *     ficheiro nem morre antes dele. Uma ligação viva a apontar para um
 *     ficheiro apagado é uma promessa partida ao fim de sete dias.
 *
 * A chave é DERIVADA do segredo dos tokens, com um domínio próprio. Assim não
 * há variável de ambiente nova para o deploy esquecer, e uma ligação de
 * partilha nunca pode ser confundida com uma sessão: são chaves diferentes.
 */

const DOMINIO = 'santtify:partilha-de-cartoes:v1'

function chave(segredo: string): Buffer {
  return createHmac('sha256', segredo).update(DOMINIO).digest()
}

function assinar(chaveDerivada: Buffer, corpo: string): string {
  return createHmac('sha256', chaveDerivada).update(corpo).digest('base64url')
}

export interface ConteudoDaLigacao {
  pedidoId: string
  criancaId: string
  /** Em segundos desde 1970, como o resto do mundo os conta. */
  expiraEm: number
}

/** Constrói o texto que vai no endereço. */
export function criarFicha(segredo: string, dados: ConteudoDaLigacao): string {
  const corpo = Buffer.from(
    JSON.stringify({ p: dados.pedidoId, c: dados.criancaId, e: dados.expiraEm }),
  ).toString('base64url')
  return `${corpo}.${assinar(chave(segredo), corpo)}`
}

/**
 * Lê a ficha e devolve o que ela diz, ou `null`.
 *
 * `null` para tudo o que corra mal — mal formada, assinatura errada, prazo
 * passado — e de propósito: quem tenta forçar não fica a saber QUAL das três
 * falhou, e para quem tem uma ligação legítima expirada a resposta é a mesma
 * página a dizer que o prazo terminou.
 */
export function lerFicha(segredo: string, ficha: string): ConteudoDaLigacao | null {
  const partes = ficha.split('.')
  if (partes.length !== 2) return null
  const [corpo, assinatura] = partes

  const esperada = assinar(chave(segredo), corpo)

  /**
   * Comparação de tempo constante.
   *
   * Um `===` normal desiste no primeiro caractere diferente, e a diferença de
   * tempo entre desistir ao primeiro e desistir ao vigésimo é medível. Com
   * medições suficientes, adivinha-se a assinatura byte a byte.
   */
  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as {
      p: string
      c: string
      e: number
    }
    if (!dados.p || !dados.c || !dados.e) return null
    if (dados.e * 1000 < Date.now()) return null
    return { pedidoId: dados.p, criancaId: dados.c, expiraEm: dados.e }
  } catch {
    return null
  }
}
