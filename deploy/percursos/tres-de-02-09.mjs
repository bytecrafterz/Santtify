// Os tres pontos de 02/09: o cartao de partilha de cada area, tocar em
// sequencia, e a barra que fica por mais que se desca.
import { chromium } from 'playwright'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const og=async(url)=>{const h=await (await fetch(url)).text()
  const g=(p)=>(h.match(new RegExp(`<meta property="og:${p}" content="([^"]*)"`))||[])[1]??null
  return {titulo:g('title'), imagem:g('image'), tipo:g('type')}}
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
try{
console.log('\nO CARTAO DE CADA AREA')
const projeto=await og(`${SITE}/${PROJ}`)
const pv=await og(`${SITE}/${PROJ}/produto-vivo`)
const cartao=await og(`${SITE}/${PROJ}/b/cartao`)
const perfil=await og(`${SITE}/${PROJ}/pessoa/29e7f668-70be-4b4e-b204-6225fdce72d5`)
console.log(`   projeto:      "${projeto.titulo}"`)
console.log(`   produto vivo: "${pv.titulo}"  ${pv.imagem?.split('/').pop()}`)
console.log(`   cartao:       "${cartao.titulo}"  ${cartao.imagem?.split('/').pop()}`)
console.log(`   perfil:       "${perfil.titulo}"  ${perfil.imagem?.split('/').pop()}`)
p_('o Produto Vivo tem cartao proprio', pv.titulo==='Produto Vivo' && pv.imagem!==projeto.imagem)
p_('o cartao de impressao tem cartao proprio', /Cartão da/.test(cartao.titulo??'') && cartao.imagem!==projeto.imagem)
p_('o perfil leva a pessoa e nao a capa do projeto', perfil.imagem!==projeto.imagem && /HELEN|@/.test(perfil.titulo??''), perfil.titulo)
p_('as quatro imagens sao todas diferentes',
   new Set([projeto.imagem,pv.imagem,cartao.imagem,perfil.imagem]).size===4)

console.log('\nA BARRA FICA, POR MAIS QUE SE DESCA')
await pg.goto(`${SITE}/${PROJ}/b`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4000);await limpar()
const barra=async()=>pg.evaluate(()=>{const b=document.querySelector('.barra-inferior')
  if(!b) return null
  const r=b.getBoundingClientRect()
  return {desvio:Math.round(r.bottom-innerHeight), itens:[...b.querySelectorAll('.item-barra')].map(i=>i.textContent.trim())}})
const antes=await barra()
p_('a pagina da letra tem barra', antes!==null)
p_('e tem Meu Perfil', (antes?.itens??[]).some(t=>/Meu Perfil/i.test(t)), (antes?.itens??[]).join(' | '))
await pg.evaluate(()=>scrollTo(0,document.body.scrollHeight))
await pg.waitForTimeout(1500)
const depois=await barra()
p_('continua colada ao fundo depois de descer tudo', Math.abs(depois?.desvio??99)<=2, `desvio ${depois?.desvio}px`)
await pg.screenshot({path:'letra-fundo-com-barra.png'})

console.log('\nTOCAR EM SEQUENCIA')
await pg.evaluate(()=>scrollTo(0,0)); await pg.waitForTimeout(800)
const seq=await pg.evaluate(async()=>{
  const audios=[...document.querySelectorAll('audio')]
  if(audios.length<2) return {erro:`so ${audios.length} audios`}
  const a=audios[0], b=audios[1]
  a.muted=true; b.muted=true
  await a.play().catch(()=>{})
  // Salta para o fim em vez de esperar cinco minutos.
  a.currentTime = Math.max(0,(a.duration||10)-0.2)
  await new Promise(r=>setTimeout(r,4000))
  return {primeiroAcabou:a.ended, segundoATocar:!b.paused, segundoTempo:Math.round(b.currentTime*10)/10}
})
console.log(`   ${JSON.stringify(seq)}`)
p_('a faixa seguinte comeca sozinha', seq.primeiroAcabou===true && seq.segundoATocar===true, JSON.stringify(seq))
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')
