/**
 * Tira das métricas as visitas que não são de quem chega de fora.
 *
 *   npx tsx packages/db/prisma/marcar-visitas-de-teste.ts            (só mostra)
 *   npx tsx packages/db/prisma/marcar-visitas-de-teste.ts --executar
 *
 * Duas categorias, e as duas foram pedidas por ele em 27/08:
 *
 * 1. AS MINHAS. O painel dizia 66 acessos da Alemanha a um projeto que nunca foi
 *    divulgado lá. Eram todos da máquina de desenvolvimento, que está num centro
 *    de dados alemão: 69 linhas com um único endereço. Ele ia decidir em que
 *    idioma traduzir a plataforma a partir daquele número.
 *
 * 2. AS DELE. "Quero uma maneira de excluir meus próprios acessos de
 *    administrador das estatísticas, porque eu entro no site dezenas de vezes
 *    para testar." Daqui para a frente isso acontece sozinho, no momento em que
 *    a visita se liga à conta; este script trata do que já ficou para trás.
 *
 * NÃO APAGA NADA. Os eventos são append-only de propósito e são a única coisa
 * deste sistema que não se recria; apagar um visitante levava os eventos dele
 * atrás. Marcar deixa a história intacta e é reversível.
 */
import { PrismaClient } from '@prisma/client'
import { createHmac } from 'node:crypto'

const prisma = new PrismaClient()
const executar = process.argv.includes('--executar')

/**
 * O MESMO CÁLCULO DO SERVIDOR, senão o hash não bate com o que está gravado.
 *
 * O endereço é truncado ANTES do hash: /24 no IPv4, /64 no IPv6. Isso é
 * deliberado e está no HashService: guarda-se a faixa de rede e não o aparelho,
 * que é o que a política de privacidade publicada promete às famílias. Efeito
 * lateral útil aqui: uma faixa inteira de um centro de dados sai de uma vez.
 */
function hashDeIp(ip: string, sal: string): string {
  const truncado = ip.includes(':')
    ? ip.split(':').slice(0, 4).join(':')
    : ip.split('.').slice(0, 3).join('.')
  return createHmac('sha256', sal).update(truncado).digest('base64url').slice(0, 32)
}

async function main() {
  const sal = process.env.PRIVACY_HASH_SALT
  if (!sal) throw new Error('PRIVACY_HASH_SALT em falta: sem ele o hash não bate com o gravado.')

  const ipsDeTeste = (process.env.METRICAS_IPS_DE_TESTE ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const hashes = ipsDeTeste.map((ip) => hashDeIp(ip, sal))

  const porIp = hashes.length
    ? await prisma.visitor.count({ where: { ipHash: { in: hashes }, ignoradoNasMetricas: false } })
    : 0
  const porAdmin = await prisma.visitor.count({
    where: { ignoradoNasMetricas: false, user: { is: { role: 'ADMIN' } } },
  })

  console.log(`\n  Endereços de teste declarados: ${ipsDeTeste.length || 'nenhum'}`)
  for (const ip of ipsDeTeste) console.log(`    ${ip}  ->  ${hashDeIp(ip, sal).slice(0, 12)}...`)
  console.log(`\n  Visitas a marcar:`)
  console.log(`    da máquina de desenvolvimento : ${porIp}`)
  console.log(`    de contas de administrador    : ${porAdmin}`)

  if (!executar) {
    console.log('\n  Nada foi alterado. Repita com --executar para marcar.\n')
    return
  }

  const a = hashes.length
    ? await prisma.visitor.updateMany({
        where: { ipHash: { in: hashes } },
        data: { ignoradoNasMetricas: true },
      })
    : { count: 0 }
  const b = await prisma.visitor.updateMany({
    where: { user: { is: { role: 'ADMIN' } } },
    data: { ignoradoNasMetricas: true },
  })

  console.log(
    `\n  Marcadas ${a.count} da máquina de desenvolvimento e ${b.count} de administrador.`,
  )
  const fora = await prisma.visitor.count({ where: { ignoradoNasMetricas: true } })
  const dentro = await prisma.visitor.count({ where: { ignoradoNasMetricas: false } })
  console.log(`  Ficam ${dentro} visitas nas métricas e ${fora} fora delas.\n`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
