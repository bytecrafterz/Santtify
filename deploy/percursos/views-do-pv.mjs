// As visualizacoes do Produto Vivo passam a contar. Nao mexe em nada dele: uma
// visita a uma pagina publica e o que qualquer pessoa faz.
import { chromium } from 'playwright'
const SITE = process.env.SITE ?? 'https://santtify.com', PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
const API = process.env.API ?? `${API}`
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const contar=async()=>{
  const r=await fetch(`${API}/projects/${PROJ}/contents/produto-vivo`)
  const d=await r.json(); const c=d.content||d
  return c.stats?.views ?? null }
const nav=await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
try{
const antes=await contar()
console.log(`   visualizacoes antes: ${antes}`)
// Tres visitas, cada uma de um visitante novo: contextos separados, sem cookie
// nem cache partilhados, que e o que faz o servidor ve-las como pessoas.
for (let i=0;i<3;i++){
  const ctx=await nav.newContext({viewport:{width:390,height:844}})
  const pg=await ctx.newPage()
  await pg.goto(`${SITE}/${PROJ}/produto-vivo`,{waitUntil:'domcontentloaded'})
  await pg.waitForTimeout(3500)
  await ctx.close()
}
await new Promise(r=>setTimeout(r,3000))
const depois=await contar()
console.log(`   visualizacoes depois de 3 visitas: ${depois}`)
p_('as visualizacoes deixaram de estar presas em zero', depois!==null && depois>antes, `${antes} -> ${depois}`)
p_('e subiram uma por visita', depois-antes===3, `subiu ${depois-antes}`)
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')

/* O CODIGO DE SAIDA DIZ O MESMO QUE O ECRA.
   Sem isto o percurso imprimia as falhas e saia com 0, e quem corre a suite
   pelo codigo de saida lia "ok". Foi assim que uma conta de teste ficou viva
   no site dele em 08/09: a limpeza falhou, o percurso disse-o, e ninguem ouviu. */
process.exit(falhas.length ? 1 : 0)
