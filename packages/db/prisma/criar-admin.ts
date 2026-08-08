/**
 * Cria ou promove o usuário administrador.
 *
 * O painel exige papel ADMIN, e não existe tela de "virar admin" de propósito:
 * uma rota dessas seria a porta mais fácil de invadir o sistema inteiro. A
 * promoção acontece só aqui, com acesso ao servidor.
 *
 *   npx tsx packages/db/prisma/criar-admin.ts <email> [senha]
 *
 * Se o e-mail já existe, apenas promove a ADMIN (útil quando o cliente já se
 * cadastrou pelo app). Se não existe, cria com a senha informada.
 */
import { PrismaClient } from '@prisma/client'
import * as argon2 from 'argon2'
import { randomBytes } from 'node:crypto'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  const senhaInformada = process.argv[3]

  if (!email) {
    console.error('Uso: npx tsx packages/db/prisma/criar-admin.ts <email> [senha]')
    process.exit(1)
  }

  const existente = await prisma.user.findUnique({ where: { email } })

  if (existente) {
    if (existente.role === 'ADMIN') {
      console.log(`✓ ${email} já é administrador.`)
      return
    }
    await prisma.user.update({ where: { id: existente.id }, data: { role: 'ADMIN' } })
    console.log(`✓ ${email} promovido a administrador.`)
    return
  }

  // Senha gerada quando não informada — melhor que exigir uma na linha de
  // comando, onde ela ficaria no histórico do shell.
  const senha = senhaInformada ?? randomBytes(12).toString('base64url')

  await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(senha),
      displayName: email.split('@')[0],
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
    },
  })

  console.log(`✓ Administrador criado: ${email}`)
  if (!senhaInformada) {
    console.log(`  Senha gerada: ${senha}`)
    console.log('  Anote agora — ela não é exibida de novo.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
