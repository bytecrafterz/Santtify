/**
 * Seed do projeto nº 1: Jesus Alfabeto Saudável.
 *
 * Cria a estrutura — projeto, 26 conteúdos, links curtos com QR, metadados e o
 * marco do Dia Zero. O conteúdo real (músicas, áudios, letras, textos, imagens)
 * é cadastrado pelo cliente no painel, como acordado; aqui ficam apenas os
 * blocos vazios prontos para ele preencher.
 *
 * Idempotente: pode rodar quantas vezes for preciso.
 */
import { PrismaClient, Platform, ShortLinkKind, BlockType, ContentStatus } from '@prisma/client'
import { randomBytes } from 'node:crypto'

const prisma = new PrismaClient()

const PROJECT_SLUG = 'jesus-alfabeto-saudavel'
const SHORTLINK_BASE = process.env.PUBLIC_SHORTLINK_BASE ?? 'http://localhost:3000/r'
const WEB_BASE = process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Código curto legível, sem caracteres ambíguos (0/O, 1/l/I). */
function shortCode(length = 7): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

async function main() {
  console.log('→ Projeto')
  const project = await prisma.project.upsert({
    where: { slug: PROJECT_SLUG },
    update: {},
    create: {
      slug: PROJECT_SLUG,
      name: 'Jesus Alfabeto Saudável',
      description:
        'Projeto educacional infantil — 26 letras, cada uma com QR Code próprio. ' +
        'Primeira vitrine da tecnologia Produto Vivo.',
      status: 'ACTIVE',
      branding: {
        primaryColor: '#2563eb',
        // Preenchido quando o cliente enviar a arte e os mockups.
        logoUrl: null,
      },
    },
  })

  console.log('→ 26 conteúdos (letras), com QR Code gerado automaticamente')
  for (const [index, letter] of LETTERS.entries()) {
    const slug = letter.toLowerCase()

    const content = await prisma.content.upsert({
      where: { projectId_slug: { projectId: project.id, slug } },
      update: {},
      create: {
        projectId: project.id,
        slug,
        title: `Letra ${letter}`,
        position: index + 1,
        status: ContentStatus.DRAFT, // publicado quando o cliente subir o conteúdo
        metadata: {
          create: {
            format: 'pagina-letra',
            theme: 'alfabeto',
            attributes: { letra: letter },
          },
        },
        stats: { create: {} },
      },
    })

    // Blocos vazios, na ordem que o cliente descreveu: música, áudio,
    // letra da música e conteúdo educativo. São blocos genéricos — o cliente
    // pode reordenar, remover ou acrescentar pelo painel.
    const existingBlocks = await prisma.contentBlock.count({ where: { contentId: content.id } })
    if (existingBlocks === 0) {
      await prisma.contentBlock.createMany({
        data: [
          { contentId: content.id, position: 1, type: BlockType.AUDIO, label: 'Música' },
          { contentId: content.id, position: 2, type: BlockType.AUDIO, label: 'Áudio' },
          { contentId: content.id, position: 3, type: BlockType.RICH_TEXT, label: 'Letra da música' },
          { contentId: content.id, position: 4, type: BlockType.RICH_TEXT, label: 'Conteúdo educativo' },
        ],
      })
    }

    // QR Code do conteúdo. Raiz da própria cadeia: depth 0, root aponta p/ si.
    const existingQr = await prisma.shortLink.findFirst({
      where: { contentId: content.id, kind: ShortLinkKind.CONTENT_QR },
    })
    if (!existingQr) {
      const link = await prisma.shortLink.create({
        data: {
          projectId: project.id,
          code: shortCode(),
          kind: ShortLinkKind.CONTENT_QR,
          contentId: content.id,
          targetUrl: `${WEB_BASE}/${PROJECT_SLUG}/${slug}`,
          depth: 0,
          rootPlatform: Platform.QR_CODE,
        },
      })
      await prisma.shortLink.update({
        where: { id: link.id },
        data: { rootShortLinkId: link.id },
      })
    }
  }

  console.log('→ Marco Dia Zero')
  // Números informados pelo cliente. Ficam registrados como linha de base para
  // a curva de crescimento ter um ponto de partida real na apresentação.
  const diaZero = [
    { platform: Platform.INSTAGRAM, followers: 200 },
    { platform: Platform.TIKTOK, followers: 40 },
    { platform: Platform.YOUTUBE, followers: 0 },
    { platform: Platform.PRODUTO_VIVO, followers: 0 },
  ]

  for (const row of diaZero) {
    await prisma.baselineSnapshot.upsert({
      where: {
        projectId_label_platform: {
          projectId: project.id,
          label: 'Dia Zero',
          platform: row.platform,
        },
      },
      update: {},
      create: {
        projectId: project.id,
        label: 'Dia Zero',
        platform: row.platform,
        followers: row.followers,
        // Substituir pela data real de lançamento quando definida.
        capturedAt: project.createdAt,
        notes: 'Linha de base informada pelo cliente. Sem mídia paga.',
      },
    })
  }

  const counts = {
    conteudos: await prisma.content.count({ where: { projectId: project.id } }),
    qrCodes: await prisma.shortLink.count({
      where: { projectId: project.id, kind: ShortLinkKind.CONTENT_QR },
    }),
    blocos: await prisma.contentBlock.count(),
    baseline: await prisma.baselineSnapshot.count({ where: { projectId: project.id } }),
  }
  console.log('\n✓ Seed concluído:', counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
