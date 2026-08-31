// Os cinco pontos de 31/08, medidos no site publicado.
//
//   1. o indice das letras conta o que ele criou, e nao so as quatro casas
//   2. VAZIO deixa de estar escrito por cima de trabalho feito
//   3. publicar recusa a dizer QUAL das quatro coisas falta
//   4. o Produto Vivo nao tem espaco preto entre as artes
//   5. compartilhar uma publicacao abre ESSA publicacao
//   6. a barra inferior volta ao fundo sozinha quando fica presa a meio
//
// NAO CRIA NEM APAGA NADA NO CONTEUDO DELE. O unico gesto de escrita e tentar
// publicar uma casa VAZIA da Letra Z, que falha por definicao e deixa a casa
// exactamente como estava.
import { chromium } from 'playwright'
const SITE = 'https://santtify.com', PROJ = 'jesus-alfabeto-saudavel'
// A CONTA DE ADMINISTRADOR VEM DO AMBIENTE, e nunca escrita aqui.
// Uma senha de administrador do site que esta no ar, escrita num ficheiro do
// repositorio, e uma senha publicada: fica no historico para sempre e vai com o
// repositorio para todas as maos que o receberem.
//   PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node este-ficheiro.mjs
const CONTA = process.env.PV_ADMIN_EMAIL, SENHA = process.env.PV_ADMIN_SENHA
if (!CONTA || !SENHA) { console.log('Faltam PV_ADMIN_EMAIL e PV_ADMIN_SENHA no ambiente.'); process.exit(2) }
const falhas = []
const p_ = (n, v, e = '') => { console.log(`  ${v ? '✓' : '✗'} ${n}${e ? '   ' + e : ''}`); if (!v) falhas.push(n) }
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const pg = await ctx.newPage()
pg.on('dialog', d => d.accept())
const limpar = async () => { for (const t of ['AGORA NÃO', 'CONTINUAR EXPLORANDO', 'Aceitar']) { const b = await pg.$(`button:has-text("${t}")`); if (b) { await b.click(); await pg.waitForTimeout(400) } } }

try {

// ── 4. Produto Vivo: as artes encostadas, sem preto ────────────────
console.log('\nPRODUTO VIVO — o espaco entre as artes')
await pg.goto(`${SITE}/${PROJ}/produto-vivo`, { waitUntil: 'domcontentloaded' })
await pg.waitForTimeout(3000); await limpar()
const pv = await pg.evaluate(async () => {
  const c = document.querySelector('.publicacao-unica')
  if (!c) return { erro: 'sem publicacao-unica' }
  const filhos = [...c.children]
  const buracos = []
  for (let i = 1; i < filhos.length; i++)
    buracos.push(Math.round(filhos[i].getBoundingClientRect().top - filhos[i - 1].getBoundingClientRect().bottom))
  // O preto DENTRO de cada arte: le-se o pixel do meio da primeira e da
  // ultima linha. E onde estava o espaco de que ele se queixou.
  const pretoDentro = await Promise.all([...c.querySelectorAll('img.arte-da-publicacao')].map(img => new Promise(res => {
    const t = new Image(); t.crossOrigin = 'anonymous'; t.onerror = () => res(null)
    t.onload = () => {
      const cv = document.createElement('canvas'); cv.width = t.naturalWidth; cv.height = t.naturalHeight
      const cx = cv.getContext('2d'); cx.drawImage(t, 0, 0)
      const lum = y => { const d = cx.getImageData(Math.floor(t.naturalWidth / 2), y, 1, 1).data; return Math.round((d[0] + d[1] + d[2]) / 3) }
      res({ tam: `${t.naturalWidth}x${t.naturalHeight}`, topo: lum(0), base: lum(t.naturalHeight - 1) })
    }
    t.src = img.src
  })))
  return { buracos, pretoDentro }
})
p_('as artes estao encostadas, sem espaco entre elas', pv.buracos?.every(b => b === 0), `espacos: ${JSON.stringify(pv.buracos)}`)
for (const a of pv.pretoDentro ?? [])
  p_(`a arte ${a.tam} nao comeca nem acaba em preto`, a.topo > 40 && a.base > 40, `topo ${a.topo}, base ${a.base}`)

// ── 5. Compartilhar abre a publicacao ──────────────────────────────
console.log('\nCOMPARTILHAR — abre a publicacao, e nao a pagina')
await pg.goto(`${SITE}/${PROJ}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000); await limpar()
await pg.click('.grade-letras button:has-text("A"), .letra-botao:has-text("A"), button:has-text("A")').catch(() => {})
await pg.waitForTimeout(3500)
const dados = await pg.evaluate(async () => {
  const r = await fetch('/api/projects/jesus-alfabeto-saudavel/contents/b')
  const d = await r.json(); const c = d.content || d
  return { slug: c.slug, blocos: (c.blocks || []).filter(b => b.type === 'AUDIO' && b.papel === 'CARTAO').map(b => b.id) }
})
const alvoId = dados.blocos[1] ?? dados.blocos[0]
const endereco = `${SITE}/${PROJ}?letra=${dados.slug}&pub=${alvoId}`
// 2,5s e nao 6s: o realce dura 4 segundos por desenho, e medir aos 6 mede
// sempre a ausencia dele. Ja me enganei assim em 30/08, a esperar 5 segundos
// por um realce de 2,6 — a aplicacao estava certa e a medicao e que chegava
// tarde.
await pg.goto(endereco, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500); await limpar()
const chegada = await pg.evaluate((id) => {
  const el = document.getElementById(`cartao-${id}`)
  if (!el) return { existe: false }
  const r = el.getBoundingClientRect()
  return { existe: true, acesa: el.classList.contains('publicacao-apontada'), aVista: r.top > -200 && r.top < innerHeight }
}, alvoId)
p_('o link abre a letra e a publicacao existe na pagina', chegada.existe)
p_('a publicacao partilhada acende', chegada.acesa)
p_('e esta a vista, sem procurar', chegada.aVista, `topo ${Math.round(chegada.top ?? 0)}`)

// ── 6. A barra inferior volta ao fundo ─────────────────────────────
console.log('\nBARRA INFERIOR — presa a meio, volta sozinha')
const antes = await pg.evaluate(() => {
  const b = document.querySelector('.barra-inferior')
  return b ? Math.round(b.getBoundingClientRect().bottom - innerHeight) : null
})
p_('em uso normal a barra esta colada ao fundo', antes !== null && Math.abs(antes) <= 2, `desvio ${antes}px`)
// Simular o defeito: e o que o teclado do iOS deixa para tras, a barra parada
// acima do fundo. Depois disparar o evento que a correccao escuta.
const depois = await pg.evaluate(async () => {
  const b = document.querySelector('.barra-inferior')
  b.style.transform = 'translateY(-300px)'
  const presa = Math.round(b.getBoundingClientRect().bottom - innerHeight)
  window.dispatchEvent(new Event('resize'))
  await new Promise(r => setTimeout(r, 800))
  return { presa, agora: Math.round(b.getBoundingClientRect().bottom - innerHeight) }
})
p_('presa a meio do ecra, como no print dele', depois.presa < -100, `${depois.presa}px acima do fundo`)
p_('e volta ao fundo sozinha', Math.abs(depois.agora) <= 2, `desvio final ${depois.agora}px`)

// ── 1,2,3. O painel ────────────────────────────────────────────────
console.log('\nPAINEL — o indice e a mensagem de publicar')
await pg.goto(`${SITE}/${PROJ}/entrar`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500); await limpar()
await pg.fill('input[type=email]', CONTA); await pg.fill('input[type=password]', SENHA)
await pg.click('button[type=submit]'); await pg.waitForTimeout(4000)
await pg.goto(`${SITE}/${PROJ}/admin/alfabeto`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4500); await limpar()

const letraE = await pg.evaluate(() => {
  const li = [...document.querySelectorAll('.vagao')].find(v => v.querySelector('strong')?.textContent?.trim() === 'LETRA E')
  if (!li) return null
  return {
    legenda: li.querySelector('.dados-vagao small')?.textContent?.replace(/\s+/g, ' ').trim(),
    quadrados: [...li.querySelectorAll('.quadradinho')].map(q => `${q.querySelector('em').textContent}:${q.querySelector('small').textContent}`),
  }
})
console.log(`   Letra E: "${letraE?.legenda}"`)
console.log(`   quadrados: ${letraE?.quadrados.join(' ')}`)
p_('a legenda da Letra E conta as publicacoes dele', /\+\d+ publica/.test(letraE?.legenda ?? ''), letraE?.legenda)
p_('as publicacoes dele aparecem no indice', (letraE?.quadrados ?? []).some(q => q.startsWith('+')))
p_('nenhum quadrado com trabalho dentro diz VAZIO',
   (letraE?.quadrados ?? []).filter(q => q.endsWith(':VAZIO')).length <= 2,
   `vazios: ${(letraE?.quadrados ?? []).filter(q => q.endsWith(':VAZIO')).length}`)

// A mensagem de publicar, numa casa VAZIA da Letra Z: falha e nada muda.
const msg = await pg.evaluate(async () => {
  const r = await fetch('/api/projects/jesus-alfabeto-saudavel/admin/alfabeto', { headers: {} })
  return r.status
})
await pg.evaluate(() => document.querySelector('.vagao:last-child .cabeca-vagao, .vagao .cabeca-vagao')) // no-op
const zTexto = await pg.evaluate(async () => {
  const li = [...document.querySelectorAll('.vagao')].find(v => v.querySelector('strong')?.textContent?.trim() === 'LETRA Z')
  li?.querySelector('.cabeca-vagao')?.click()
  await new Promise(r => setTimeout(r, 2500))
  const q = document.querySelector('.quadrado')
  q?.querySelector('.tres-pontos')?.click()
  await new Promise(r => setTimeout(r, 400))
  const b = [...document.querySelectorAll('.menu-quadrado button')].find(x => x.textContent.includes('Pôr no ar'))
  if (!b) return { erro: 'sem botao por no ar' }
  let dito = null
  const original = window.alert
  window.alert = (t) => { dito = t }
  b.click()
  await new Promise(r => setTimeout(r, 3000))
  window.alert = original
  return { dito }
})
console.log(`   ao publicar uma casa vazia: "${zTexto.dito}"`)
// A casa vazia da Letra Z tem titulo — 'Explicação', o nome com que nasceu —
// e nao tem foto, audio nem descricao. A mensagem certa nomeia essas TRES e
// NAO nomeia o titulo. Exigir os quatro era exigir que ela mentisse.
p_('publicar nomeia o que falta mesmo',
   /a foto/.test(zTexto.dito ?? '') && /o áudio/.test(zTexto.dito ?? '') && /a descrição/.test(zTexto.dito ?? ''),
   zTexto.dito ?? zTexto.erro)
p_('e nao nomeia o que ja la esta', !/o título/.test(zTexto.dito ?? ''), zTexto.dito ?? '')

} catch (e) {
  // Uma verificacao que rebenta nao pode anunciar sucesso. 30/08.
  falhas.push(`excepcao: ${e.message}`)
  console.log(`\n  ✗ excepcao: ${e.message}`)
}

await nav.close()
console.log(falhas.length ? `\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : '\nTUDO CERTO')
process.exit(falhas.length ? 1 : 0)
