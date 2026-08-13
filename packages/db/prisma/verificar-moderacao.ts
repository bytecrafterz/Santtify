/**
 * Verifica a moderação da comunidade contra a API no ar.
 *
 * O que precisa ser verdade, e por que cada coisa importa:
 *
 *   1. o dono vê os comentários do projeto, com autor e conteúdo;
 *   2. ele apaga um comentário impróprio e ele some para o público — se sumir
 *      só da tela dele, a moderação não serve para nada;
 *   3. ele bloqueia a conta e a pessoa **deixa de conseguir entrar**;
 *   4. a sessão já aberta do bloqueado morre — sem isso, "bloqueei e ele
 *      continua comentando" destrói a confiança na ferramenta;
 *   5. bloquear não apaga o que a pessoa escreveu: são decisões separadas;
 *   6. liberar devolve o acesso;
 *   7. administrador não bloqueia administrador — conta invadida não pode
 *      derrubar o dono do próprio painel;
 *   8. tudo fica na auditoria.
 *
 *   npx tsx packages/db/prisma/verificar-moderacao.ts
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'

const prisma = new PrismaClient()
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'
const PROJETO = 'jesus-alfabeto-saudavel'

let falhas = 0
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`  ${ok ? '✓' : '✗'} ${nome}`)
  if (!ok) console.log(`      esperado: ${esperado}\n      obtido:   ${obtido}`)
}

async function main() {
  const projeto = await prisma.project.findUniqueOrThrow({ where: { slug: PROJETO } })
  const conteudo = await prisma.content.findFirstOrThrow({
    where: { projectId: projeto.id, status: 'PUBLISHED' },
    select: { id: true },
  })

  const sufixo = randomBytes(4).toString('hex')
  const emails: string[] = []

  console.log('\n1. Contas de teste')
  const criar = async (nome: string) => {
    const email = `mod_${nome}_${sufixo}@teste.local`
    const r = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projeto.id,
        email,
        password: 'senhaDeTeste123',
        displayName: nome,
      }),
    })
    const corpo = await r.json()
    // Em minúsculas: o servidor normaliza o e-mail ao cadastrar, e a limpeza
    // no fim compara com o que está gravado, não com o que foi digitado.
    emails.push(email.toLowerCase())
    return { email, token: corpo.accessToken as string, refresh: corpo.refreshToken as string }
  }

  const bia = await criar('Bia')
  conferir('conta da Bia criada', Boolean(bia.token), true)

  const emailAdmin = `mod_admin_${sufixo}@teste.local`
  await prisma.user.create({
    data: {
      email: emailAdmin,
      passwordHash: await argon2.hash('senhaDeTeste123'),
      displayName: 'Dono',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
    },
  })
  emails.push(emailAdmin)
  const rAdmin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: projeto.id, email: emailAdmin, password: 'senhaDeTeste123' }),
  })
  const admin = await rAdmin.json()
  const comAdmin = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${admin.accessToken}`,
  }
  conferir('dono autenticado', Boolean(admin.accessToken), true)

  console.log('\n2. A Bia comenta duas vezes')
  const comentar = async (texto: string) => {
    const r = await fetch(`${API}/contents/${conteudo.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bia.token}` },
      body: JSON.stringify({ projectId: projeto.id, body: texto }),
    })
    return { status: r.status, corpo: await r.json().catch(() => null) }
  }
  const c1 = await comentar(`comentario normal ${sufixo}`)
  const c2 = await comentar(`comentario improprio ${sufixo}`)
  conferir('primeiro comentário aceito', c1.status, 201)
  conferir('segundo comentário aceito', c2.status, 201)

  console.log('\n3. O dono vê os comentários no painel')
  const rLista = await fetch(`${API}/admin/projects/${PROJETO}/comments`, { headers: comAdmin })
  const lista = await rLista.json()
  conferir('a lista responde', rLista.status, 200)
  const meus = lista.comments.filter((c: any) => c.body.includes(sufixo))
  conferir('os dois comentários aparecem', meus.length, 2)
  conferir('com o nome de quem escreveu', meus[0]?.user?.displayName, 'Bia')
  conferir('e a conta aparece ativa', meus[0]?.user?.status, 'ACTIVE')

  console.log('\n4. O dono apaga o comentário impróprio')
  const rApagar = await fetch(`${API}/comments/${c2.corpo.id}`, {
    method: 'DELETE',
    headers: comAdmin,
  })
  conferir('apagado', rApagar.status, 204)

  const publicos = await (await fetch(`${API}/contents/${conteudo.id}/comments`)).json()
  conferir(
    'sumiu para o público',
    publicos.some((c: any) => c.id === c2.corpo.id),
    false,
  )
  conferir(
    'o outro comentário continua visível',
    publicos.some((c: any) => c.id === c1.corpo.id),
    true,
  )

  console.log('\n5. O dono bloqueia a conta')
  const rBloq = await fetch(`${API}/admin/users/${meus[0].user.id}/block`, {
    method: 'POST',
    headers: comAdmin,
    body: JSON.stringify({ bloquear: true, motivo: 'teste automatizado' }),
  })
  const bloqueada = await rBloq.json()
  conferir('bloqueio aceito', rBloq.status, 200)
  conferir('a conta ficou suspensa', bloqueada.status, 'SUSPENDED')

  const rEntrar = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: projeto.id, email: bia.email, password: 'senhaDeTeste123' }),
  })
  conferir('a pessoa não consegue mais entrar', rEntrar.status, 401)

  // A sessão que já estava aberta precisa morrer: o token curto expira sozinho,
  // mas a renovação é o que a manteria viva indefinidamente.
  const rRenovar = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: bia.refresh }),
  })
  conferir('a sessão aberta não se renova', rRenovar.status === 200, false)
  const sobraram = await prisma.refreshToken.count({ where: { userId: meus[0].user.id } })
  conferir('nenhum token de renovação sobrou', sobraram, 0)

  console.log('\n6. Bloquear não apaga o que a pessoa escreveu')
  const aindaPublicos = await (await fetch(`${API}/contents/${conteudo.id}/comments`)).json()
  conferir(
    'o comentário que não foi apagado continua lá',
    aindaPublicos.some((c: any) => c.id === c1.corpo.id),
    true,
  )

  console.log('\n7. Liberar devolve o acesso')
  const rLiberar = await fetch(`${API}/admin/users/${meus[0].user.id}/block`, {
    method: 'POST',
    headers: comAdmin,
    body: JSON.stringify({ bloquear: false }),
  })
  conferir('liberação aceita', rLiberar.status, 200)
  const rEntrar2 = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: projeto.id, email: bia.email, password: 'senhaDeTeste123' }),
  })
  conferir('a pessoa entra de novo', rEntrar2.status, 200)

  console.log('\n8. Administrador não bloqueia administrador')
  const admins = await prisma.user.findFirstOrThrow({
    where: { email: emailAdmin },
    select: { id: true },
  })
  const rProprio = await fetch(`${API}/admin/users/${admins.id}/block`, {
    method: 'POST',
    headers: comAdmin,
    body: JSON.stringify({ bloquear: true }),
  })
  conferir('recusado', rProprio.status, 400)

  console.log('\n9. Auditoria')
  const acoes = await prisma.adminAuditLog.findMany({
    where: { userId: admins.id, entityType: 'User' },
    select: { action: true },
  })
  conferir(
    'bloqueio e liberação registrados',
    acoes.filter((a) => a.action === 'user.block').length >= 1 &&
      acoes.filter((a) => a.action === 'user.unblock').length >= 1,
    true,
  )

  // ── Limpeza ───────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  })
  const ids = users.map((u) => u.id)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL pv.allow_event_purge = 'on'`)
    await tx.event.deleteMany({ where: { userId: { in: ids } } })
    await tx.adminAuditLog.deleteMany({ where: { userId: { in: ids } } })
    await tx.comment.deleteMany({ where: { userId: { in: ids } } })
    await tx.reaction.deleteMany({ where: { userId: { in: ids } } })
    await tx.share.deleteMany({ where: { userId: { in: ids } } })
    await tx.post.deleteMany({ where: { userId: { in: ids } } })
    await tx.shortLink.deleteMany({ where: { createdByUserId: { in: ids } } })
    await tx.refreshToken.deleteMany({ where: { userId: { in: ids } } })
    await tx.consent.deleteMany({ where: { visitor: { userId: { in: ids } } } })
    await tx.visitSession.deleteMany({ where: { userId: { in: ids } } })
    await tx.visitor.deleteMany({ where: { userId: { in: ids } } })
    await tx.user.deleteMany({ where: { id: { in: ids } } })
  })

  // Os contadores são cache: recalcula a partir da verdade.
  const conteudos = await prisma.content.findMany({ select: { id: true } })
  for (const c of conteudos) {
    const comments = await prisma.comment.count({
      where: { contentId: c.id, status: 'PUBLISHED' },
    })
    await prisma.contentStats.updateMany({ where: { contentId: c.id }, data: { comments } })
  }

  console.log(
    falhas === 0
      ? '\n✓ Moderação da comunidade: tudo verificado contra a API no ar.\n'
      : `\n✗ ${falhas} verificação(ões) falharam.\n`,
  )
  if (falhas > 0) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
