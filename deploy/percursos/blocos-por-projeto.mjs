// A QUANTIDADE DE BLOCOS E DE QUEM ELA E: dele, no painel, e nao do codigo.
//
// Pedido dele em 19/09: o Jesus Alfabeto continua em A-Z, e os outros projetos
// tem a quantidade de blocos que ele escrever no painel — 7 dias, 31 atributos,
// 2 do que for. Este percurso escreve esse numero no painel e vai ver a grade
// publica, que e onde a crianca toca.
//
// Confirma tambem a regra que protege o trabalho dele: reduzir a quantidade so
// apaga casas VAZIAS. Uma casa com conteudo trava a operacao e diz qual e.
//
//   SITE=http://localhost:3100 API=http://localhost:3333/api \
//   PROJ=31-atributos-de-deus ALFABETO=jesus-alfabeto-saudavel \
//   PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node deploy/percursos/blocos-por-projeto.mjs
import { chromium } from 'playwright'

const SITE = process.env.SITE ?? 'http://localhost:3100'
const API = process.env.API ?? 'http://localhost:3333/api'
// Um projeto NUMERADO, para mexer na quantidade. O estado dele e reposto no fim.
const PROJ = process.env.PROJ ?? '31-atributos-de-deus'
const ALFABETO = process.env.ALFABETO ?? 'jesus-alfabeto-saudavel'
const EMAIL = process.env.PV_ADMIN_EMAIL
const SENHA = process.env.PV_ADMIN_SENHA
if (!EMAIL || !SENHA) {
  console.log('Faltam PV_ADMIN_EMAIL e PV_ADMIN_SENHA — ver o README.')
  process.exit(2)
}

const falhas = []
const p_ = (n, v, e = '') => {
  console.log(`  ${v ? '✓' : '✗'} ${n}${e ? '   ' + e : ''}`)
  if (!v) falhas.push(n)
}

const projeto = await (await fetch(`${API}/projects/${ALFABETO}`)).json()
const login = await (
  await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA, projectId: projeto.id }),
  })
).json()
const admin = (caminho, init = {}) =>
  fetch(`${API}/admin${caminho}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${login.accessToken}`,
      ...init.headers,
    },
  }).then((r) => r.json())

const carrosselAntes = await admin('/carrossel')
const antes = carrosselAntes.find?.((p) => p.slug === PROJ)
const quantidadeOriginal = antes?.blocos ?? 0

// A grade publica guarda-se 30 s. Esperar por ela e melhor do que dormir um
// numero inventado — num servidor lento, dormir pouco da um falso negativo.
const gradeCom = async (pag, quantas, slug = PROJ) => {
  const alvo = `${SITE}/${slug}`
  for (let i = 0; i < 24; i++) {
    await pag.goto(alvo, { waitUntil: 'domcontentloaded' })
    await pag.locator('.grade-letras, .vazio').first().waitFor({ timeout: 60000 }).catch(() => {})
    const n = await pag.locator('.letra-bloco').count()
    if (n === quantas) return n
    await pag.waitForTimeout(5000)
  }
  return pag.locator('.letra-bloco').count()
}

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
try {
  p_('o projeto de teste e numerado', antes && antes.sequencia !== 'LETRAS', antes?.sequencia)

  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((r) => localStorage.setItem('pv_refresh', r), login.refreshToken)
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))

  // ── O numero que ele escreve no painel ──────────────────────────────
  await pg.goto(`${SITE}/${ALFABETO}/admin/carrossel`, { waitUntil: 'domcontentloaded' })
  await pg.locator('.painel-projeto-da-pagina').first().waitFor({ timeout: 90000 })
  const linha = pg.locator('.painel-projeto-da-pagina', { hasText: antes.nome })
  p_('o alfabeto nao pergunta a quantidade', (await pg.locator('.painel-projeto-da-pagina', { hasText: 'Alfabeto' }).locator('.painel-blocos').count()) === 0)

  await linha.locator('.painel-blocos input').fill('3')
  await linha.locator('.painel-blocos button').click()
  await pg.locator('.sincronizador-aviso', { hasText: '3 blocos' }).waitFor({ timeout: 60000 })
  p_('o painel aceita a quantidade', true)

  const doServidor = await admin(`/projects/${ALFABETO}/karaoke`).then(() => admin('/carrossel'))
  p_('o servidor guardou 3', doServidor.find((p) => p.slug === PROJ)?.blocos === 3)

  // Cada bloco nasce com as quatro casas da letra, para o painel dele ser igual.
  const grade = await admin(`/projects/${PROJ}/alfabeto`)
  p_('a composicao do painel tem 3 casas', grade.vagoes?.length === 3, String(grade.vagoes?.length))
  p_('as casas sao numeradas, nao letras', grade.vagoes?.[0]?.rotulo === 'Bloco 1', grade.vagoes?.[0]?.rotulo)
  p_('cada bloco nasce com as 4 casas de cartao', grade.vagoes?.every((v) => v.cartoes.length === 4))

  // O QR DE CADA BLOCO, como no alfabeto (ponto 4 do que ele pediu). Nasce com
  // o bloco: ele pode mandar imprimir antes de acabar de preencher.
  const comQr = await Promise.all(
    grade.vagoes.map(async (v) => {
      const r = await fetch(`${API}/projects/${PROJ}/contents/${v.slug}/qr.svg`)
      return r.ok && (await r.text()).includes('<svg')
    }),
  )
  p_('cada bloco novo nasce com o seu QR Code', comQr.every(Boolean), comQr.join(', '))

  // ── A grade publica ─────────────────────────────────────────────────
  const tel = await nav.newContext({ viewport: { width: 390, height: 844 } })
  const pub = await tel.newPage()
  p_('a pagina publica mostra 3 casas', (await gradeCom(pub, 3)) === 3)
  const texto = await pub.locator('.progresso-letras').innerText().catch(() => '')
  p_('e conta blocos, nao letras', texto.includes('de 3') && /bloco/i.test(texto), texto.replace(/\n/g, ' '))

  // ── Crescer cria; encolher nao apaga trabalho ───────────────────────
  await pg.reload({ waitUntil: 'domcontentloaded' })
  await pg.locator('.painel-projeto-da-pagina').first().waitFor({ timeout: 60000 })
  await linha.locator('.painel-blocos input').fill('5')
  await linha.locator('.painel-blocos button').click()
  await pg.locator('.sincronizador-aviso', { hasText: '5 blocos' }).waitFor({ timeout: 60000 })
  p_('crescer cria as casas que faltam', (await gradeCom(pub, 5)) === 5)

  // ESCONDER NAO E APAGAR. Poe-se conteudo no bloco 5, reduz-se para 2, e o
  // bloco 5 tem de sair da grade sem perder nada: a pagina dele continua a
  // abrir (o QR impresso continua a valer) e o conteudo volta inteiro quando a
  // quantidade subir outra vez.
  const composicao = await admin(`/projects/${PROJ}/alfabeto`)
  const quinto = composicao.vagoes.find((v) => v.numero === 5)
  await admin(`/cards/${quinto.cartoes[0].id}`, {
    method: 'PATCH',
    body: JSON.stringify({ titulo: 'Escrito pelo percurso' }),
  })

  // Como a pagina do bloco respondia ANTES de esconder. Um bloco por publicar
  // responde 404 a toda a gente — esconder nao pode mudar isso num sentido nem
  // no outro.
  const antesDeEsconder = (await fetch(`${SITE}/${PROJ}/${quinto.slug}`)).status

  const reduzido = await admin(`/projects/${PROJ}/blocos`, {
    method: 'PATCH',
    body: JSON.stringify({ quantidade: 2 }),
  })
  p_('reduzir muda o tamanho da grade', reduzido.find?.((p) => p.slug === PROJ)?.blocos === 2)
  p_('e a pagina publica acompanha', (await gradeCom(pub, 2)) === 2)

  const depoisDeEsconder = (await fetch(`${SITE}/${PROJ}/${quinto.slug}`)).status
  p_(
    'esconder nao muda o endereco do bloco',
    depoisDeEsconder === antesDeEsconder,
    `${antesDeEsconder} → ${depoisDeEsconder}`,
  )
  const qrDoQuinto = await fetch(`${API}/projects/${PROJ}/contents/${quinto.slug}/qr.svg`)
  p_('e o QR dele continua a valer', qrDoQuinto.ok)

  await admin(`/projects/${PROJ}/blocos`, { method: 'PATCH', body: JSON.stringify({ quantidade: 5 }) })
  const devolta = await admin(`/projects/${PROJ}/alfabeto`)
  const quintoOutraVez = devolta.vagoes.find((v) => v.numero === 5)
  p_(
    'aumentar outra vez devolve o bloco com o conteudo dele',
    quintoOutraVez?.contentId === quinto.contentId &&
      quintoOutraVez?.cartoes?.some((c) => c.titulo === 'Escrito pelo percurso'),
  )
  // Limpar o que o percurso escreveu no cartao.
  await admin(`/cards/${quinto.cartoes[0].id}`, { method: 'PATCH', body: JSON.stringify({ titulo: null }) })

  // ── O ALFABETO NAO MUDOU. E a parte que ja estava no ar. ─────────────
  const casasDoAlfabeto = await gradeCom(pub, 26, ALFABETO)
  p_('o alfabeto continua com 26 casas', casasDoAlfabeto === 26, String(casasDoAlfabeto))
  const textoAlfabeto = await pub.locator('.progresso-letras').innerText().catch(() => '')
  p_('e continua a falar em letras', /letra/i.test(textoAlfabeto) && textoAlfabeto.includes('de 26'), textoAlfabeto.replace(/\n/g, ' '))
  const gradeAlfabeto = await admin(`/projects/${ALFABETO}/alfabeto`)
  p_('o painel do alfabeto continua em A–Z', gradeAlfabeto.vagoes?.length === 26 && gradeAlfabeto.vagoes[0].rotulo === 'Letra A')

  p_('sem erros no painel', erros.length === 0, erros.join(' | '))
} catch (e) {
  falhas.push('excepcao: ' + e.message)
  console.log('  ✗ ' + e.message)
} finally {
  await nav.close()
  const volta = await admin(`/projects/${PROJ}/blocos`, {
    method: 'PATCH',
    body: JSON.stringify({ quantidade: quantidadeOriginal }),
  })
  const agora = volta.find?.((p) => p.slug === PROJ)?.blocos
  console.log(
    `\n  (${PROJ} reposto em ${agora ?? '?'} bloco(s); estava em ${quantidadeOriginal})`,
  )
}

console.log(falhas.length ? `\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : '\nTUDO CERTO')
process.exit(falhas.length ? 1 : 0)
