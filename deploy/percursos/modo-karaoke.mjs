// O MODO KARAOKE DE PONTA A PONTA, como ele o vai usar e como a crianca o ve.
//
// Painel: colar a letra, tocar a musica, marcar as frases com o espaco,
// destacar uma palavra a mao, gravar e publicar. Pagina da letra: o tocador de
// sempre continua la, com o botao do karaoke por baixo. Karaoke: a palavra
// acesa e a que se esta a cantar, nada sai do ecra, e com "so com conta" quem
// nao entrou e convidado a entrar.
//
// Usa uma faixa que JA TEM AUDIO e deixa-a como estava: a letra, as marcas e
// o estado publicado sao lidos no inicio e repostos no fim, mesmo se falhar.
//
//   SITE=http://localhost:3100 API=http://localhost:3333/api \
//   PROJ=jesus-alfabeto-saudavel BLOCO=<id do cartao com audio> \
//   PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node deploy/percursos/modo-karaoke.mjs
import { chromium } from 'playwright'

const SITE = process.env.SITE ?? 'http://localhost:3100'
const API = process.env.API ?? 'http://localhost:3333/api'
const PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
const BLOCO = process.env.BLOCO
const EMAIL = process.env.PV_ADMIN_EMAIL
const SENHA = process.env.PV_ADMIN_SENHA
if (!BLOCO || !EMAIL || !SENHA) {
  console.log('Faltam BLOCO, PV_ADMIN_EMAIL ou PV_ADMIN_SENHA — ver o README.')
  process.exit(2)
}

const falhas = []
const p_ = (n, v, e = '') => {
  console.log(`  ${v ? '✓' : '✗'} ${n}${e ? '   ' + e : ''}`)
  if (!v) falhas.push(n)
}

const LETRA = [
  'Não mais eu, mas Cristo vive em mim',
  'Jesus me ensina a amar',
  'A luz do Espírito Santo me guia',
  'GRATIDÃO',
].join('\n')
/** Onde cada frase comeca na musica, em segundos. */
const TOQUES = [1.5, 5, 9, 13]

const projeto = await (await fetch(`${API}/projects/${PROJ}`)).json()
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
    headers: { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}`, ...init.headers },
  }).then((r) => r.json())

const antes = await admin(`/cards/${BLOCO}/karaoke`)
const painelAntes = await admin(`/projects/${PROJ}/karaoke`)
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
})

try {
  p_('a faixa tem audio', Boolean(antes.faixa?.audio), antes.faixa?.titulo)
  await admin(`/projects/${PROJ}/karaoke`, { method: 'PATCH', body: JSON.stringify({ acesso: 'TODOS' }) })
  for (const [palavra, nivel] of [['Cristo', 3], ['Jesus', 3], ['Luz', 2], ['Espírito Santo', 3]]) {
    await admin(`/projects/${PROJ}/karaoke/palavras`, { method: 'PUT', body: JSON.stringify({ palavra, nivel }) })
  }

  // ── Painel ──────────────────────────────────────────────────────────
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((r) => localStorage.setItem('pv_refresh', r), login.refreshToken)
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))

  await pg.goto(`${SITE}/${PROJ}/admin/karaoke`, { waitUntil: 'networkidle' })
  await pg.getByRole('heading', { name: /Músicas/ }).waitFor()
  p_('a lista de palavras mostra as da conta', (await pg.locator('.karaoke-palavra-texto').allTextContents()).some((t) => t === 'Espírito Santo'))
  // Dentro da lista "Musicas", e nao na pagina toda: desde 20/09 a oficina das
  // letras automaticas tambem tem um caminho para a mesma faixa, e contar os
  // links da pagina inteira passou a dar dois.
  p_(
    'a faixa aparece na lista de musicas',
    (await pg.locator(`.painel-projetos a[href$="/admin/karaoke/${BLOCO}"]`).count()) === 1,
  )

  await pg.goto(`${SITE}/${PROJ}/admin/karaoke/${BLOCO}`, { waitUntil: 'networkidle' })
  await pg.locator('.sincronizador-texto').fill(LETRA)
  await pg.getByRole('button', { name: 'Gravar a letra' }).click()
  // Esperar pela resposta, e não por quatro frases: a letra anterior pode ter
  // mais de quatro, e o percurso seguia com as frases velhas no ecrã.
  await pg.locator('.sincronizador-aviso', { hasText: 'Letra gravada' }).waitFor()
  p_('a letra fica em quatro frases', (await pg.locator('.sincronizador-frase').count()) === 4)

  // Limpa marcas que a faixa ja tivesse, para marcar do zero.
  for (let i = 0; i < 4; i++) {
    const limpar = pg.locator('.sincronizador-frase').nth(i).getByRole('button', { name: 'Apagar a marca' })
    if (await limpar.isEnabled()) await limpar.click()
  }
  // Como ele faz: tocar no ▶ da primeira frase põe o cursor nela e a música a
  // tocar. Apagar uma marca leva o cursor para essa frase, e sem isto o
  // percurso começava a marcar a partir da última que limpou.
  await pg.locator('.sincronizador-tempo').first().click()
  await pg.waitForFunction(() => !document.querySelector('audio').paused)
  await pg.locator('h1').click() // o foco fora das caixas de texto
  for (const s of TOQUES) {
    await pg.evaluate((t) => { document.querySelector('audio').currentTime = t }, s)
    await pg.waitForTimeout(150)
    await pg.keyboard.press('Space')
    if (process.env.DEPURAR) console.log('    ', s, (await pg.locator('.sincronizador-tempo').allTextContents()).join(' '), await pg.locator('.sincronizador-marcar small').textContent())
  }
  await pg.evaluate(() => document.querySelector('audio').pause())
  const tempos = await pg.locator('.sincronizador-tempo').allTextContents()
  p_('as quatro frases ficaram marcadas', tempos.every((t) => !t.includes('—')), tempos.join(' '))

  // O Z desfaz a ultima, e marcar outra vez repoe-na.
  await pg.keyboard.press('KeyZ')
  p_('Z desfaz a ultima marca', (await pg.locator('.sincronizador-tempo').nth(3).textContent()).includes('—'))
  await pg.evaluate((t) => { document.querySelector('audio').currentTime = t }, TOQUES[3])
  await pg.keyboard.press('Space')

  // Destaque manual: "mim" passa a maximo nesta musica.
  await pg.locator('.sincronizador-frase').nth(0).locator('.sincronizador-palavra', { hasText: 'mim' }).click()
  p_('a palavra tocada fica com destaque manual', (await pg.locator('.sincronizador-palavra.manual').count()) === 1)

  await pg.getByRole('button', { name: 'Gravar e publicar' }).click()
  await pg.locator('.sincronizador-aviso', { hasText: 'Publicado' }).waitFor()
  const gravada = await admin(`/cards/${BLOCO}/karaoke`)
  p_('gravada e publicada no servidor', gravada.letra.publicada === true)
  const inicios = gravada.letra.frases.map((f) => f.inicioMs)
  p_(
    'as marcas descontam o tempo do toque',
    inicios.every((ms, i) => Math.abs(ms - (TOQUES[i] * 1000 - 150)) < 400),
    inicios.join(', '),
  )
  p_('o destaque manual foi gravado', gravada.letra.frases[0].palavras.some((p) => p.texto === 'mim' && p.destaque === 3))
  p_('sem erros no painel', erros.length === 0, erros.join(' | '))
  await ctx.close()

  // ── Pagina da letra ─────────────────────────────────────────────────
  const telemovel = await nav.newContext({ viewport: { width: 390, height: 844 } })
  const pub = await telemovel.newPage()
  const conteudo = (await admin(`/cards/${BLOCO}/karaoke`)).faixa.conteudoSlug
  // Sem esperar pela rede parada: a página da letra carrega os áudios e nunca
  // chega a estar parada.
  await pub.goto(`${SITE}/${PROJ}/${conteudo}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  const botao = pub.locator(`a.entrar-no-karaoke[href$="/karaoke/${BLOCO}"]`)
  await botao.waitFor({ timeout: 60000 }).catch(() => {})
  p_('o botao do karaoke aparece na faixa', (await botao.count()) === 1)
  p_(
    'o tocador de sempre continua la',
    (await botao.locator('xpath=preceding-sibling::*[1]').getAttribute('class'))?.includes('player-onda') ?? false,
  )

  // ── Karaoke ─────────────────────────────────────────────────────────
  await botao.click()
  await pub.waitForURL(`**/karaoke/${BLOCO}`)
  await pub.locator('.k-palco').waitFor()
  p_('sem barrinhas de audio no karaoke', (await pub.locator('.onda, .barra').count()) === 0)
  await pub.evaluate(() => document.querySelector('.karaoke-play').click())
  const acesas = []
  // A música continua a tocar enquanto se espera, por isso os instantes caem
  // a meio de palavras compridas e não no começo de uma curta.
  for (const [t, esperada] of [[TOQUES[1] + 0.2, 'Jesus'], [TOQUES[2] + 1.2, 'Espírito']]) {
    await pub.evaluate((s) => { document.querySelector('audio').currentTime = s }, t)
    await pub.waitForTimeout(350)
    const acesa = await pub.locator('.k-palavra.a-cantar').textContent().catch(() => null)
    acesas.push(`${t}s→${acesa}`)
    p_(`aos ${t}s acende "${esperada}"`, acesa === esperada, acesa ?? 'nenhuma')
  }
  await pub.evaluate((s) => { document.querySelector('audio').currentTime = s }, TOQUES[3] + 0.3)
  await pub.waitForTimeout(350)
  // Medido como o palco mede: com a palavra cantada parada, que o pulo dela é
  // de propósito maior do que a linha durante meio segundo.
  const cabe = async () =>
    pub.evaluate(() => {
      const palco = document.querySelector('.k-palco')
      palco.classList.add('a-medir')
      const ok =
        [...document.querySelectorAll('.k-linha')].every((l) => l.scrollWidth <= l.clientWidth + 1) &&
        document.documentElement.scrollWidth <= window.innerWidth
      palco.classList.remove('a-medir')
      return ok
    })
  p_('GRATIDAO cabe no ecra a 390px', await cabe())
  await pub.setViewportSize({ width: 320, height: 640 })
  await pub.waitForTimeout(300)
  p_('e a 320px', await cabe())
  p_('o cabecalho continua visivel', (await pub.locator('.karaoke-topo').boundingBox()).y >= 0)
  await telemovel.close()

  // ── So com conta ────────────────────────────────────────────────────
  await admin(`/projects/${PROJ}/karaoke`, { method: 'PATCH', body: JSON.stringify({ acesso: 'CONTA' }) })
  const anonimo = await nav.newContext({ viewport: { width: 390, height: 844 } })
  const an = await anonimo.newPage()
  await an.goto(`${SITE}/${PROJ}/karaoke/${BLOCO}`, { waitUntil: 'domcontentloaded' })
  await an.getByText('Entre para cantar').waitFor({ timeout: 30000 }).catch(() => {})
  p_('sem conta, convida a entrar', (await an.getByText('Entre para cantar').count()) === 1)
  await anonimo.close()
  await admin(`/projects/${PROJ}/karaoke`, { method: 'PATCH', body: JSON.stringify({ acesso: 'DESLIGADO' }) })
  const d = await (await fetch(`${API}/projects/${PROJ}/contents/${conteudo}`)).json()
  p_('desligado, o botao desaparece', d.content.blocks.find((b) => b.id === BLOCO)?.karaoke === false)
} catch (e) {
  falhas.push('excepcao: ' + e.message)
  console.log('  ✗ ' + e.message)
} finally {
  await nav.close()
  // Repor a faixa e o projeto como estavam.
  await admin(`/cards/${BLOCO}/karaoke`, { method: 'PUT', body: JSON.stringify({ texto: antes.letra.texto }) })
  if (antes.letra.frases.length) {
    await admin(`/cards/${BLOCO}/karaoke`, {
      method: 'PUT',
      body: JSON.stringify({ frases: antes.letra.frases, publicada: antes.letra.publicada }),
    })
  }
  await admin(`/projects/${PROJ}/karaoke`, { method: 'PATCH', body: JSON.stringify({ acesso: painelAntes.acesso }) })
  const agora = (await admin(`/projects/${PROJ}/karaoke`)).palavras.map((p) => p.palavra)
  const tinha = new Set(painelAntes.palavras.map((p) => p.palavra))
  for (const p of (await admin(`/projects/${PROJ}/karaoke`)).palavras) {
    if (!tinha.has(p.palavra)) await admin(`/karaoke/palavras/${p.id}`, { method: 'DELETE' })
  }
  for (const p of painelAntes.palavras) {
    if (agora.includes(p.palavra)) {
      await admin(`/projects/${PROJ}/karaoke/palavras`, {
        method: 'PUT',
        body: JSON.stringify({ palavra: p.exibicao, nivel: p.nivel }),
      })
    }
  }
  console.log('\n  (faixa, acesso e palavras repostos como estavam)')
}

console.log(falhas.length ? `\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : '\nTUDO CERTO')
process.exit(falhas.length ? 1 : 0)
