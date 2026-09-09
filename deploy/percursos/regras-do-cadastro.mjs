// O nome do perfil tem de ser um nome, e a regra le-se antes de a conta existir.
import { chromium } from 'playwright'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
try{
await pg.goto(`${SITE}/${PROJ}/cadastrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3000);await limpar()
const arte=await pg.evaluate(()=>{const i=document.querySelector('.arte-das-regras')
  return i? {ok:i.complete&&i.naturalWidth>0, src:i.getAttribute('src'), alt:(i.alt||'').slice(0,60)} : null})
p_('a arte das regras aparece no cadastro', Boolean(arte&&arte.ok), arte?.src)
p_('e o texto dela chega a quem nao ve imagens', /deletados automaticamente|nomes verdadeiros/.test(arte?.alt??''), arte?.alt)
await pg.screenshot({path:'cadastro-com-regras.png'})

// O SERVIDOR e quem manda: os nomes dele, um a um, por fora do formulario.
// Os nomes dele, e tambem nomes reais que TEM de passar: uma regra que recusa
// "24055" e tambem recusa "Ana" nao serve a ninguem.
const casos=['AF','123456','24055','AF123456','aaaa']
const validos=['Ana','Zé Maria','João Silva','Ângela',"O'Brien"]
for (const nome of casos){
  const r=await pg.evaluate(async(n)=>{
    const c=new FormData(); c.append('projectId','00000000-0000-0000-0000-000000000000')
    c.append('email',`t${Date.now()}@santtify.dev`); c.append('password','SenhaLongaSuficiente1')
    c.append('displayName',n); c.append('username',`t${Date.now()}`.slice(0,18))
    const res=await fetch('/api/auth/register',{method:'POST',body:c})
    const b=await res.json().catch(()=>({}))
    return {estado:res.status, msg:Array.isArray(b.message)?b.message[0]:b.message}
  }, nome)
  p_(`o servidor recusa "${nome}"`, r.estado>=400 && /nome/i.test(r.msg??''), `${r.estado} ${r.msg}`)
}
for (const nome of validos){
  const r=await pg.evaluate(async(n)=>{
    const c=new FormData(); c.append('projectId','00000000-0000-0000-0000-000000000000')
    c.append('email',`t${Date.now()}@santtify.dev`); c.append('password','SenhaLongaSuficiente1')
    c.append('displayName',n); c.append('username',`t${Date.now()}`.slice(0,18))
    const res=await fetch('/api/auth/register',{method:'POST',body:c})
    const b=await res.json().catch(()=>({}))
    return {estado:res.status, msg:Array.isArray(b.message)?b.message[0]:b.message}
  }, nome)
  // Sem fotografia nenhum cadastro passa; o que interessa e que a recusa seja
  // pela FOTOGRAFIA e nao pelo nome. Assim nao se cria conta nenhuma no teste.
  p_(`o nome "${nome}" passa na regra`, /fotografia/i.test(r.msg??''), r.msg)
}
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')

/* O CODIGO DE SAIDA DIZ O MESMO QUE O ECRA.
   Sem isto o percurso imprimia "FALHOU" e saia com 0, e quem corre a suite
   pelo codigo de saida via "ok". Foi assim que uma conta de teste ficou viva
   no site dele em 08/09: a limpeza falhou, o percurso disse-o, e ninguem ouviu. */
process.exit(falhas.length ? 1 : 0)
