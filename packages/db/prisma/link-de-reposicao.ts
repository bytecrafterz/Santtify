import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'

/**
 * Gera um link de reposição de senha a partir do servidor.
 *
 *   npx tsx packages/db/prisma/link-de-reposicao.ts <email> [https://dominio]
 *
 * EXISTE POR CAUSA DE UM BURACO MEU, encontrado em 23/08. A reposição que
 * construí passa pelo painel: a pessoa pede e o responsável gera o link. Só que
 * o responsável também tem conta — e se for ELE a ficar sem entrar, não há
 * ninguém do outro lado para o atender. O administrador ficava fechado fora do
 * seu próprio sistema, e a única saída era esta, que ainda não existia.
 *
 * Quem tem acesso ao servidor pode sempre repor o acesso de quem quer que seja;
 * é assim em qualquer sistema, e é por isso que o acesso ao servidor é a chave
 * que se guarda melhor. O que este script faz é tornar isso um passo com nome,
 * registado na mesma tabela dos outros pedidos, em vez de uma alteração à mão
 * na base de dados.
 */
const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  const base = process.argv[3]?.replace(/\/$/, '') ?? 'https://santtify.com'
  if (!email) {
    console.error('Uso: npx tsx packages/db/prisma/link-de-reposicao.ts <email> [https://dominio]')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, displayName: true, status: true },
  })
  if (!user) {
    console.error(`Não existe conta com o endereço ${email}.`)
    process.exit(1)
  }
  if (user.status !== 'ACTIVE') {
    console.error(`A conta ${email} não está activa (${user.status}).`)
    process.exit(1)
  }

  const projeto = await prisma.project.findFirst({ orderBy: { createdAt: 'asc' } })
  const token = randomBytes(32).toString('base64url')

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      projectId: projeto?.id ?? null,
      emailPedido: email,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      atendidoEm: new Date(),
    },
  })

  const caminho = projeto ? `/${projeto.slug}/repor-senha` : '/repor-senha'
  console.log('')
  console.log(`  Conta:  ${user.displayName} <${email}>`)
  console.log(`  Válido: 24 horas, uma única utilização`)
  console.log('')
  console.log(`  ${base}${caminho}?t=${token}`)
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
