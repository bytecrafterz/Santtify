import { PrismaClient, CardEstado, ContentStatus, BlockType } from '@prisma/client'

/**
 * Abre as letras que já têm cartão pronto e ficaram fechadas.
 *
 * A partir de 25/08 uma letra publica-se sozinha assim que tem o primeiro
 * cartão inteiro. Mas essa regra só corre quando um cartão é guardado, e a
 * Letra B foi preenchida ANTES de a regra existir: ficou com dois cartões
 * prontos e a letra em rascunho, invisível no feed. O cliente publicou duas
 * vezes e as duas não aconteceu nada — do lado dele, com razão, isso é o
 * sistema a ignorá-lo.
 *
 * Isto passa uma vez pelas letras todas e abre as que já mereciam estar
 * abertas. É idempotente: correr outra vez não muda nada.
 *
 * O CONTRÁRIO NÃO ACONTECE. Uma letra publicada sem cartões prontos fica como
 * está — fechá-la aqui apagaria do site conteúdo que alguém pode estar a meio
 * de editar.
 */
const prisma = new PrismaClient()

async function main() {
  const letras = await prisma.content.findMany({
    where: { letra: { not: null }, status: { not: ContentStatus.PUBLISHED } },
    select: {
      id: true,
      letra: true,
      blocks: {
        where: { type: BlockType.AUDIO, estado: CardEstado.PUBLICADO },
        select: { id: true },
      },
    },
  })

  const porAbrir = letras.filter((c) => c.blocks.length > 0)
  for (const c of porAbrir) {
    await prisma.content.update({
      where: { id: c.id },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    })
    console.log(`  Letra ${c.letra} aberta (${c.blocks.length} cartão(ões) pronto(s))`)
  }

  if (porAbrir.length === 0) console.log('  Nenhuma letra fechada tinha cartão pronto.')

  const abertas = await prisma.content.count({
    where: { letra: { not: null }, status: ContentStatus.PUBLISHED },
  })
  console.log(`  letras abertas agora: ${abertas} de 26`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
