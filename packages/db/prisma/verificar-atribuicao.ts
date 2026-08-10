/**
 * Testes de regressão das regras de atribuição, contra a API rodando.
 *
 * Por que existe: esta é a lógica mais valiosa do sistema — é o que responde
 * "de onde vieram meus visitantes", que é a pergunta que o projeto inteiro
 * existe para responder. Já produziu dois defeitos:
 *
 *   1. Navegação interna entre páginas virava origem OTHER.
 *   2. Ação dentro do app (consentimento, cadastro) virava origem DIRECT.
 *
 * Os dois só apareceram olhando o banco depois de um teste que "passou" na
 * tela. Daí este arquivo: as regras agora ficam verificadas, não confiadas.
 *
 * Requer API e banco no ar.
 *   npx tsx packages/db/prisma/verificar-atribuicao.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'
/** /r/:code fica FORA do prefixo /api — é o endereço gravado dentro do QR. */
const RAIZ = API.replace(/\/api$/, '')
const WEB = process.env.PUBLIC_WEB_URL ?? 'http://localhost:3100'
const PROJETO = 'jesus-alfabeto-saudavel'

let falhas = 0

function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`  ${ok ? '✓' : '✗'} ${nome}`)
  if (!ok) console.log(`      esperado: ${esperado}\n      obtido:   ${obtido}`)
}

/** Extrai o cookie pv_anon de uma resposta. */
function anonDoSetCookie(res: Response): string | null {
  const bruto = res.headers.get('set-cookie')
  if (!bruto) return null
  return /pv_anon=([^;]+)/.exec(bruto)?.[1] ?? null
}

async function estadoDoVisitante(anonId: string) {
  return prisma.visitor.findUnique({
    where: { anonId },
    select: {
      firstTouchPlatform: true,
      lastTouchPlatform: true,
      rootPlatform: true,
      chainDepth: true,
    },
  })
}

async function main() {
  const projeto = await prisma.project.findUnique({ where: { slug: PROJETO } })
  if (!projeto) throw new Error('Projeto não encontrado. Rode o seed.')

  const conteudo = await prisma.content.findFirst({
    where: { projectId: projeto.id, slug: 'a' },
    select: { id: true },
  })
  const qr = await prisma.shortLink.findFirst({
    where: { contentId: conteudo!.id, kind: 'CONTENT_QR' },
    select: { code: true },
  })
  if (!qr) throw new Error('QR da letra A não encontrado.')

  const criados: string[] = []

  // ── Caso 1: chegada por QR define a origem ────────────────────────
  console.log('\n1. Chegada por QR Code')
  const r1 = await fetch(`${RAIZ}/r/${qr.code}`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone)' },
  })
  const anon = anonDoSetCookie(r1)!
  criados.push(anon)
  let v = await estadoDoVisitante(anon)
  conferir('origem primeira = QR_CODE', v?.firstTouchPlatform, 'QR_CODE')
  conferir('origem imediata = QR_CODE', v?.lastTouchPlatform, 'QR_CODE')

  // ── Caso 2: navegação interna NÃO muda a origem ───────────────────
  console.log('\n2. Navegação interna entre páginas (referrer do próprio site)')
  await fetch(`${API}/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pv_anon=${anon}`,
      Referer: `${WEB}/${PROJETO}/a`,
    },
    body: JSON.stringify({ projectId: projeto.id, type: 'CONTENT_VIEW', contentId: conteudo!.id }),
  })
  v = await estadoDoVisitante(anon)
  conferir('origem imediata continua QR_CODE', v?.lastTouchPlatform, 'QR_CODE')

  // ── Caso 3: ação no app SEM referrer NÃO muda a origem ────────────
  console.log('\n3. Ação dentro do app sem referrer (consentimento)')
  await fetch(`${API}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pv_anon=${anon}` },
    body: JSON.stringify({ projectId: projeto.id, granted: true, analytics: true }),
  })
  v = await estadoDoVisitante(anon)
  conferir('origem imediata continua QR_CODE', v?.lastTouchPlatform, 'QR_CODE')

  // ── Caso 4: cadastro preserva a origem e liga o visitante ─────────
  console.log('\n4. Cadastro depois da visita anônima')
  const email = `teste_${anon.slice(2, 12).toLowerCase().replace(/[^a-z0-9]/g, '')}@teste.local`
  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pv_anon=${anon}` },
    body: JSON.stringify({
      projectId: projeto.id,
      email,
      password: 'senhaSegura123',
      displayName: 'Teste Atribuicao',
    }),
  })
  conferir('cadastro retorna 201', reg.status, 201)
  v = await estadoDoVisitante(anon)
  conferir('origem imediata continua QR_CODE', v?.lastTouchPlatform, 'QR_CODE')
  conferir('origem raiz continua QR_CODE', v?.rootPlatform, 'QR_CODE')

  const evtSignup = await prisma.event.findFirst({
    where: { type: 'SIGNUP', visitor: { anonId: anon } },
    select: { platform: true, rootPlatform: true, userId: true },
  })
  conferir('evento SIGNUP carrega origem QR_CODE', evtSignup?.platform, 'QR_CODE')
  conferir('evento SIGNUP tem usuário ligado', Boolean(evtSignup?.userId), true)

  // ── Caso 5: referrer externo DESCONHECIDO não vira OTHER ──────────
  console.log('\n5. Referrer externo desconhecido')
  await fetch(`${API}/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `pv_anon=${anon}`,
      Referer: 'https://site-qualquer-desconhecido.example/pagina',
    },
    body: JSON.stringify({ projectId: projeto.id, type: 'PAGE_VIEW' }),
  })
  v = await estadoDoVisitante(anon)
  conferir('origem imediata continua QR_CODE (não virou OTHER)', v?.lastTouchPlatform, 'QR_CODE')

  // ── Caso 6: chegada nova por UTM MUDA a origem imediata ───────────
  console.log('\n6. Chegada nova por UTM (evidência positiva)')
  await fetch(`${API}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pv_anon=${anon}` },
    body: JSON.stringify({
      projectId: projeto.id,
      type: 'PAGE_VIEW',
      utmSource: 'tiktok',
      utmMedium: 'video',
    }),
  })
  v = await estadoDoVisitante(anon)
  conferir('origem imediata passa a TIKTOK', v?.lastTouchPlatform, 'TIKTOK')
  conferir('origem PRIMEIRA continua QR_CODE', v?.firstTouchPlatform, 'QR_CODE')
  conferir('origem RAIZ continua QR_CODE', v?.rootPlatform, 'QR_CODE')

  // ── Caso 7: evento sensível vindo do cliente é ignorado ───────────
  console.log('\n7. Evento de compra forjado no navegador')
  const antes = await prisma.event.count({ where: { type: 'PURCHASE_COMPLETED' } })
  await fetch(`${API}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `pv_anon=${anon}` },
    body: JSON.stringify({ projectId: projeto.id, type: 'PURCHASE_COMPLETED' }),
  })
  const depois = await prisma.event.count({ where: { type: 'PURCHASE_COMPLETED' } })
  conferir('compra forjada NÃO é gravada', depois, antes)

  await limpar(criados, email)

  console.log(
    falhas === 0
      ? '\n✓ Todas as regras de atribuição verificadas.\n'
      : `\n✗ ${falhas} verificação(ões) falharam.\n`,
  )
  if (falhas > 0) process.exitCode = 1
}

async function limpar(anonIds: string[], email: string) {
  const visitantes = await prisma.visitor.findMany({
    where: { anonId: { in: anonIds } },
    select: { id: true, userId: true },
  })
  const ids = visitantes.map((v) => v.id)
  const userIds = visitantes.map((v) => v.userId).filter((u): u is string => Boolean(u))

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL pv.allow_event_purge = 'on'`)
    await tx.event.deleteMany({ where: { visitorId: { in: ids } } })
    await tx.consent.deleteMany({ where: { visitorId: { in: ids } } })
    await tx.visitor.deleteMany({ where: { id: { in: ids } } })
    if (userIds.length) {
      await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } })
      await tx.user.deleteMany({ where: { id: { in: userIds } } })
    }
    await tx.user.deleteMany({ where: { email } })
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
