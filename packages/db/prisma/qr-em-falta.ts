import { PrismaClient, ShortLinkKind, Platform } from '@prisma/client'
import { toString as qrParaSvg } from 'qrcode'
import { randomBytes } from 'node:crypto'

/**
 * Dá QR Code aos conteúdos que ficaram sem ele.
 *
 * Cada letra recebe um QR no momento em que é criada, para o cliente poder
 * mandar imprimir o material antes de acabar de preencher o conteúdo. Isso
 * sempre funcionou pelo painel.
 *
 * O que não funcionou foram as portas que eu abri depois. Criei as 26 letras
 * por script e o Produto Vivo por código, e nenhum dos dois passou pelo caminho
 * que gera o QR. A Letra B ficou sem QR nenhum, e só se soube porque o cliente
 * perguntou como é que aquilo funcionava.
 *
 * Idempotente: quem já tem QR não recebe outro, e o código de quem já tem nunca
 * muda — um QR impresso não se corrige depois.
 */
const prisma = new PrismaClient()

async function codigoUnico(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomBytes(6).toString('base64url').slice(0, 7)
    const existe = await prisma.shortLink.findUnique({ where: { code } })
    if (!existe) return code
  }
  throw new Error('Não consegui gerar um código livre.')
}

async function main() {
  const base = process.env.PUBLIC_SHORTLINK_BASE ?? 'https://santtify.com/r'
  const web = process.env.PUBLIC_WEB_URL ?? 'https://santtify.com'

  const semQr = await prisma.content.findMany({
    where: { shortLink: { none: { kind: ShortLinkKind.CONTENT_QR, active: true } } },
    select: { id: true, slug: true, letra: true, title: true, projectId: true,
              project: { select: { slug: true } } },
  })

  if (semQr.length === 0) {
    console.log('  Todos os conteúdos já têm QR Code.')
    return
  }

  for (const c of semQr) {
    const code = await codigoUnico()
    await prisma.shortLink.create({
      data: {
        projectId: c.projectId,
        code,
        kind: ShortLinkKind.CONTENT_QR,
        contentId: c.id,
        targetUrl: `${web}/${c.project.slug}/${c.slug}`,
        depth: 0,
        rootPlatform: Platform.QR_CODE,
        qrSvg: await qrParaSvg(`${base}/${code}`, { type: 'svg', margin: 1, width: 512 }),
      },
    })
    console.log(`  ${c.letra ?? c.title}: QR criado (${code})`)
  }

  const total = await prisma.shortLink.count({ where: { kind: ShortLinkKind.CONTENT_QR, active: true } })
  console.log(`  conteúdos com QR: ${total}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
