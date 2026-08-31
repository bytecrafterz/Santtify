// Duplicar: o botao avisa, a copia e criada, e a pagina leva ate ela.
// Apaga a copia no fim, pelo id que a API devolveu.
import { chromium } from 'playwright'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
// A CONTA DE ADMINISTRADOR VEM DO AMBIENTE, e nunca escrita aqui.
// Uma senha de administrador do site que esta no ar, escrita num ficheiro do
// repositorio, e uma senha publicada: fica no historico para sempre e vai com o
// repositorio para todas as maos que o receberem.
//   PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node este-ficheiro.mjs
const CONTA = process.env.PV_ADMIN_EMAIL, SENHA = process.env.PV_ADMIN_SENHA
if (!CONTA || !SENHA) { console.log('Faltam PV_ADMIN_EMAIL e PV_ADMIN_SENHA no ambiente.'); process.exit(2) }
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
pg.on('dialog',d=>d.accept())
let novoId=null
pg.on('response', async r=>{ if(r.url().includes('/duplicate') && r.status()===201){
  try{ novoId=(await r.json()).id }catch{} } })
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]', CONTA); await pg.fill('input[type=password]', SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)
try {
await pg.goto(`${SITE}/${PROJ}/admin/alfabeto`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);await limpar()
const b=await pg.$('text="LETRA A"'); if(b){await b.click();await pg.waitForTimeout(3500)}
const antes=await pg.evaluate(()=>document.querySelectorAll('.quadrado').length)

await (await pg.$$('.quadrado .tres-pontos'))[0].click();await pg.waitForTimeout(600)
// apanhar o rotulo do botao enquanto trabalha
const rotulos=[]
const observar=setInterval(async()=>{
  const t=await pg.evaluate(()=>[...document.querySelectorAll('.menu-quadrado button')]
    .map(x=>x.textContent.trim()).find(x=>/duplic/i.test(x))||'').catch(()=>'')
  if(t && rotulos[rotulos.length-1]!==t) rotulos.push(t)
},200)
await pg.click('.menu-quadrado button:has-text("Duplicar")')
await pg.waitForTimeout(3200)
clearInterval(observar)
console.log('   o botao passou por:', JSON.stringify(rotulos))
p_('o botao avisa que esta a duplicar', rotulos.some(t=>/A duplicar/i.test(t)), rotulos.join(' -> '))

const depois=await pg.evaluate(()=>document.querySelectorAll('.quadrado').length)
p_('a copia e criada', depois===antes+1, `${antes} -> ${depois}`)
const aceso=await pg.evaluate(()=>{const e=document.querySelector('.quadrado.acabada-de-criar')
  if(!e) return null
  const r=e.getBoundingClientRect()
  return {visivel:r.top>=0&&r.bottom<=innerHeight+10, id:e.id}})
p_('a copia acende para se ver onde ficou', !!aceso, aceso? aceso.id:'nao acendeu')
p_('e esta a vista, sem procurar', aceso&&aceso.visivel)
} catch(e){ falhas.push('rebentou: '+String(e.message).split('\n')[0].slice(0,60)) }
finally {
  // APAGAR PELA INTERFACE. O fetch daqui vai sem o cabecalho da sessao, falha,
  // e o catch engole-o: foi assim que uma copia minha ficou na Letra A dele.
  if(novoId){
    try{
      const alvo=await pg.$(`#quadrado-${novoId} .tres-pontos`)
      if(alvo){
        await alvo.click(); await pg.waitForTimeout(600)
        const ex=await pg.$('.menu-quadrado button:has-text("Excluir")')
        if(ex){ await ex.click(); await pg.waitForTimeout(3500) }
      }
      const aindaLa=await pg.$(`#quadrado-${novoId}`)
      if(aindaLa) falhas.push(`A COPIA DE TESTE FICOU NA LETRA: ${novoId}`)
      else console.log('  (limpeza: a copia de teste foi apagada)')
    }catch(e){ falhas.push('limpeza falhou: '+String(e.message).slice(0,50)) }
  }
  console.log(falhas.length? `\n${falhas.length} FALHA(S): ${falhas.join(' | ')}` : '\nDuplicar avisa, cria e mostra onde ficou.')
  await nav.close()
}
