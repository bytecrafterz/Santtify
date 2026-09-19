import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Confere a assinatura de um aviso do Mercado Pago.
 *
 * O cabeçalho `x-signature` traz `ts=<milissegundos>,v1=<hmac em hex>`. O HMAC
 * é SHA-256, com a chave secreta da aplicação, sobre este texto:
 *
 *     id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * Três pormenores da documentação deles, e cada um parte a conferência se for
 * esquecido:
 *
 *   - o `data.id` vem dos PARÂMETROS DO ENDEREÇO, não do corpo;
 *   - se for alfanumérico — e o id de uma order é, "ORD01…" — entra em
 *     MINÚSCULAS;
 *   - uma parte que não veio no aviso sai do texto inteira, com o seu `;`.
 *
 * A comparação é em tempo constante. Uma comparação normal pára no primeiro
 * carácter diferente, e o tempo que demora diz a quem tenta quantos acertou.
 *
 * Não se recusa um aviso por ser antigo. O Mercado Pago reenvia os que não
 * receberam resposta, às vezes horas depois, e cada aviso repetido já é
 * inofensivo: a idempotência de `registarAviso` trata dele.
 */
export function assinaturaMercadoPagoValida(p: {
  assinatura: string | undefined
  requestId: string | undefined
  dataId: string | undefined
  segredo: string
}): boolean {
  if (!p.assinatura) return false
  const partes = new Map<string, string>()
  for (const par of p.assinatura.split(',')) {
    const [chave, ...resto] = par.split('=')
    if (chave && resto.length) partes.set(chave.trim(), resto.join('=').trim())
  }
  const ts = partes.get('ts')
  const v1 = partes.get('v1')
  if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false

  let manifesto = ''
  if (p.dataId) manifesto += `id:${/[a-z]/i.test(p.dataId) ? p.dataId.toLowerCase() : p.dataId};`
  if (p.requestId) manifesto += `request-id:${p.requestId};`
  manifesto += `ts:${ts};`

  const esperado = createHmac('sha256', p.segredo).update(manifesto).digest('hex')
  const a = Buffer.from(esperado, 'hex')
  const b = Buffer.from(v1.toLowerCase(), 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
