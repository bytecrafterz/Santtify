/**
 * Zera a operação para o Dia Zero de verdade, no dia do lançamento.
 *
 * POR QUE ISTO EXISTE, e por que `dados-demonstracao.ts --limpar` não basta:
 * aquele script remove só os visitantes marcados com `demo_`. Todo acesso feito
 * de um navegador de verdade durante o desenvolvimento — teste meu, teste do
 * cliente, alguém abrindo o link para ver — cria visitante e evento comuns, sem
 * marca nenhuma, e sobrevive à limpeza.
 *
 * Isso importa mais aqui do que num projeto normal. A tese comercial inteira do
 * Produto Vivo é "começamos do zero, e esta é a curva". Se o Dia Zero começar
 * com tráfego de teste dentro, o número está errado para sempre: o log é
 * append-only de propósito, e ninguém vai saber depois quais eventos eram reais.
 *
 * O QUE É APAGADO: eventos, visitantes, sessões, consentimentos, curtidas,
 * comentários, compartilhamentos, publicações, contas que não são de
 * administrador, e as métricas diárias derivadas.
 *
 * O QUE É PRESERVADO, e por quê:
 *
 *   - **os QR Codes (`CONTENT_QR`)** — o código impresso aponta para eles.
 *     Apagar e regerar invalidaria todo o material já impresso. Esta é a linha
 *     que nunca pode ser cruzada.
 *   - conteúdos, blocos e mídia — é o produto;
 *   - contas de administrador — é o acesso do dono;
 *   - o marco do Dia Zero (`BaselineSnapshot`) — são os números das redes dele.
 *
 * Pede confirmação explícita, porque é destrutivo e irreversível.
 *
 *   npx tsx packages/db/prisma/preparar-lancamento.ts            # só mostra
 *   npx tsx packages/db/prisma/preparar-lancamento.ts --executar # apaga
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const EXECUTAR = process.argv.includes('--executar')

async function main() {
  const antes = {
    eventos: await prisma.event.count(),
    visitantes: await prisma.visitor.count(),
    sessoes: await prisma.visitSession.count(),
    contasComuns: await prisma.user.count({ where: { role: 'USER' } }),
    comentarios: await prisma.comment.count(),
    curtidas: await prisma.reaction.count(),
    compartilhamentos: await prisma.share.count(),
    publicacoes: await prisma.post.count(),
    linksDeCompartilhamento: await prisma.shortLink.count({ where: { kind: 'SHARE' } }),
    metricasDiarias: await prisma.dailyMetric.count(),
  }

  const preservado = {
    conteudos: await prisma.content.count(),
    qrCodes: await prisma.shortLink.count({ where: { kind: 'CONTENT_QR' } }),
    campanhas: await prisma.shortLink.count({ where: { kind: 'CAMPAIGN' } }),
    administradores: await prisma.user.count({ where: { role: 'ADMIN' } }),
    marcoDiaZero: await prisma.baselineSnapshot.count(),
  }

  console.log('\nSERÁ APAGADO')
  console.table(antes)
  console.log('SERÁ PRESERVADO')
  console.table(preservado)

  if (!EXECUTAR) {
    console.log(
      '\nNada foi apagado. Para executar de verdade:\n' +
        '  npx tsx packages/db/prisma/preparar-lancamento.ts --executar\n',
    )
    return
  }

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  const idsAdmin = admins.map((a) => a.id)

  await prisma.$transaction(async (tx) => {
    // A ordem é imposta pelas chaves RESTRICT da atribuição: o que aponta sai
    // antes do que é apontado.
    await tx.$executeRawUnsafe(`SET LOCAL pv.allow_event_purge = 'on'`)
    await tx.event.deleteMany({})
    await tx.share.deleteMany({})
    await tx.reaction.deleteMany({})
    await tx.comment.deleteMany({})
    await tx.post.deleteMany({})
    await tx.consent.deleteMany({})
    await tx.visitSession.deleteMany({})

    // Só os links de compartilhamento. Os QR dos conteúdos ficam: o papel
    // impresso aponta para eles.
    await tx.shortLink.deleteMany({ where: { kind: 'SHARE' } })

    await tx.visitor.deleteMany({})
    await tx.refreshToken.deleteMany({ where: { userId: { notIn: idsAdmin } } })
    await tx.adminAuditLog.deleteMany({ where: { userId: { notIn: idsAdmin } } })
    await tx.mediaAsset.updateMany({
      where: { uploadedById: { notIn: idsAdmin } },
      data: { uploadedById: null },
    })
    await tx.user.deleteMany({ where: { role: 'USER' } })
    await tx.dailyMetric.deleteMany({})

    // Os contadores por conteúdo são cache do que foi apagado: voltam a zero,
    // menos as visualizações, que também vinham dos eventos.
    await tx.contentStats.updateMany({
      data: { views: 0, likes: 0, comments: 0, shares: 0 },
    })
  })

  const depois = {
    eventos: await prisma.event.count(),
    visitantes: await prisma.visitor.count(),
    contasComuns: await prisma.user.count({ where: { role: 'USER' } }),
    qrCodesIntactos: await prisma.shortLink.count({ where: { kind: 'CONTENT_QR' } }),
    conteudosIntactos: await prisma.content.count(),
    administradoresIntactos: await prisma.user.count({ where: { role: 'ADMIN' } }),
  }
  console.log('\nDEPOIS')
  console.table(depois)

  const ok =
    depois.eventos === 0 &&
    depois.visitantes === 0 &&
    depois.contasComuns === 0 &&
    depois.qrCodesIntactos === preservado.qrCodes &&
    depois.conteudosIntactos === preservado.conteudos &&
    depois.administradoresIntactos === preservado.administradores

  console.log(
    ok
      ? '\n✓ Operação zerada. Os QR Codes e o conteúdo continuam intactos.\n' +
          '  Falta carimbar o Dia Zero: defina `launchedAt` do projeto na data do lançamento.\n'
      : '\n✗ Algo não bateu. Confira a tabela acima antes de lançar.\n',
  )
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
