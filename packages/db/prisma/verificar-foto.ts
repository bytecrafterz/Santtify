/**
 * Verifica a foto no My Post contra a API no ar.
 *
 * O que precisa ser verdade, e por que cada coisa importa:
 *
 *   1. foto enviada nasce PENDENTE e **não aparece para o público** — se a
 *      moderação existir mas a foto vazar antes da aprovação, a moderação não
 *      serve para nada;
 *   2. o autor vê a própria publicação pendente — esconder faria parecer que a
 *      publicação sumiu, e a pessoa reenviaria;
 *   3. o painel lista a fila e aprova, e só então a foto fica visível;
 *   4. a recusa não apaga: fica REJECTED, com o motivo visível para o autor;
 *   5. arquivo que não é imagem é recusado na porta — aceitar vídeo aqui abriria
 *      por acidente o bloco que ficou de fora do contrato;
 *   6. moderar duas vezes não é possível;
 *   7. publicação sem foto continua saindo direto, como antes;
 *   8. com a chave DESLIGADA a foto sai na hora, e com ela LIGADA de novo volta
 *      a esperar — a decisão é do dono da plataforma e precisa valer nos dois
 *      sentidos, sem deixar publicação presa no meio do caminho.
 *
 *   npx tsx packages/db/prisma/verificar-foto.ts
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
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

/** PNG 1x1 de verdade — o serviço valida o tipo, então não serve texto. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function main() {
  const projeto = await prisma.project.findUniqueOrThrow({ where: { slug: PROJETO } })
  const conteudo = await prisma.content.findFirstOrThrow({
    where: { projectId: projeto.id, status: 'PUBLISHED' },
    select: { id: true, slug: true, title: true },
  })

  const sufixo = randomBytes(4).toString('hex')
  const emails: string[] = []

  // ── Contas ────────────────────────────────────────────────────────
  console.log('\n1. Contas de teste')
  const rReg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: projeto.id,
      email: `foto_ana_${sufixo}@teste.local`,
      password: 'senhaDeTeste123',
      displayName: 'Ana',
    }),
  })
  const ana = await rReg.json()
  emails.push(ana.user.email)
  conferir('conta da Ana criada', Boolean(ana.accessToken), true)

  const emailAdmin = `foto_admin_${sufixo}@teste.local`
  await prisma.user.create({
    data: {
      email: emailAdmin,
      passwordHash: await argon2.hash('senhaDeTeste123'),
      displayName: 'Moderador',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
    },
  })
  emails.push(emailAdmin)
  const rLog = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: projeto.id, email: emailAdmin, password: 'senhaDeTeste123' }),
  })
  const admin = await rLog.json()
  conferir('administrador autenticado', Boolean(admin.accessToken), true)

  const usuarioAna: string = ana.user.id
  const comAna = { Authorization: `Bearer ${ana.accessToken}` }
  const comAdmin = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${admin.accessToken}`,
  }

  const publicarComFoto = async (
    nomeArquivo: string,
    tipo: string,
    dados: Buffer,
    legenda: string,
    autor = comAna,
  ) => {
    const form = new FormData()
    form.append('projectId', projeto.id)
    form.append('body', legenda)
    form.append('foto', new Blob([new Uint8Array(dados)], { type: tipo }), nomeArquivo)
    const r = await fetch(`${API}/contents/${conteudo.id}/publish`, {
      method: 'POST',
      headers: autor,
      body: form,
    })
    return { status: r.status, corpo: await r.json().catch(() => null) }
  }

  // ── 2. Publicar com foto ──────────────────────────────────────────
  console.log('\n2. Ana publica uma foto com legenda')
  const pub = await publicarComFoto('desenho.png', 'image/png', PNG_1X1, 'O desenho que fiz da letra A')
  conferir('publicação aceita', pub.status, 201)
  conferir('nasce aguardando aprovação', pub.corpo?.status, 'PENDING')
  conferir('a resposta avisa que aguarda aprovação', pub.corpo?.aguardandoAprovacao, true)
  conferir('a foto foi guardada', Boolean(pub.corpo?.imageAsset?.url), true)
  conferir('a legenda foi guardada', pub.corpo?.body, 'O desenho que fiz da letra A')
  const postId: string = pub.corpo?.id

  // A URL guardada é absoluta (aponta para o endereço público da API). Aqui a
  // verificação roda contra o processo local, então troca-se só a origem.
  const urlFoto: string = pub.corpo?.imageAsset?.url ?? ''
  const caminhoFoto = urlFoto.replace(/^https?:\/\/[^/]+/, '')
  const rArquivo = await fetch(`${API.replace(/\/api$/, '')}${caminhoFoto}`)
  conferir('o arquivo é servido pela API', rArquivo.status, 200)
  conferir('servido como imagem', rArquivo.headers.get('content-type'), 'image/png')

  // ── 3. Invisível para o público antes da aprovação ────────────────
  console.log('\n3. Antes da aprovação, ninguém de fora vê')
  const noBanco = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { status: true, imageAssetId: true, moderatedAt: true },
  })
  conferir('no banco está PENDING', noBanco.status, 'PENDING')
  conferir('ainda não foi moderada', noBanco.moderatedAt, null)

  const pendentesNoFeed = await prisma.post.count({
    where: { projectId: projeto.id, status: 'PUBLISHED', id: postId },
  })
  conferir('não entra na lista pública', pendentesNoFeed, 0)

  const rMinhas = await fetch(`${API}/me/posts`, { headers: comAna })
  const minhas = await rMinhas.json()
  conferir('a própria autora vê a publicação dela', minhas.some((p: any) => p.id === postId), true)
  conferir('e vê que está pendente', minhas.find((p: any) => p.id === postId)?.status, 'PENDING')

  // ── 4. Arquivo que não é imagem ───────────────────────────────────
  console.log('\n4. Vídeo é recusado na porta')
  const recusa = await publicarComFoto('clipe.mp4', 'video/mp4', Buffer.from('nao importa'), 'vídeo')
  conferir('recusado', recusa.status, 400)
  conferir('com explicação', String(recusa.corpo?.message).includes('imagem'), true)

  // ── 5. Fila do painel e aprovação ─────────────────────────────────
  console.log('\n5. O painel lista a fila e aprova')
  const rFila = await fetch(`${API}/admin/projects/${PROJETO}/posts/pending`, { headers: comAdmin })
  const fila = await rFila.json()
  conferir('a fila responde', rFila.status, 200)
  conferir('a publicação está na fila', fila.posts?.some((p: any) => p.id === postId), true)
  conferir('a fila identifica quem publicou', fila.posts?.[0]?.user?.displayName?.length > 0, true)

  const rAprovar = await fetch(`${API}/admin/posts/${postId}/moderate`, {
    method: 'POST',
    headers: comAdmin,
    body: JSON.stringify({ aprovar: true }),
  })
  const aprovada = await rAprovar.json()
  conferir('aprovação aceita', rAprovar.status, 200)
  conferir('agora está publicada', aprovada.status, 'PUBLISHED')

  const depois = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { status: true, moderatedAt: true, moderatedById: true },
  })
  conferir('ficou registrado quando foi moderada', depois.moderatedAt !== null, true)
  conferir('e por quem', Boolean(depois.moderatedById), true)

  const auditoria = await prisma.adminAuditLog.findFirst({
    where: { entityType: 'Post', entityId: postId },
    select: { action: true },
  })
  conferir('a aprovação foi registrada na auditoria', auditoria?.action, 'post.approve')

  console.log('\n6. Moderar de novo não é possível')
  const rDeNovo = await fetch(`${API}/admin/posts/${postId}/moderate`, {
    method: 'POST',
    headers: comAdmin,
    body: JSON.stringify({ aprovar: false }),
  })
  conferir('segunda moderação recusada', rDeNovo.status, 400)

  // ── 7. Recusa ─────────────────────────────────────────────────────
  console.log('\n7. Uma publicação recusada não some, fica com o motivo')
  const pub2 = await publicarComFoto('outra.png', 'image/png', PNG_1X1, 'outra foto')
  const post2: string = pub2.corpo?.id
  const rRecusar = await fetch(`${API}/admin/posts/${post2}/moderate`, {
    method: 'POST',
    headers: comAdmin,
    body: JSON.stringify({ aprovar: false, nota: 'A foto mostra o rosto de outra criança.' }),
  })
  const recusada = await rRecusar.json()
  conferir('recusa aceita', rRecusar.status, 200)
  conferir('ficou como recusada', recusada.status, 'REJECTED')
  conferir('com o motivo', recusada.moderationNote, 'A foto mostra o rosto de outra criança.')

  const minhas2 = await (await fetch(`${API}/me/posts`, { headers: comAna })).json()
  const vista = minhas2.find((p: any) => p.id === post2)
  conferir('a autora continua vendo, com o motivo', vista?.moderationNote?.length > 0, true)

  // ── 8. Teto da fila ───────────────────────────────────────────────
  console.log('\n8. Uma conta sozinha não enche a fila do responsável')
  const enviadas: number[] = []
  for (let i = 0; i < 6; i++) {
    const r = await publicarComFoto(`spam${i}.png`, 'image/png', PNG_1X1, `foto ${i}`)
    enviadas.push(r.status)
  }
  conferir('as cinco primeiras entram', enviadas.slice(0, 5).every((s) => s === 201), true)
  conferir('a sexta é recusada', enviadas[5], 400)

  // ── 9. Sem foto continua direto ───────────────────────────────────
  console.log('\n9. Publicação sem foto continua saindo na hora')
  const rSemFoto = await fetch(`${API}/contents/${conteudo.id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...comAna },
    body: JSON.stringify({ projectId: projeto.id, body: 'Essa música é a minha preferida' }),
  })
  const semFoto = await rSemFoto.json()
  conferir('publicada na hora', semFoto.status, 'PUBLISHED')
  conferir('sem esperar aprovação', semFoto.aguardandoAprovacao, false)

  // ── 10. A chave do painel ─────────────────────────────────────────
  console.log('\n10. Desligar a aprovação prévia faz a foto sair na hora')
  const trocar = async (exigir: boolean) => {
    const r = await fetch(`${API}/admin/projects/${PROJETO}/photo-approval`, {
      method: 'POST',
      headers: comAdmin,
      body: JSON.stringify({ exigir }),
    })
    return { status: r.status, corpo: await r.json().catch(() => null) }
  }

  const desligou = await trocar(false)
  conferir('a chave desliga', desligou.corpo?.photoApprovalRequired, false)

  const semFila = await publicarComFoto('direto.png', 'image/png', PNG_1X1, 'sem fila')
  conferir('a foto nasce publicada', semFila.corpo?.status, 'PUBLISHED')
  conferir('e a tela não promete aprovação', semFila.corpo?.aguardandoAprovacao, false)
  conferir('a foto continua guardada', Boolean(semFila.corpo?.imageAsset?.url), true)

  // O teto da fila não pode barrar quem publica direto: sem aprovação não há
  // fila para encher, e as pendentes antigas travariam publicações novas.
  const aindaPendentes = await prisma.post.count({ where: { userId: usuarioAna, status: 'PENDING' } })
  const extra = await publicarComFoto('direto2.png', 'image/png', PNG_1X1, 'sem fila 2')
  conferir(`o teto não se aplica (${aindaPendentes} pendentes antigas)`, extra.status, 201)

  const ligou = await trocar(true)
  conferir('a chave liga de volta', ligou.corpo?.photoApprovalRequired, true)

  // Com outra conta: a Ana já tem cinco na fila, e o teto é por pessoa. Usar a
  // conta dela aqui verificaria o teto, não a chave.
  const rBia = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: projeto.id,
      email: `foto_bia_${sufixo}@teste.local`,
      password: 'senhaDeTeste123',
      displayName: 'Bia',
    }),
  })
  const bia = await rBia.json()
  emails.push(bia.user.email)
  const comBia = { Authorization: `Bearer ${bia.accessToken}` }

  const deNovo = await publicarComFoto('espera.png', 'image/png', PNG_1X1, 'espera de novo', comBia)
  conferir('e a foto volta a esperar', deNovo.corpo?.status, 'PENDING')

  const travadaPeloTeto = await publicarComFoto('teto.png', 'image/png', PNG_1X1, 'teto', comAna)
  conferir('o teto da Ana volta a valer com a chave ligada', travadaPeloTeto.status, 400)

  const trocas = await prisma.adminAuditLog.count({
    where: { action: { in: ['project.photo_approval.on', 'project.photo_approval.off'] } },
  })
  conferir('as duas trocas ficaram registradas na auditoria', trocas >= 2, true)

  // ── Limpeza ───────────────────────────────────────────────────────
  // A chave é estado do projeto, não do teste: devolve como estava.
  await trocar(true)

  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
  const ids = users.map((u) => u.id)
  const assets = await prisma.mediaAsset.findMany({
    where: { uploadedById: { in: ids } },
    select: { id: true, url: true },
  })
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL pv.allow_event_purge = 'on'`)
    await tx.event.deleteMany({ where: { userId: { in: ids } } })
    await tx.adminAuditLog.deleteMany({ where: { userId: { in: ids } } })
    await tx.post.deleteMany({ where: { userId: { in: ids } } })
    await tx.mediaAsset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } })
    await tx.refreshToken.deleteMany({ where: { userId: { in: ids } } })
    await tx.visitor.updateMany({ where: { userId: { in: ids } }, data: { userId: null } })
    await tx.user.deleteMany({ where: { id: { in: ids } } })
  })
  const raiz = process.env.UPLOAD_DIR ?? './uploads'
  for (const a of assets) {
    const caminho = join(raiz, a.url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/uploads\//, ''))
    if (existsSync(caminho)) unlinkSync(caminho)
  }

  console.log(
    falhas === 0
      ? '\n✓ Foto no My Post: tudo verificado contra a API no ar.\n'
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
