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

/**
 * O identificador que esta pessoa receberia.
 *
 * A ORDEM DOS CANDIDATOS É POLÍTICA DESTE SCRIPT, e o que é VÁLIDO continua a
 * ser decidido por `nome-de-utilizador.ts`. São perguntas diferentes: uma é
 * "isto pode existir", a outra é "qual é o mais bonito dos que podem".
 *
 * Primeiro o primeiro nome, e só depois nomes maiores. O ensaio mostrou porquê:
 * "roselcy Maria Balbino Caxito Costo" dava `@roselcymariabalbinoc`, cortado a
 * meio de uma palavra aos vinte caracteres. `@roselcy` diz-se ao telefone.
 *
 * Devolve `null` quando o nome não tem letras nenhumas — o responsável tem o
 * nome ".." e daí não sai identificador nenhum. Nesse caso é melhor ficar sem
 * do que receber `@pessoa2`: um identificador feio fica no perfil dele à vista
 * de toda a gente, e ele escolhe melhor do que este script.
 */
async function escolher(displayName: string, tomados: Set<string>): Promise<string | null> {
  const partes = displayName
    .split(/\s+/)
    .map((p) => sugerirNomeDeUtilizador(p))
    .filter((p) => p && !p.startsWith('pessoa'))

  const inteiro = sugerirNomeDeUtilizador(displayName)
  if (!partes.length && inteiro.startsWith('pessoa')) return null

  const candidatos: string[] = []
  if (partes[0]) candidatos.push(partes[0])
  if (partes[1]) candidatos.push(`${partes[0]}${partes[1]}`.slice(0, MAX))
  candidatos.push(inteiro)
  const raiz = (partes[0] ?? inteiro).slice(0, MAX - 3)
  for (let i = 2; i <= 60; i++) candidatos.push(`${raiz}${i}`)

  for (const c of candidatos) {
    if (tomados.has(c)) continue
    if (problemaNoNomeDeUtilizador(c)) continue
    if (await livre(c)) return c
  }
  return null
}

async function main() {
  /*
    SÓ CONTAS VIVAS.

    O ensaio mostrou-o antes de gravar: sem esta condição, cinquenta contas
    apagadas — as de teste, já anonimizadas para "Conta apagada" — levavam
    @contaapagada2 até @contaapagada52 e tomavam esses nomes para sempre. Uma
    conta apagada não é identificada por ninguém e não precisa de morada.
  */
  const sem = await prisma.user.findMany({
    where: { username: null, status: 'ACTIVE' },
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
      console.log(
        `  ✗ "${u.displayName}": daqui não sai identificador. Fica sem, e escolhe o dela.`,
      )
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
