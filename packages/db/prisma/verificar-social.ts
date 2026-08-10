/**
 * Verifica o módulo social contra a API no ar.
 *
 * O caso que importa é o último: **compartilhar de verdade estende a cadeia de
 * propagação**. Até agora a cadeia só era exercitada pelo script sintético
 * `verificar-propagacao.ts`, que montava os links à mão. Aqui ela passa pelo
 * caminho real — usuário clica em compartilhar, outra pessoa abre o link — que
 * é o que vai acontecer no lançamento.
 *
 *   npx tsx packages/db/prisma/verificar-social.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'
const RAIZ = API.replace(/\/api$/, '')
const PROJETO = 'jesus-alfabeto-saudavel'

let falhas = 0
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`  ${ok ? '✓' : '✗'} ${nome}`)
  if (!ok) console.log(`      esperado: ${esperado}\n      obtido:   ${obtido}`)
}

const anonDe = (r: Response) => /pv_anon=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')?.[1] ?? null

async function criarConta(projectId: string, nome: string, anon: string | null) {
  const r = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(anon ? { Cookie: `pv_anon=${anon}` } : {}),
    },
    body: JSON.stringify({
      projectId,
      email: `${nome.toLowerCase()}_${Date.now().toString(36)}@teste.local`,
      password: 'senhaDeTeste123',
      displayName: nome,
    }),
  })
  const corpo = await r.json()
  return { token: corpo.accessToken as string, email: corpo.user.email as string }
}

async function main() {
  const projeto = await prisma.project.findUnique({ where: { slug: PROJETO } })
  const conteudo = await prisma.content.findFirst({
    where: { projectId: projeto!.id, status: 'PUBLISHED' },
    select: { id: true, slug: true },
  })
  const qr = await prisma.shortLink.findFirst({
    where: { contentId: conteudo!.id, kind: 'CONTENT_QR' },
    select: { code: true },
  })

  const criados: string[] = []
  const emails: string[] = []

  // ── Ana chega pelo QR e cria conta ────────────────────────────────
  console.log('\n1. Ana chega pelo QR Code e se cadastra')
  const r1 = await fetch(`${RAIZ}/r/${qr!.code}`, { redirect: 'manual' })
  const anonAna = anonDe(r1)!
  criados.push(anonAna)
  const ana = await criarConta(projeto!.id, 'Ana', anonAna)
  emails.push(ana.email)
  conferir('conta criada', Boolean(ana.token), true)

  const comAna = { 'Content-Type': 'application/json', Authorization: `Bearer ${ana.token}`, Cookie: `pv_anon=${anonAna}` }

  // ── Curtir ────────────────────────────────────────────────────────
  console.log('\n2. Ana curte o conteúdo')
  const like1 = await (
    await fetch(`${API}/contents/${conteudo!.id}/like`, {
      method: 'POST', headers: comAna, body: JSON.stringify({ projectId: projeto!.id }),
    })
  ).json()
  conferir('curtido', like1.curtido, true)

  const like2 = await (
    await fetch(`${API}/contents/${conteudo!.id}/like`, {
      method: 'POST', headers: comAna, body: JSON.stringify({ projectId: projeto!.id }),
    })
  ).json()
  conferir('mesmo botão descurte', like2.curtido, false)

  await fetch(`${API}/contents/${conteudo!.id}/like`, {
    method: 'POST', headers: comAna, body: JSON.stringify({ projectId: projeto!.id }),
  })

  // ── Comentar ──────────────────────────────────────────────────────
  console.log('\n3. Ana comenta')
  const comentario = await (
    await fetch(`${API}/contents/${conteudo!.id}/comments`, {
      method: 'POST', headers: comAna,
      body: JSON.stringify({ projectId: projeto!.id, body: 'Minha filha adorou esta letra!' }),
    })
  ).json()
  conferir('comentário criado', Boolean(comentario.id), true)

  console.log('\n4. Visitante anônimo consegue LER a atividade')
  const publico = await (await fetch(`${API}/contents/${conteudo!.id}/social`)).json()
  conferir('vê curtidas sem conta', publico.curtidas >= 1, true)
  conferir('vê comentários sem conta', publico.lista.length >= 1, true)
  conferir('não aparece como curtido por ele', publico.curtidoPorMim, false)

  console.log('\n5. Anônimo NÃO consegue escrever')
  const semConta = await fetch(`${API}/contents/${conteudo!.id}/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: projeto!.id, body: 'deveria falhar' }),
  })
  conferir('comentar sem conta é bloqueado (401)', semConta.status, 401)

  // ── O caso central: compartilhar estende a cadeia ─────────────────
  console.log('\n6. Ana compartilha por WhatsApp')
  const partilha = await (
    await fetch(`${API}/contents/${conteudo!.id}/share`, {
      method: 'POST', headers: comAna,
      body: JSON.stringify({ projectId: projeto!.id, canal: 'WHATSAPP' }),
    })
  ).json()
  conferir('link de compartilhamento gerado', Boolean(partilha.url), true)

  const linkPartilha = await prisma.shortLink.findUnique({
    where: { code: partilha.code },
    select: { kind: true, depth: true, channel: true, createdByUserId: true, rootPlatform: true },
  })
  conferir('tipo SHARE', linkPartilha?.kind, 'SHARE')
  conferir('canal WHATSAPP', linkPartilha?.channel, 'WHATSAPP')
  conferir('profundidade 1 (Ana veio do QR, profundidade 0)', linkPartilha?.depth, 1)
  conferir('raiz preservada: QR_CODE', linkPartilha?.rootPlatform, 'QR_CODE')

  console.log('\n7. Bruno abre o link que Ana mandou')
  const r2 = await fetch(`${RAIZ}/r/${partilha.code}`, { redirect: 'manual' })
  const anonBruno = anonDe(r2)!
  criados.push(anonBruno)
  const visitorBruno = await prisma.visitor.findUnique({
    where: { anonId: anonBruno },
    select: {
      firstTouchPlatform: true, rootPlatform: true, chainDepth: true, referredByUserId: true,
    },
  })
  const userAna = await prisma.user.findUnique({ where: { email: ana.email }, select: { id: true } })

  conferir('origem imediata de Bruno = WHATSAPP', visitorBruno?.firstTouchPlatform, 'WHATSAPP')
  conferir('origem RAIZ de Bruno = QR_CODE (a de Ana)', visitorBruno?.rootPlatform, 'QR_CODE')
  conferir('profundidade de Bruno = 1', visitorBruno?.chainDepth, 1)
  conferir('Bruno foi trazido por Ana', visitorBruno?.referredByUserId, userAna?.id)

  console.log('\n8. Bruno se cadastra e compartilha — a cadeia vai a 2')
  const bruno = await criarConta(projeto!.id, 'Bruno', anonBruno)
  emails.push(bruno.email)
  const partilha2 = await (
    await fetch(`${API}/contents/${conteudo!.id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bruno.token}`, Cookie: `pv_anon=${anonBruno}` },
      body: JSON.stringify({ projectId: projeto!.id, canal: 'INSTAGRAM' }),
    })
  ).json()
  const link2 = await prisma.shortLink.findUnique({
    where: { code: partilha2.code },
    select: { depth: true, rootPlatform: true },
  })
  conferir('profundidade 2', link2?.depth, 2)
  conferir('raiz continua QR_CODE', link2?.rootPlatform, 'QR_CODE')

  await limpar(criados, emails)
  console.log(
    falhas === 0
      ? '\n✓ Módulo social verificado, cadeia de propagação real funcionando.\n'
      : `\n✗ ${falhas} verificação(ões) falharam.\n`,
  )
  if (falhas) process.exitCode = 1
}

async function limpar(anonIds: string[], emails: string[]) {
  const visitantes = await prisma.visitor.findMany({
    where: { anonId: { in: anonIds } },
    select: { id: true, userId: true },
  })
  const ids = visitantes.map((v) => v.id)
  const users = visitantes.map((v) => v.userId).filter((u): u is string => Boolean(u))

  // A ORDEM aqui não é estilo, é imposta pelo banco. As chaves de atribuição
  // são RESTRICT de propósito: apagar um link enquanto um visitante ainda
  // aponta para ele zeraria a origem daquela pessoa. Então o que referencia
  // sai primeiro — eventos e visitantes antes dos links.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL pv.allow_event_purge = 'on'`)
    await tx.event.deleteMany({ where: { visitorId: { in: ids } } })
    await tx.consent.deleteMany({ where: { visitorId: { in: ids } } })
    await tx.visitor.deleteMany({ where: { id: { in: ids } } })
    if (users.length) {
      await tx.share.deleteMany({ where: { userId: { in: users } } })
      await tx.comment.deleteMany({ where: { userId: { in: users } } })
      await tx.reaction.deleteMany({ where: { userId: { in: users } } })
      await tx.shortLink.deleteMany({ where: { createdByUserId: { in: users } } })
      await tx.refreshToken.deleteMany({ where: { userId: { in: users } } })
    }
    await tx.user.deleteMany({ where: { email: { in: emails } } })
  })

  // Os contadores são cache: recalcula a partir da verdade.
  const conteudos = await prisma.content.findMany({ select: { id: true } })
  for (const c of conteudos) {
    const [likes, comments, shares] = await Promise.all([
      prisma.reaction.count({ where: { contentId: c.id } }),
      prisma.comment.count({ where: { contentId: c.id, status: 'PUBLISHED' } }),
      prisma.share.count({ where: { shortLink: { contentId: c.id } } }),
    ])
    await prisma.contentStats.updateMany({
      where: { contentId: c.id },
      data: { likes, comments, shares },
    })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
