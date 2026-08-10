/**
 * Popula uma operação simulada para o cliente ver o painel de métricas com
 * números que fazem sentido, antes de o produto estar no ar.
 *
 * NÃO é dado real e não deve existir em produção. O script marca cada
 * visitante criado com um prefixo próprio no `anonId`, e o `--limpar` remove
 * exatamente esses — nunca dado de operação verdadeira.
 *
 *   npx tsx packages/db/prisma/dados-demonstracao.ts
 *   npx tsx packages/db/prisma/dados-demonstracao.ts --limpar
 */
import { PrismaClient, EventType, Platform, ShortLinkKind } from '@prisma/client'
import { randomBytes } from 'node:crypto'

const prisma = new PrismaClient()
const PROJETO = 'jesus-alfabeto-saudavel'
const MARCA = 'demo_'

/** Perfil de aquisição por plataforma: quantos chegam e quanto convertem. */
const CANAIS: Array<{ plataforma: Platform; visitantes: number; conversao: number; partilha: number }> = [
  { plataforma: Platform.INSTAGRAM, visitantes: 180, conversao: 0.22, partilha: 0.35 },
  { plataforma: Platform.TIKTOK, visitantes: 95, conversao: 0.18, partilha: 0.45 },
  { plataforma: Platform.QR_CODE, visitantes: 60, conversao: 0.40, partilha: 0.30 },
  { plataforma: Platform.YOUTUBE, visitantes: 25, conversao: 0.30, partilha: 0.15 },
  { plataforma: Platform.DIRECT, visitantes: 18, conversao: 0.15, partilha: 0.05 },
]

const DIAS = 30
const aleatorio = (n: number) => Math.floor(Math.random() * n)

async function limpar() {
  const visitantes = await prisma.visitor.findMany({
    where: { anonId: { startsWith: MARCA } },
    select: { id: true, userId: true },
  })
  const ids = visitantes.map((v) => v.id)
  const users = visitantes.map((v) => v.userId).filter((u): u is string => Boolean(u))

  // Ordem imposta pelas chaves RESTRICT: o que referencia sai primeiro.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL pv.allow_event_purge = 'on'`)
    await tx.event.deleteMany({ where: { visitorId: { in: ids } } })
    await tx.visitor.deleteMany({ where: { id: { in: ids } } })
    if (users.length) {
      await tx.share.deleteMany({ where: { userId: { in: users } } })
      await tx.comment.deleteMany({ where: { userId: { in: users } } })
      await tx.reaction.deleteMany({ where: { userId: { in: users } } })
      await tx.shortLink.deleteMany({ where: { createdByUserId: { in: users } } })
      await tx.user.deleteMany({ where: { id: { in: users } } })
    }
  })
  console.log(`✓ ${ids.length} visitantes de demonstração removidos.`)
}

async function popular() {
  const projeto = await prisma.project.findUnique({ where: { slug: PROJETO } })
  if (!projeto) throw new Error('Projeto não encontrado. Rode o seed primeiro.')

  const conteudos = await prisma.content.findMany({
    where: { projectId: projeto.id, status: 'PUBLISHED' },
    select: { id: true },
  })
  if (!conteudos.length) throw new Error('Publique conteúdo antes (conteudo-exemplo.ts).')

  const raizes = new Map<Platform, string>()
  for (const canal of CANAIS) {
    const link = await prisma.shortLink.create({
      data: {
        projectId: projeto.id,
        code: `${MARCA}${randomBytes(4).toString('hex')}`,
        kind: ShortLinkKind.CAMPAIGN,
        targetUrl: 'http://localhost:3100/',
        depth: 0,
        rootPlatform: canal.plataforma,
      },
    })
    await prisma.shortLink.update({ where: { id: link.id }, data: { rootShortLinkId: link.id } })
    raizes.set(canal.plataforma, link.id)
  }

  let totalVisitantes = 0
  let totalCadastros = 0
  let totalPartilhas = 0

  for (const canal of CANAIS) {
    for (let i = 0; i < canal.visitantes; i++) {
      const diasAtras = aleatorio(DIAS)
      const quando = new Date(Date.now() - diasAtras * 86400_000 - aleatorio(86400_000))
      const raiz = raizes.get(canal.plataforma)!

      const visitor = await prisma.visitor.create({
        data: {
          projectId: projeto.id,
          anonId: `${MARCA}${randomBytes(10).toString('hex')}`,
          firstSeenAt: quando,
          lastSeenAt: quando,
          firstTouchPlatform: canal.plataforma,
          lastTouchPlatform: canal.plataforma,
          rootPlatform: canal.plataforma,
          rootLinkId: raiz,
          acquiredViaLinkId: raiz,
          chainDepth: 0,
          consentStatus: 'GRANTED',
          consentAt: quando,
        },
      })
      totalVisitantes++

      const atrib = {
        projectId: projeto.id,
        visitorId: visitor.id,
        platform: canal.plataforma,
        rootPlatform: canal.plataforma,
        rootShortLinkId: raiz,
        shortLinkId: raiz,
        chainDepth: 0,
        occurredAt: quando,
      }

      await prisma.event.create({ data: { ...atrib, type: EventType.SESSION_START } })
      const vistos = 1 + aleatorio(3)
      for (let v = 0; v < vistos; v++) {
        await prisma.event.create({
          data: {
            ...atrib,
            type: EventType.CONTENT_VIEW,
            contentId: conteudos[aleatorio(conteudos.length)].id,
          },
        })
      }

      if (Math.random() >= canal.conversao) continue

      const user = await prisma.user.create({
        data: {
          email: `${MARCA}${randomBytes(6).toString('hex')}@demo.local`,
          passwordHash: 'demo',
          displayName: `Visitante ${totalCadastros + 1}`,
          createdAt: quando,
        },
      })
      await prisma.visitor.update({ where: { id: visitor.id }, data: { userId: user.id } })
      await prisma.event.create({
        data: { ...atrib, type: EventType.SIGNUP, userId: user.id },
      })
      totalCadastros++

      if (Math.random() >= canal.partilha) continue

      // Quem compartilha estende a cadeia: o link herda a raiz e soma 1.
      const conteudo = conteudos[aleatorio(conteudos.length)]
      const partilha = await prisma.shortLink.create({
        data: {
          projectId: projeto.id,
          code: `${MARCA}${randomBytes(5).toString('hex')}`,
          kind: ShortLinkKind.SHARE,
          contentId: conteudo.id,
          createdByUserId: user.id,
          channel: Math.random() > 0.4 ? Platform.WHATSAPP : Platform.INSTAGRAM,
          parentShortLinkId: raiz,
          rootShortLinkId: raiz,
          rootPlatform: canal.plataforma,
          depth: 1,
          targetUrl: 'http://localhost:3100/',
        },
      })
      await prisma.share.create({
        data: { userId: user.id, shortLinkId: partilha.id, channel: partilha.channel!, createdAt: quando },
      })
      await prisma.event.create({
        data: { ...atrib, type: EventType.SHARE_CREATED, userId: user.id, contentId: conteudo.id },
      })
      totalPartilhas++

      // Cada partilha traz de 0 a 3 pessoas novas — a propagação de verdade.
      const trazidos = aleatorio(4)
      for (let k = 0; k < trazidos; k++) {
        const depois = new Date(quando.getTime() + aleatorio(3 * 86400_000))
        const filho = await prisma.visitor.create({
          data: {
            projectId: projeto.id,
            anonId: `${MARCA}${randomBytes(10).toString('hex')}`,
            firstSeenAt: depois,
            lastSeenAt: depois,
            firstTouchPlatform: partilha.channel,
            lastTouchPlatform: partilha.channel,
            rootPlatform: canal.plataforma, // a raiz é a plataforma original
            rootLinkId: raiz,
            acquiredViaLinkId: partilha.id,
            referredByUserId: user.id,
            chainDepth: 1,
            consentStatus: 'GRANTED',
            consentAt: depois,
          },
        })
        totalVisitantes++

        const atribFilho = {
          projectId: projeto.id,
          visitorId: filho.id,
          platform: partilha.channel,
          rootPlatform: canal.plataforma,
          rootShortLinkId: raiz,
          shortLinkId: partilha.id,
          parentShortLinkId: raiz,
          chainDepth: 1,
          occurredAt: depois,
        }
        await prisma.event.create({ data: { ...atribFilho, type: EventType.SHARE_LINK_CLICKED } })
        await prisma.event.create({ data: { ...atribFilho, type: EventType.SESSION_START } })
        await prisma.event.create({
          data: { ...atribFilho, type: EventType.CONTENT_VIEW, contentId: conteudo.id },
        })

        if (Math.random() < 0.3) {
          const u2 = await prisma.user.create({
            data: {
              email: `${MARCA}${randomBytes(6).toString('hex')}@demo.local`,
              passwordHash: 'demo',
              displayName: `Convidado ${totalCadastros + 1}`,
              createdAt: depois,
            },
          })
          await prisma.visitor.update({ where: { id: filho.id }, data: { userId: u2.id } })
          await prisma.event.create({
            data: { ...atribFilho, type: EventType.SIGNUP, userId: u2.id },
          })
          totalCadastros++
        }
      }
    }
  }

  console.log(`\n✓ Demonstração criada:`)
  console.log(`  ${totalVisitantes} visitantes`)
  console.log(`  ${totalCadastros} cadastros`)
  console.log(`  ${totalPartilhas} compartilhamentos`)
  console.log(`\n  Remover depois:  npx tsx packages/db/prisma/dados-demonstracao.ts --limpar`)
}

const acao = process.argv.includes('--limpar') ? limpar : popular
acao()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
