/**
 * Regera targetUrl e SVG de todos os links curtos a partir do ambiente atual.
 *
 * Necessário quando PUBLIC_WEB_URL ou PUBLIC_SHORTLINK_BASE mudam — por
 * exemplo, ao sair de localhost para o domínio real antes do lançamento.
 *
 * ATENÇÃO: o código curto NÃO muda, então QR já impressos continuam válidos
 * desde que o domínio antigo siga redirecionando. Mudar PUBLIC_SHORTLINK_BASE
 * depois de imprimir QR é o único caminho sem volta aqui — decidir o domínio
 * antes do lançamento.
 *
 *   npx tsx packages/db/prisma/regerar-links.ts
 */
import { PrismaClient } from '@prisma/client'
import QRCode from 'qrcode'

const prisma = new PrismaClient()

async function main() {
  const WEB = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const BASE = (process.env.PUBLIC_SHORTLINK_BASE ?? 'http://localhost:3333/r').replace(/\/$/, '')

  const links = await prisma.shortLink.findMany({
    include: {
      content: { select: { slug: true } },
      project: { select: { slug: true } },
    },
  })

  for (const link of links) {
    const targetUrl = link.content
      ? `${WEB}/${link.project.slug}/${link.content.slug}`
      : `${WEB}/`

    // Só links de origem (QR de conteúdo e campanha) carregam SVG; links de
    // compartilhamento são abertos por toque, nunca escaneados.
    const precisaQr = link.kind === 'CONTENT_QR' || link.kind === 'CAMPAIGN'

    await prisma.shortLink.update({
      where: { id: link.id },
      data: {
        targetUrl,
        qrSvg: precisaQr
          ? await QRCode.toString(`${BASE}/${link.code}`, {
              type: 'svg',
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 512,
            })
          : null,
      },
    })
  }

  console.log(`✓ ${links.length} links regerados`)
  console.log(`  destino: ${WEB}/<projeto>/<conteudo>`)
  console.log(`  link curto: ${BASE}/<codigo>`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
