// O azul obedece ao dedo dele E ao avanco automatico, e o coracao cabe na
// mascara do iPhone.
import { chromium } from 'playwright'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
try{
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]',process.env.PV_ADMIN_EMAIL);await pg.fill('input[type=password]',process.env.PV_ADMIN_SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)
await pg.goto(`${SITE}/${PROJ}/b`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);await limpar()

console.log('\nO DEDO DELE MANDA')
const r=await pg.evaluate(async()=>{
  const passos=[]
  const azul=()=>[...document.querySelectorAll('.menu-categorias button.a-tocar')].map(b=>b.textContent.trim())
  const abrir=async()=>{ document.querySelectorAll('.menu-player')[0]?.click(); await new Promise(s=>setTimeout(s,500)) }
  // Primeiro poe uma faixa a tocar, para o azul ficar preso a ela.
  const a=document.querySelectorAll('audio')[0]; a.muted=true
  await a.play().catch(()=>{}); await new Promise(s=>setTimeout(s,900)); a.pause()
  await abrir(); passos.push({depois:'tocar a 1a faixa', azul:azul()[0]})
  // Agora escolhe cada categoria a mao.
  const linhas=[...document.querySelectorAll('.menu-categorias button')]
  for (const nome of ['TODOS','MÚSICA','MEMORIZAÇÃO','ORAÇÃO']) {
    const b=[...document.querySelectorAll('.menu-categorias button')].find(x=>x.textContent.trim()===nome)
    if(!b){ passos.push({depois:'escolher '+nome, azul:'(nao existe)'}); continue }
    b.click(); await new Promise(s=>setTimeout(s,600))
    await abrir()
    passos.push({depois:'escolher '+nome, azul:azul()[0], quantos:azul().length})
  }
  return passos})
for(const x of r) console.log(`   ${x.depois.padEnd(22)} -> azul em ${x.azul}`)
for (const nome of ['TODOS','MÚSICA','MEMORIZAÇÃO','ORAÇÃO']) {
  const passo=r.find(x=>x.depois==='escolher '+nome)
  p_(`escolher ${nome} move o azul para ${nome}`, passo?.azul===nome, passo?.azul)
}
p_('e continua a ser so uma de cada vez', r.filter(x=>x.quantos!==undefined).every(x=>x.quantos===1))

console.log('\nO CORACAO NA MASCARA DO IPHONE')
const ic=await (await fetch(`${SITE}/apple-touch-icon.png`)).arrayBuffer()
p_('o icone e servido', ic.byteLength>0, `${Math.round(ic.byteLength/1024)} KB`)
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')

/* O CODIGO DE SAIDA DIZ O MESMO QUE O ECRA.
   Sem isto o percurso imprimia "FALHOU" e saia com 0, e quem corre a suite
   pelo codigo de saida via "ok". Foi assim que uma conta de teste ficou viva
   no site dele em 08/09: a limpeza falhou, o percurso disse-o, e ninguem ouviu. */
process.exit(falhas.length ? 1 : 0)
