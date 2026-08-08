/**
 * Verificação da camada de coleta.
 *
 * Simula EXATAMENTE o cenário que o cliente descreveu e responde, com consultas
 * reais sobre o banco, as perguntas que ele quer poder fazer daqui a seis meses.
 *
 *   Instagram → Usuário A → Produto Vivo → WhatsApp → Usuário B
 *   Usuário B → Usuário C → Usuários D, E, F
 *
 * Serve como prova de que a promessa "a Fase 2 não exige refazer o banco" é
 * verdadeira: todas as consultas abaixo rodam sobre o schema da Fase 1.
 *
 * Cria um projeto isolado, roda o cenário, imprime os resultados e limpa tudo.
 * Não toca nos dados reais.
 *
 *   npx tsx packages/db/prisma/verificar-propagacao.ts
 */
import { PrismaClient, Platform, ShortLinkKind, EventType, Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'

const prisma = new PrismaClient()
const SLUG = '__verificacao_propagacao__'

const code = () => randomBytes(6).toString('hex')
const brl = (v: Prisma.Decimal | number | null) => `R$ ${Number(v ?? 0).toFixed(2)}`

async function main() {
  await limpar()

  // ─── Montagem do cenário ──────────────────────────────────────────
  const project = await prisma.project.create({
    data: { slug: SLUG, name: 'Verificação', status: 'ACTIVE' },
  })

  const conteudo = await prisma.content.create({
    data: { projectId: project.id, slug: 'letra-b', title: 'Letra B', status: 'PUBLISHED' },
  })

  // Campanha: Instagram, Vídeo 03 — o identificador próprio por publicação.
  const campanha = await prisma.campaign.create({
    data: {
      projectId: project.id,
      code: code(),
      platform: Platform.INSTAGRAM,
      name: 'Vídeo 03',
      format: 'reel',
      theme: 'lançamento',
      cta: 'Escaneie o QR',
      testVariant: 'A',
    },
  })

  // Uma campanha do TikTok, para responder à pergunta cruzada do cliente.
  const campanhaTikTok = await prisma.campaign.create({
    data: {
      projectId: project.id,
      code: code(),
      platform: Platform.TIKTOK,
      name: 'Vídeo TikTok 01',
      format: 'short',
    },
  })

  const linkCampanha = await criarLinkRaiz(project.id, campanha.id, Platform.INSTAGRAM)
  const linkTikTok = await criarLinkRaiz(project.id, campanhaTikTok.id, Platform.TIKTOK)

  // Passo 1 e 2 — A chega pelo Instagram e se cadastra.
  const A = await chegarECadastrar('Ana', project.id, linkCampanha, null)

  // Passo 3 e 4 — A compartilha pelo WhatsApp, B chega por esse link.
  const shareA = await compartilhar(project.id, conteudo.id, A, linkCampanha, Platform.WHATSAPP)
  const B = await chegarECadastrar('Bruno', project.id, shareA, A)

  // Passo 5 — B compartilha, C chega.
  const shareB = await compartilhar(project.id, conteudo.id, B, shareA, Platform.WHATSAPP)
  const C = await chegarECadastrar('Carla', project.id, shareB, B)

  // Passo 6 — C compartilha, D, E e F chegam.
  const shareC = await compartilhar(project.id, conteudo.id, C, shareB, Platform.FACEBOOK)
  const D = await chegarECadastrar('Diego', project.id, shareC, C)
  const E = await chegarECadastrar('Elza', project.id, shareC, C)
  await chegarECadastrar('Fábio', project.id, shareC, C)

  // Uma pessoa vinda do TikTok, que compartilha pelo WhatsApp e cuja
  // "afilhada" compra — é literalmente a pergunta que o cliente formulou.
  const T = await chegarECadastrar('Tiago', project.id, linkTikTok, null)
  const shareT = await compartilhar(project.id, conteudo.id, T, linkTikTok, Platform.WHATSAPP)
  const U = await chegarECadastrar('Úrsula', project.id, shareT, T)

  // Compras. Na Fase 1 nenhum evento destes é gerado pela aplicação — os campos
  // existem e é isso que a Fase 2 vai preencher via webhook do checkout externo.
  await comprar(U, 199.9) // veio do TikTok via compartilhamento
  await comprar(D, 89.9) // cadeia do Instagram, profundidade 3
  await comprar(E, 60.0) // cadeia do Instagram, profundidade 3

  // ─── As perguntas do cliente, respondidas por consulta ────────────
  console.log('\n═══ PERGUNTAS DO CLIENTE, RESPONDIDAS SOBRE O SCHEMA DA FASE 1 ═══\n')

  // 1. "Instagram → Vídeo 03 → X visitas → Y cadastros → Z compras"
  const funil = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(*) FILTER (WHERE type = 'SESSION_START')      AS visitas,
      COUNT(*) FILTER (WHERE type = 'SIGNUP')             AS cadastros,
      COUNT(*) FILTER (WHERE type = 'PURCHASE_COMPLETED') AS compras,
      COALESCE(SUM(value) FILTER (WHERE type = 'PURCHASE_COMPLETED'), 0) AS faturamento
    FROM events
    WHERE "projectId" = ${project.id}::uuid
      AND "rootPlatform" = 'INSTAGRAM'`
  const f = funil[0]
  console.log('1) Funil da cadeia originada no Instagram / Vídeo 03')
  console.log(
    `   ${f.visitas} visitas → ${f.cadastros} cadastros → ${f.compras} compras → ${brl(f.faturamento)}\n`,
  )

  // 2. A pergunta textual do cliente:
  //    "Dos usuários que vieram do TikTok, quantos compartilharam pelo WhatsApp
  //     e quantas dessas pessoas posteriormente compraram?"
  const tiktok = await prisma.$queryRaw<any[]>`
    WITH vindos_do_tiktok AS (
      SELECT DISTINCT v."userId"
      FROM visitors v
      WHERE v."projectId" = ${project.id}::uuid
        AND v."rootPlatform" = 'TIKTOK'
        AND v."userId" IS NOT NULL
    ),
    compartilharam_whatsapp AS (
      SELECT DISTINCT s."userId", sl.id AS link_id
      FROM shares s
      JOIN short_links sl ON sl.id = s."shortLinkId"
      WHERE s.channel = 'WHATSAPP'
        AND s."userId" IN (SELECT "userId" FROM vindos_do_tiktok)
    )
    SELECT
      (SELECT COUNT(*) FROM vindos_do_tiktok)                       AS usuarios_tiktok,
      (SELECT COUNT(DISTINCT "userId") FROM compartilharam_whatsapp) AS compartilharam,
      (SELECT COUNT(DISTINCT e."userId")
         FROM events e
        WHERE e.type = 'PURCHASE_COMPLETED'
          AND e."shortLinkId" IN (SELECT link_id FROM compartilharam_whatsapp)) AS compradores_gerados,
      (SELECT COALESCE(SUM(e.value), 0)
         FROM events e
        WHERE e.type = 'PURCHASE_COMPLETED'
          AND e."shortLinkId" IN (SELECT link_id FROM compartilharam_whatsapp)) AS faturamento_gerado`
  const t = tiktok[0]
  console.log('2) "Dos que vieram do TikTok, quantos compartilharam por WhatsApp')
  console.log('    e quantas dessas pessoas compraram?"')
  console.log(
    `   ${t.usuarios_tiktok} vieram do TikTok · ${t.compartilharam} compartilharam por WhatsApp ` +
      `· ${t.compradores_gerados} compras geradas · ${brl(t.faturamento_gerado)}\n`,
  )

  // 3. "Quanto dinheiro a cadeia iniciada por esta pessoa gerou"
  //    Ana nunca comprou. A cadeia dela, sim.
  const cadeia = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(DISTINCT v.id)                                          AS pessoas_na_cadeia,
      COUNT(DISTINCT e.id) FILTER (WHERE e.type = 'PURCHASE_COMPLETED') AS compras,
      COALESCE(SUM(e.value) FILTER (WHERE e.type = 'PURCHASE_COMPLETED'), 0) AS faturamento
    FROM visitors v
    LEFT JOIN events e ON e."visitorId" = v.id
    WHERE v."rootLinkId" = ${linkCampanha.id}::uuid
      AND v."chainDepth" > 0`
  const c = cadeia[0]
  const anaComprou = await prisma.event.count({
    where: { userId: A.userId, type: EventType.PURCHASE_COMPLETED },
  })
  console.log('3) "Esta pessoa nunca comprou — quanto a cadeia dela gerou?"')
  console.log(
    `   Ana: ${anaComprou} compras próprias · cadeia com ${c.pessoas_na_cadeia} pessoas ` +
      `· ${c.compras} compras · ${brl(c.faturamento)}\n`,
  )

  // 4. Árvore de propagação — reconstruída, sem que a tela exista.
  const arvore = await prisma.$queryRaw<any[]>`
    WITH RECURSIVE cadeia AS (
      SELECT v.id, u."displayName" AS nome, v."chainDepth",
             u."displayName"::text AS caminho
      FROM visitors v
      JOIN users u ON u.id = v."userId"
      WHERE v."projectId" = ${project.id}::uuid AND v."chainDepth" = 0

      UNION ALL

      SELECT v.id, u."displayName", v."chainDepth",
             (c.caminho || ' → ' || u."displayName")::text
      FROM visitors v
      JOIN users u ON u.id = v."userId"
      JOIN cadeia c ON v."referredByUserId" = (
        SELECT "userId" FROM visitors WHERE id = c.id
      )
      WHERE v."projectId" = ${project.id}::uuid
    )
    SELECT "chainDepth", caminho FROM cadeia ORDER BY caminho`
  console.log('4) Árvore de propagação reconstruída (a visualização é Fase 2):')
  for (const row of arvore) {
    console.log(`   ${'  '.repeat(row.chainDepth)}${row.caminho}`)
  }

  // 5. Qualidade da aquisição — a métrica que o cliente destacou como
  //    "muito importante": quantos usuários cada plataforma gerou por propagação.
  const qualidade = await prisma.$queryRaw<any[]>`
    SELECT
      "rootPlatform"                                        AS plataforma,
      COUNT(*) FILTER (WHERE "chainDepth" = 0)              AS diretos,
      COUNT(*) FILTER (WHERE "chainDepth" > 0)              AS por_propagacao,
      ROUND(
        COUNT(*) FILTER (WHERE "chainDepth" > 0)::numeric
        / NULLIF(COUNT(*) FILTER (WHERE "chainDepth" = 0), 0), 2
      )                                                     AS usuarios_gerados_por_usuario
    FROM visitors
    WHERE "projectId" = ${project.id}::uuid AND "rootPlatform" IS NOT NULL
    GROUP BY "rootPlatform"
    ORDER BY por_propagacao DESC`
  console.log('\n5) Qualidade da aquisição por plataforma:')
  console.table(
    qualidade.map((r) => ({
      plataforma: r.plataforma,
      diretos: Number(r.diretos),
      'por propagação': Number(r.por_propagacao),
      'cada usuário trouxe': Number(r.usuarios_gerados_por_usuario ?? 0),
    })),
  )

  // 6. Origem inicial vs origem imediata — as duas guardadas separadamente.
  const origens = await prisma.visitor.findMany({
    where: { projectId: project.id, chainDepth: { gt: 0 } },
    select: {
      user: { select: { displayName: true } },
      firstTouchPlatform: true,
      rootPlatform: true,
      chainDepth: true,
      referredByUser: { select: { displayName: true } },
    },
    orderBy: { chainDepth: 'asc' },
  })
  console.log('6) Origem inicial (cadeia) x origem imediata (própria chegada):')
  console.table(
    origens.map((v) => ({
      usuário: v.user?.displayName,
      'origem imediata': v.firstTouchPlatform,
      'origem inicial da cadeia': v.rootPlatform,
      'trazido por': v.referredByUser?.displayName,
      profundidade: v.chainDepth,
    })),
  )

  const totalEventos = await prisma.event.count({ where: { projectId: project.id } })
  console.log(`\n✓ ${totalEventos} eventos brutos gravados. Nenhuma migration adicional foi necessária.`)

  await limpar()
  console.log('✓ Dados de verificação removidos.\n')
}

// ─── Auxiliares que espelham o que a API vai fazer ──────────────────

async function criarLinkRaiz(projectId: string, campaignId: string, platform: Platform) {
  const link = await prisma.shortLink.create({
    data: {
      projectId,
      code: code(),
      kind: ShortLinkKind.CAMPAIGN,
      campaignId,
      targetUrl: 'http://localhost:3000/',
      depth: 0,
      rootPlatform: platform,
    },
  })
  return prisma.shortLink.update({
    where: { id: link.id },
    data: { rootShortLinkId: link.id },
    include: { campaign: true },
  })
}

/** Visitante chega por um link, navega e se cadastra. */
async function chegarECadastrar(
  nome: string,
  projectId: string,
  viaLink: { id: string; campaignId: string | null; rootShortLinkId: string | null; rootPlatform: Platform | null; depth: number; channel?: Platform | null },
  quemTrouxe: { userId: string | null } | null,
) {
  // A origem IMEDIATA é o canal do compartilhamento, ou a plataforma da campanha.
  const plataformaImediata = viaLink.channel ?? viaLink.rootPlatform ?? Platform.DIRECT
  const chainDepth = viaLink.depth

  const visitor = await prisma.visitor.create({
    data: {
      projectId,
      anonId: `anon_${code()}`,
      // Origem 1 — como ESTA pessoa chegou.
      firstTouchPlatform: plataformaImediata,
      firstTouchCampaignId: viaLink.campaignId,
      firstTouchLinkId: viaLink.id,
      firstTouchAt: new Date(),
      // Origem 2 — visita mais recente.
      lastTouchPlatform: plataformaImediata,
      lastTouchCampaignId: viaLink.campaignId,
      lastTouchLinkId: viaLink.id,
      lastTouchAt: new Date(),
      // Origem 3 — o que originou a CADEIA.
      rootPlatform: viaLink.rootPlatform,
      rootLinkId: viaLink.rootShortLinkId,
      // Cadeia.
      acquiredViaLinkId: viaLink.id,
      referredByUserId: quemTrouxe?.userId ?? null,
      chainDepth,
      consentStatus: 'GRANTED',
      consentAt: new Date(),
    },
  })

  const atribuicao = {
    projectId,
    visitorId: visitor.id,
    platform: plataformaImediata,
    campaignId: viaLink.campaignId,
    shortLinkId: viaLink.id,
    rootShortLinkId: viaLink.rootShortLinkId,
    rootPlatform: viaLink.rootPlatform,
    chainDepth,
  }

  // Clique no link de compartilhamento, quando veio de um.
  if (chainDepth > 0) {
    await prisma.event.create({ data: { ...atribuicao, type: EventType.SHARE_LINK_CLICKED } })
  }
  await prisma.event.create({ data: { ...atribuicao, type: EventType.SESSION_START } })
  await prisma.event.create({ data: { ...atribuicao, type: EventType.CONTENT_VIEW } })

  const user = await prisma.user.create({
    data: {
      email: `${nome.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}_${code()}@teste.local`,
      passwordHash: 'x',
      displayName: nome,
    },
  })
  // O cadastro liga o visitante ao usuário — a atribuição pré-cadastro sobrevive.
  await prisma.visitor.update({ where: { id: visitor.id }, data: { userId: user.id } })
  await prisma.event.create({ data: { ...atribuicao, type: EventType.SIGNUP, userId: user.id } })

  return { visitorId: visitor.id, userId: user.id, atribuicao: { ...atribuicao, userId: user.id } }
}

/** Usuário compartilha: gera o link identificável e estende a cadeia. */
async function compartilhar(
  projectId: string,
  contentId: string,
  quem: Awaited<ReturnType<typeof chegarECadastrar>>,
  linkDeOrigem: { id: string; rootShortLinkId: string | null; rootPlatform: Platform | null; depth: number },
  canal: Platform,
) {
  const link = await prisma.shortLink.create({
    data: {
      projectId,
      code: code(),
      kind: ShortLinkKind.SHARE,
      contentId,
      createdByUserId: quem.userId,
      channel: canal,
      // A aresta da cadeia: o link pelo qual QUEM COMPARTILHOU havia chegado.
      parentShortLinkId: linkDeOrigem.id,
      rootShortLinkId: linkDeOrigem.rootShortLinkId,
      rootPlatform: linkDeOrigem.rootPlatform,
      depth: linkDeOrigem.depth + 1,
      targetUrl: 'http://localhost:3000/',
    },
  })

  await prisma.share.create({
    data: { userId: quem.userId!, shortLinkId: link.id, channel: canal },
  })
  await prisma.event.create({
    data: {
      ...quem.atribuicao,
      type: EventType.SHARE_CREATED,
      contentId,
      props: { canal },
    },
  })

  return link
}

/** Compra confirmada — Fase 2, mas os campos existem desde a primeira migration. */
async function comprar(quem: Awaited<ReturnType<typeof chegarECadastrar>>, valor: number) {
  await prisma.event.create({
    data: {
      ...quem.atribuicao,
      type: EventType.CHECKOUT_CLICKED,
      productRef: 'livro-alfabeto',
    },
  })
  await prisma.event.create({
    data: {
      ...quem.atribuicao,
      type: EventType.PURCHASE_COMPLETED,
      productRef: 'livro-alfabeto',
      value: new Prisma.Decimal(valor),
      currency: 'BRL',
      externalOrderRef: `ext_${code()}`,
    },
  })
}

async function limpar() {
  const p = await prisma.project.findUnique({ where: { slug: SLUG } })
  if (!p) return
  const userIds = (
    await prisma.visitor.findMany({
      where: { projectId: p.id, userId: { not: null } },
      select: { userId: true },
    })
  ).map((v) => v.userId!)

  await prisma.$transaction(async (tx) => {
    // Único caminho autorizado para apagar eventos — o mesmo que a rotina de
    // retenção LGPD/GDPR usará.
    await tx.$executeRawUnsafe(`SET LOCAL pv.allow_event_purge = 'on'`)
    await tx.$executeRaw`DELETE FROM events WHERE "projectId" = ${p.id}::uuid`
    await tx.project.delete({ where: { id: p.id } })
    if (userIds.length) await tx.user.deleteMany({ where: { id: { in: userIds } } })
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
