// Publicar no painel e a pagina publica mostrar logo, sem recarregar a mao.
//
// Mexe no titulo de UM cartao dele e devolve-o no fim, conferindo a leitura de
// volta. O Produto Vivo ja me ensinou o preco de nao devolver.
import { chromium } from 'playwright'
const SITE = process.env.SITE ?? 'https://santtify.com', PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel', LETRA='e'
const API = process.env.API ?? `${API}`
const CONTA=process.env.PV_ADMIN_EMAIL, SENHA=process.env.PV_ADMIN_SENHA
if(!CONTA||!SENHA){console.log('Faltam PV_ADMIN_EMAIL e PV_ADMIN_SENHA.');process.exit(2)}
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const MARCA=`VER${Date.now()}`.slice(0,12)
// A pagina publica, desenhada no servidor. Sem truques para furar a guarda:
// e exactamente o que o navegador dele recebe.
const publica=async()=>(await (await fetch(`${SITE}/${PROJ}/${LETRA}`)).text())
const nav=await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
let original=null, alvo=null
try{
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]',CONTA);await pg.fill('input[type=password]',SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)

// Escolher um cartao que ja aparece na pagina publica.
const cartao=await pg.evaluate(async()=>{
  const r=await fetch('/api/projects/jesus-alfabeto-saudavel/contents/e')
  const d=await r.json(); const c=d.content||d
  const b=(c.blocks||[]).find(x=>x.type==='AUDIO'&&x.titulo&&(x.asset||x.arte))
  return b? {id:b.id, titulo:b.titulo} : null})
if(!cartao) throw new Error('sem cartao onde mexer')
alvo=cartao.id; original=cartao.titulo
console.log(`   cartao: ${alvo.slice(0,8)}  titulo original: ${JSON.stringify(original)}`)

// Aquecer a guarda: garantir que a pagina publica esta mesmo guardada.
await publica()
const antes=await publica()
p_('o titulo antigo esta na pagina publica', antes.includes(original), original)

/*
  PELO PAINEL, COM O DEDO, e nao por um fetch meu.

  A primeira versao mandava um PATCH de dentro da pagina e levava 401: o token
  de acesso vive na memoria do JavaScript e nao num cookie, entao um fetch cru
  nao o leva. Alem disso um fetch meu nao passa pelo codigo do painel — e e
  exactamente esse codigo que agora manda esquecer as paginas. Testar por fora
  seria testar outra coisa.
*/
await pg.goto(`${SITE}/${PROJ}/admin/alfabeto`,{waitUntil:'domcontentloaded'})
await pg.waitForTimeout(4500); await limpar()
await pg.evaluate(()=>{
  const li=[...document.querySelectorAll('.vagao')].find(v=>v.querySelector('strong')?.textContent?.trim()==='LETRA E')
  li?.querySelector('.cabeca-vagao')?.click()})
await pg.waitForTimeout(3000)
const abriu=await pg.evaluate((id)=>{
  const q=document.querySelector(`#quadrado-${id} .corpo-quadrado`)
  if(!q) return false
  q.click(); return true}, alvo)
if(!abriu) throw new Error('nao encontrei o cartao no painel')
await pg.waitForTimeout(2500)
const campo=await pg.$('.editor-cartao input[placeholder="TÍTULO"], input[placeholder="TÍTULO"]')
if(!campo) throw new Error('sem campo de titulo')
await campo.fill(MARCA)
await pg.click('button:has-text("SALVAR")')
await pg.waitForTimeout(4000)
console.log('   guardado pelo painel')

const depois=await publica()
p_('o titulo novo aparece sem recarregar nem esperar', depois.includes(MARCA), MARCA)
/* Nao afirmo que o titulo antigo desapareceu da pagina: na Letra E ha outro
   cartao com o mesmo nome, e a afirmacao acusava sem haver defeito. */
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}

// Devolver, e conferir a ler de volta.
if(alvo && original!==null){
  try{
    /* Pelo painel, como a escrita: um fetch cru leva 401 porque o token vive na
       memoria do JavaScript. A primeira versao disto devolveu 401 em silencio e
       deixou o cartao dele chamado VER178849050. */
    /* ABRIR O CARTAO OUTRA VEZ ANTES DE DEVOLVER. Guardar fecha o editor e
       volta a lista, entao no fim ja nao ha campo nenhum — a minha primeira
       tentativa nao encontrou nada e deixou o cartao dele com a marca do
       teste. */
    await pg.goto(`${SITE}/${PROJ}/admin/alfabeto`,{waitUntil:'domcontentloaded'})
    await pg.waitForTimeout(4500); await limpar()
    await pg.evaluate(()=>{
      const li=[...document.querySelectorAll('.vagao')].find(v=>v.querySelector('strong')?.textContent?.trim()==='LETRA E')
      li?.querySelector('.cabeca-vagao')?.click()})
    await pg.waitForTimeout(3000)
    await pg.evaluate((id)=>{document.querySelector(`#quadrado-${id} .corpo-quadrado`)?.click()}, alvo)
    await pg.waitForTimeout(2500)
    const campoVolta=await pg.$('input[placeholder="TÍTULO"]')
    if(campoVolta){
      await campoVolta.fill(original)
      await pg.click('button:has-text("SALVAR")')
      await pg.waitForTimeout(4500)
    } else {
      falhas.push('LIMPEZA: nao encontrei o campo para devolver o titulo')
    }
    const agora=await (await fetch(`${API}/projects/${PROJ}/contents/${LETRA}`)).json()
    const b=((agora.content||agora).blocks||[]).find(x=>x.id===alvo)
    p_('o titulo dele voltou ao que era', b?.titulo===original, `${JSON.stringify(b?.titulo)} (esperado ${JSON.stringify(original)})`)
  }catch(e){falhas.push('LIMPEZA REBENTOU: '+e.message)}
}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')
