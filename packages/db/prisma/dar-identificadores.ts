/**
 * Dá um @identificador às contas criadas antes de 01/09.
 *
 *   npx tsx packages/db/prisma/dar-identificadores.ts            # só mostra
 *   npx tsx packages/db/prisma/dar-identificadores.ts --executar # grava
 *
 * O identificador passou a ser obrigatório no cadastro em 01/09, e as contas
 * anteriores ficaram sem ele. Deixá-las assim seria manter meia plataforma sem
 * a identificação que ele pediu; obrigá-las a inventar um ao entrar seria pôr
 * um formulário entre uma pessoa e a conta dela, e é a maneira mais rápida de
 * alguém achar que perdeu a conta. Já aconteceu três vezes neste projecto e
 * lê-se sempre da mesma forma: "o sistema apagou o meu perfil".
 *
 * Por isso o identificador é DERIVADO DO NOME QUE ELA PRÓPRIA ESCREVEU, e ela
 * pode trocá-lo na edição do perfil quando quiser. Ninguém fica de fora e
 * ninguém tem de fazer nada.
 *
 * Só mexe em quem está sem identificador. Correr isto duas vezes não muda nada
 * na segunda — importa, porque um script de dados que só é seguro à primeira
 * é um script que ninguém se atreve a correr.
 */
import { PrismaClient } from '@prisma/client'
/*
  Importado do JAVASCRIPT COMPILADO, e não da origem em TypeScript.

  A imagem que corre no servidor leva `apps/api/dist` e não leva `apps/api/src`.
  Importar a origem funcionava aqui na minha máquina e rebentava no único sítio
  onde este script precisa mesmo de correr.

  Continua a ser a MESMA régua do cadastro e da edição do perfil, e é esse o
  ponto: um script de dados que traz a sua própria cópia das regras é um script
  que dá identificadores que a aplicação depois recusa.
*/
// eslint-disable-next-line @typescript-eslint/no-require-imports
const regra = require('../../../apps/api/dist/identity/nome-de-utilizador') as {
  normalizarNomeDeUtilizador: (b: string) => string
  problemaNoNomeDeUtilizador: (n: string) => string | null
  sugerirNomeDeUtilizador: (d: string) => string
  MAX: number
}
const { problemaNoNomeDeUtilizador, sugerirNomeDeUtilizador, MAX } = regra

const prisma = new PrismaClient()
const executar = process.argv.includes('--executar')

async function livre(nome: string): Promise<boolean> {
  const existe = await prisma.user.findUnique({ where: { username: nome }, select: { id: true } })
  return !existe
}

/** O nome dela, e se estiver tomado o mesmo com um número pequeno atrás. */
async function escolher(displayName: string, tomados: Set<string>): Promise<string | null> {
  const base = sugerirNomeDeUtilizador(displayName)
  const candidatos = [base]
  const raiz = base.slice(0, MAX - 3)
  for (let i = 2; i <= 60; i++) candidatos.push(`${raiz}${i}`)
  for (const c of candidatos) {
    if (tomados.has(c)) continue
    if (problemaNoNomeDeUtilizador(c)) continue
    if (await livre(c)) return c
  }
  return null
}

async function main() {
  const sem = await prisma.user.findMany({
    where: { username: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, displayName: true, email: true, status: true },
  })

  if (!sem.length) {
    console.log('Ninguém está sem identificador. Nada a fazer.')
    return
  }

  console.log(`${sem.length} conta(s) sem identificador:\n`)
  // Guarda o que já foi escolhido NESTA passagem: em modo de ensaio nada é
  // gravado, e sem isto duas pessoas com o mesmo nome receberiam o mesmo
  // identificador no relatório e a colisão só apareceria ao gravar.
  const tomados = new Set<string>()

  for (const u of sem) {
    const nome = await escolher(u.displayName, tomados)
    if (!nome) {
      console.log(`  ✗ ${u.displayName}: não encontrei identificador livre. Fica sem.`)
      continue
    }
    tomados.add(nome)
    console.log(`  ${u.displayName}  (${u.status})  ->  @${nome}`)
    if (executar) {
      await prisma.user.update({ where: { id: u.id }, data: { username: nome } })
    }
  }

  console.log(
    executar
      ? '\nGravado.'
      : '\nEnsaio. Nada foi gravado. Corra outra vez com --executar para gravar.',
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
