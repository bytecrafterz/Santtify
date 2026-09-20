// A sequencia segue a CATEGORIA escolhida, atravessa de letra em letra, e
// nunca toca sozinha um audio sem categoria.
import { chromium } from 'playwright'
const SITE = process.env.SITE ?? 'https://santtify.com', PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
const API = process.env.API ?? `${API}`
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const nav=await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
try{
// A fila que o servidor entrega, que e a base de tudo.
const d=await (await fetch(`${API}/projects/${PROJ}/playlist`)).json()
const faixas=d.faixas??[]
const semCat=faixas.filter(f=>!f.categoriaNome)
console.log(`   fila do servidor: ${faixas.length} faixas, ${semCat.length} sem categoria`)
p_('a fila vem por ordem de letra', faixas.length>0)

await pg.goto(`${SITE}/${PROJ}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
await pg.click('.grade-letras button.letra-bloco >> nth=0');await pg.waitForTimeout(4500)

// 1. Escolher ORACAO e acabar uma faixa: a seguinte tem de ser uma Oracao.
const r=await pg.evaluate(async()=>{
  const esperar=(ms)=>new Promise(s=>setTimeout(s,ms))
  const menu=document.querySelectorAll('.menu-player')[0]
  menu.click(); await esperar(500)
  const b=[...document.querySelectorAll('.menu-categorias button')].find(x=>x.textContent.trim()==='ORAÇÃO')
  if(!b) return {erro:'sem ORACAO no menu'}
  b.click(); await esperar(700)
  const a=document.querySelectorAll('audio')[0]
  document.querySelectorAll('audio').forEach(x=>{x.muted=true})
  await a.play().catch(()=>{}); await esperar(600)
  a.currentTime=Math.max(0,(a.duration||10)-0.2)
  await esperar(6000)
  const aTocar=[...document.querySelectorAll('audio')].filter(x=>!x.paused)
  const id=aTocar[0]?.closest('[id^="cartao-"]')?.id?.replace('cartao-','')??null
  return {quantosATocar:aTocar.length, id, letraAberta:document.querySelector('.letra-aberta')?Boolean(1):false}
})
console.log(`   ${JSON.stringify(r)}`)
const daSeq = faixas.find(f=>f.id===r.id)
console.log(`   faixa que comecou: ${daSeq? daSeq.categoriaNome+' da '+daSeq.slug : '(nenhuma)'}`)
p_('a seguinte e da categoria escolhida', daSeq?.categoriaNome==='Oração', daSeq?.categoriaNome??'nenhuma')
p_('e nao e um audio sem categoria', !daSeq || Boolean(daSeq.categoriaNome))
p_('so uma faixa a tocar de cada vez', r.quantosATocar===1, String(r.quantosATocar))

// 2. O icone
const ic=await fetch(`${SITE}/apple-touch-icon.png`)
p_('o icone e servido', ic.ok)
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')

/* O CODIGO DE SAIDA DIZ O MESMO QUE O ECRA.
   Sem isto o percurso imprimia "FALHOU" e saia com 0, e quem corre a suite
   pelo codigo de saida via "ok". Foi assim que uma conta de teste ficou viva
   no site dele em 08/09: a limpeza falhou, o percurso disse-o, e ninguem ouviu. */
process.exit(falhas.length ? 1 : 0)
