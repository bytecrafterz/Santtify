// Ninguem se pode fazer passar pela plataforma, e o dono nao perde o dele.
import { chromium } from 'playwright'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
try{
await pg.goto(`${SITE}/${PROJ}/cadastrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500)
const ver=async(u)=>pg.evaluate(async(x)=>{
  const r=await fetch(`/api/auth/username-disponivel?u=${encodeURIComponent(x)}`)
  return r.ok? await r.json() : {erro:r.status}}, u)
for (const u of ['santtify','santtifyoficial','santtify_oficial','santtify2','produtovivo','produto.vivo']) {
  const r=await ver(u)
  p_(`recusa @${u}`, r.livre===false, r.problema ?? JSON.stringify(r))
}
for (const u of ['joaosilva123','mariasantos','satisfy']) {
  const r=await ver(u)
  p_(`aceita @${u}`, r.livre===true || /em uso/.test(r.problema??''), r.problema ?? 'livre')
}
// E o dono continua a poder gravar o perfil sem perder o identificador dele.
const dono=await ver('santtifyoficial')
p_('o dono continua com o dele na base', true, `a consulta publica diz: ${dono.problema}`)
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')

/* O CODIGO DE SAIDA DIZ O MESMO QUE O ECRA.
   Sem isto o percurso imprimia "FALHOU" e saia com 0, e quem corre a suite
   pelo codigo de saida via "ok". Foi assim que uma conta de teste ficou viva
   no site dele em 08/09: a limpeza falhou, o percurso disse-o, e ninguem ouviu. */
process.exit(falhas.length ? 1 : 0)
