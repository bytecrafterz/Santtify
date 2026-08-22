import { PrismaClient } from '@prisma/client'

/**
 * Carimba a letra de cada conteúdo, uma vez.
 *
 * Até aqui a grade era montada pela posição, e por isso bastou existir uma
 * introdução para o A cair no lugar do B. A letra passa a ser uma propriedade
 * do conteúdo, e não do sítio onde ele calha estar na lista.
 *
 * A regra de leitura é conservadora: só carimba quando o título começa por
 * "Letra X" ou por uma letra isolada seguida de espaço ("A de Amor"). O que
 * não encaixar fica sem letra e não entra na contagem das 26 — é o caso da
 * introdução, e é o que se quer.
 *
 * Idempotente: correr de novo não muda nada do que já estiver certo.
 */
const prisma = new PrismaClient()

function letraDoTitulo(titulo: string): string | null {
  const t = titulo.trim()
  const comPrefixo = t.match(/^letra\s+([A-Za-zÇç])/i)
  if (comPrefixo) return comPrefixo[1].toUpperCase()
  const isolada = t.match(/^([A-Za-z])\s+de\s+/i)
  if (isolada) return isolada[1].toUpperCase()
  return null
}

async function main() {
  const conteudos = await prisma.content.findMany({
    orderBy: { position: 'asc' },
    select: { id: true, title: true, slug: true, letra: true },
  })

  let carimbados = 0
  let semLetra = 0

  for (const c of conteudos) {
    const letra = letraDoTitulo(c.title)
    if (letra === c.letra) continue
    if (!letra) {
      semLetra++
      console.log(`  sem letra (fica fora das 26): "${c.title}"`)
      continue
    }
    await prisma.content.update({ where: { id: c.id }, data: { letra } })
    carimbados++
    console.log(`  ${letra} ← "${c.title}"`)
  }

  console.log(`\n  carimbados: ${carimbados} | fora da contagem: ${semLetra}`)
}

main()
  .catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
