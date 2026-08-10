/**
 * Cadastra os quatro lançamentos que aparecem nos mockups do cliente.
 *
 * São os produtos reais que ele mostrou na tela "Lançamentos", com o status de
 * cada um. Servem para ele ver a área funcionando com o conteúdo dele, e são
 * editáveis pelo painel — texto, imagem, status e ordem.
 *
 * Idempotente.
 *   npx tsx packages/db/prisma/lancamentos-exemplo.ts
 */
import { PrismaClient, LaunchStatus } from '@prisma/client'

const prisma = new PrismaClient()
const PROJETO = 'jesus-alfabeto-saudavel'

const LANCAMENTOS = [
  {
    title: 'Jesus Vitaminas Saudáveis',
    description: 'Aprender sobre alimentação e cuidado com o corpo.',
    status: LaunchStatus.EM_BREVE,
  },
  {
    title: 'Jesus Criança Sábia',
    description: 'Histórias e valores para o dia a dia da criança.',
    status: LaunchStatus.EM_DESENVOLVIMENTO,
  },
  {
    title: 'Jesus As Aves do Paraíso',
    description: 'Descobrir a criação através das aves.',
    status: LaunchStatus.EM_DESENVOLVIMENTO,
  },
  {
    title: 'Jesus Alfabeto Saudável Para Colorir',
    description: 'A versão para imprimir e colorir das 26 letras.',
    status: LaunchStatus.EM_BREVE,
  },
]

async function main() {
  const projeto = await prisma.project.findUnique({ where: { slug: PROJETO } })
  if (!projeto) throw new Error('Projeto não encontrado. Rode o seed primeiro.')

  for (const [i, dados] of LANCAMENTOS.entries()) {
    const existente = await prisma.launch.findFirst({
      where: { projectId: projeto.id, title: dados.title },
      select: { id: true },
    })
    if (existente) {
      console.log(`  já existe: ${dados.title}`)
      continue
    }
    await prisma.launch.create({
      data: { ...dados, projectId: projeto.id, position: i + 1 },
    })
    console.log(`  criado: ${dados.title}`)
  }

  const total = await prisma.launch.count({ where: { projectId: projeto.id } })
  console.log(`\n✓ ${total} lançamento(s) na vitrine.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
