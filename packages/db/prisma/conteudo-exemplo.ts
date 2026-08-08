/**
 * Publica algumas letras com conteúdo de EXEMPLO.
 *
 * Serve para o cliente ver o produto funcionando antes de enviar o material
 * dele — escanear o QR pelo celular e navegar. O conteúdo real substitui isto
 * pelo painel; nada aqui é definitivo.
 *
 * Idempotente. Para desfazer:
 *   npx tsx packages/db/prisma/conteudo-exemplo.ts --limpar
 */
import { PrismaClient, BlockType, ContentStatus, MediaKind } from '@prisma/client'

const prisma = new PrismaClient()
const PROJETO = 'jesus-alfabeto-saudavel'
const LETRAS_EXEMPLO = ['a', 'b', 'c']

/** Áudio curto de domínio público, só para o player ter o que tocar. */
const AUDIO_EXEMPLO = 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg'

const TEXTOS: Record<string, { letra: string; educativo: string; palavra: string }> = {
  a: {
    palavra: 'Amor',
    letra: 'A de Amor,\nO amor é paciente,\nO amor é bondade,\nA de Amor pra toda vida.',
    educativo:
      'A letra A é a primeira do alfabeto. É uma vogal, e vogais são as letras que a gente ' +
      'consegue cantar sem fechar a boca. Experimente: aaaaaa!',
  },
  b: {
    palavra: 'Bondade',
    letra: 'B de Bondade,\nFazer o bem sem olhar a quem,\nB de Bondade,\nQue mora no coração.',
    educativo:
      'A letra B é uma consoante. Para falar o B, a gente junta os lábios e solta o ar de ' +
      'uma vez. Coloque a mão na frente da boca e sinta o sopro: bê!',
  },
  c: {
    palavra: 'Caridade',
    letra: 'C de Caridade,\nDividir o que a gente tem,\nC de Caridade,\nÉ cuidar de alguém também.',
    educativo:
      'A letra C tem dois sons diferentes. Em "casa" ela soa como K, e em "cidade" ela soa ' +
      'como S. Quem manda no som é a letra que vem logo depois dela.',
  },
}

async function limpar() {
  const projeto = await prisma.project.findUnique({ where: { slug: PROJETO } })
  if (!projeto) return
  const conteudos = await prisma.content.findMany({
    where: { projectId: projeto.id, slug: { in: LETRAS_EXEMPLO } },
    select: { id: true },
  })
  const ids = conteudos.map((c) => c.id)

  await prisma.contentBlock.updateMany({
    where: { contentId: { in: ids } },
    data: { text: null, assetId: null },
  })
  await prisma.content.updateMany({
    where: { id: { in: ids } },
    data: { status: ContentStatus.DRAFT, subtitle: null, summary: null, publishedAt: null },
  })
  await prisma.mediaAsset.deleteMany({ where: { title: 'Áudio de exemplo' } })
  console.log('✓ Conteúdo de exemplo removido. As letras voltaram para rascunho.')
}

async function popular() {
  const projeto = await prisma.project.findUnique({ where: { slug: PROJETO } })
  if (!projeto) throw new Error('Projeto não encontrado. Rode o seed primeiro.')

  let audio = await prisma.mediaAsset.findFirst({ where: { title: 'Áudio de exemplo' } })
  if (!audio) {
    audio = await prisma.mediaAsset.create({
      data: {
        kind: MediaKind.AUDIO,
        url: AUDIO_EXEMPLO,
        mimeType: 'audio/ogg',
        title: 'Áudio de exemplo',
      },
    })
  }

  for (const slug of LETRAS_EXEMPLO) {
    const texto = TEXTOS[slug]
    const conteudo = await prisma.content.update({
      where: { projectId_slug: { projectId: projeto.id, slug } },
      data: {
        subtitle: `${slug.toUpperCase()} de ${texto.palavra}`,
        summary: `Aprenda a letra ${slug.toUpperCase()} com música e conteúdo educativo.`,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: { blocks: { orderBy: { position: 'asc' } } },
    })

    for (const bloco of conteudo.blocks) {
      const dados =
        bloco.type === BlockType.AUDIO
          ? { assetId: audio.id }
          : bloco.label === 'Letra da música'
            ? { text: texto.letra }
            : bloco.label === 'Conteúdo educativo'
              ? { text: texto.educativo }
              : {}
      if (Object.keys(dados).length) {
        await prisma.contentBlock.update({ where: { id: bloco.id }, data: dados })
      }
    }

    const link = await prisma.shortLink.findFirst({
      where: { contentId: conteudo.id, kind: 'CONTENT_QR' },
      select: { code: true },
    })
    console.log(`  ${slug.toUpperCase()} publicada — QR /r/${link?.code}`)
  }

  console.log(`\n✓ ${LETRAS_EXEMPLO.length} letras publicadas com conteúdo de exemplo.`)
}

const acao = process.argv.includes('--limpar') ? limpar : popular
acao()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
