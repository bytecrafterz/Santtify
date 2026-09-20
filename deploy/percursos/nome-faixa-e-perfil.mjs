// O nome do atalho, a faixa azul e o caminho do perfil.
//
// O NOME: eu tinha o manifesto, o apple-mobile-web-app-title e a marca de
// compatibilidade todos a dizer Santtify, e o iPhone continuava a propor o
// titulo da pagina. A fotografia dele deu a resposta — a frase no campo era
// exactamente o <title> que eu compunha. O Safari passa a frente das tres.
//
// A FAIXA AZUL ficava sempre em TODOS por causa dos dados: das 127 faixas so
// 16 tem categoria escolhida no painel.
import { chromium } from 'playwright'
const SITE = process.env.SITE ?? 'https://santtify.com', PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const nav=await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
try{
console.log('\n1. O NOME DO ATALHO')
for (const u of ['/jesus-alfabeto-saudavel','/jesus-alfabeto-saudavel/e','/jesus-alfabeto-saudavel/b/cartao','/jesus-alfabeto-saudavel/produto-vivo','/jesus-alfabeto-saudavel/perfil']) {
  const h=await (await fetch(SITE+u)).text()
  const t=(h.match(/<title>([^<]*)<\/title>/)||[])[1]
  p_(`o titulo de ${u} e Santtify`, t==='Santtify', t)
}
const h=await (await fetch(`${SITE}/jesus-alfabeto-saudavel/e`)).text()
p_('e o cartao da mensagem continua descritivo',
   /og:title" content="(?!Santtify")/.test(h), (h.match(/og:title" content="([^"]*)"/)||[])[1])

console.log('\n2. A FAIXA AZUL SEGUE A FAIXA')
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]',process.env.PV_ADMIN_EMAIL);await pg.fill('input[type=password]',process.env.PV_ADMIN_SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)
await pg.goto(`${SITE}/${PROJ}/b`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);await limpar()
const azuis=await pg.evaluate(async()=>{
  const r=[]
  const audios=[...document.querySelectorAll('audio')]
  for (const i of [0,1,2]) {
    const a=audios[i]; if(!a) continue
    audios.forEach(x=>{x.muted=true; x.pause()})
    await a.play().catch(()=>{}); await new Promise(s=>setTimeout(s,900))
    const menu=[...document.querySelectorAll('.menu-player')][i]; menu?.click()
    await new Promise(s=>setTimeout(s,500))
    const az=[...document.querySelectorAll('.menu-categorias button.a-tocar')].map(b=>b.textContent.trim())
    const casa=a.closest('.publicacao')?.querySelector('.titulo-publicacao')?.textContent?.trim()
    r.push({casa, azul:az[0]??null, quantos:az.length})
    menu?.click(); await new Promise(s=>setTimeout(s,300))
  }
  return r})
for(const x of azuis) console.log(`   "${x.casa}" -> azul em ${x.azul}`)
p_('cada faixa acende a sua', new Set(azuis.map(x=>x.azul)).size>1, azuis.map(x=>x.azul).join(' / '))
p_('e so uma de cada vez', azuis.every(x=>x.quantos===1))

console.log('\n3. O CAMINHO DO PERFIL')
await pg.goto(`${SITE}/${PROJ}/pessoa/b34ff502-a4d9-4cb7-b2a2-e5e9b302a005`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4000);await limpar()
const m=await pg.$('.perfil-capa button[aria-label*="pções"], .canto-direito button')
if(m){ await m.click(); await pg.waitForTimeout(800)
  const l=await pg.$('a:has-text("O meu perfil")')
  const href=l? await l.getAttribute('href') : null
  p_('"O meu perfil" leva ao perfil visto de fora', /\/pessoa\//.test(href??''), href)
  if(l){ await l.click(); await pg.waitForTimeout(4000); await limpar()
    const r=await pg.evaluate(()=>({url:location.pathname, antigo:Boolean(document.querySelector('.perfil-topo'))}))
    p_('e nao abre a area de conta', r.antigo===false, JSON.stringify(r)) } }
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')

/* O CODIGO DE SAIDA DIZ O MESMO QUE O ECRA.
   Sem isto o percurso imprimia "FALHOU" e saia com 0, e quem corre a suite
   pelo codigo de saida via "ok". Foi assim que uma conta de teste ficou viva
   no site dele em 08/09: a limpeza falhou, o percurso disse-o, e ninguem ouviu. */
process.exit(falhas.length ? 1 : 0)
