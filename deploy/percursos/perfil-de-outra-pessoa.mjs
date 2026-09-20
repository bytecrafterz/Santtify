// Tocar no nome de outra pessoa abre O PERFIL DELA, e nao a plataforma.
//
// Ele descreveu-o em 31/08: "ao clicar no perfil de OUTRA pessoa ainda aparece
// aquela estrutura antiga no meio do caminho, com 'Sobre o Jesus Alfabeto
// Saudável', '4 de 26 letras liberadas', 'Escolha uma letra'".
//
// Eu respondi-lhe que as duas paginas eram iguais. Sao, em estrutura. Medido o
// ECRA, nao eram: no perfil dele havia 357px dele antes da plataforma comecar,
// no de outra pessoa 48px.
//
// MEDE O QUE ESTA PINTADO, com checkVisibility(). getBoundingClientRect()
// devolve caixa para elementos dentro de um <details> fechado, e foi assim que
// eu li 822px onde estava 2433 e quase corrigi uma correccao que ja estava boa.
import { chromium } from 'playwright'
const SITE = process.env.SITE ?? 'https://santtify.com', PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
const CONTA=process.env.PV_ADMIN_EMAIL, SENHA=process.env.PV_ADMIN_SENHA
if(!CONTA||!SENHA){console.log('Faltam PV_ADMIN_EMAIL e PV_ADMIN_SENHA no ambiente.');process.exit(2)}
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const nav=await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const pg=await (await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
/*
  ESPERAR PELA PÁGINA E NÃO PELO RELÓGIO.

  Isto era `waitForTimeout(4000)`. Sozinho passava sempre; dentro da suite, com
  o servidor a responder a mais coisas ao mesmo tempo, falhou em 09/09 a dizer
  que a porta da plataforma não estava lá. A porta estava: era o cabeçalho do
  perfil que ainda não tinha sido desenhado.

  Uma verificação intermitente faz o mesmo estrago que uma muda: ensina-me a
  descontar as falhas, e a próxima a sério passa no meio delas. Espera-se por
  uma âncora que NÃO é o que está a ser medido — o cabeçalho do perfil — e só
  depois se mede.
*/
const perfilPronto=async()=>{
  try{ await pg.waitForSelector('.perfil-capa',{state:'attached',timeout:25000}) }
  catch{ /* se nunca aparecer, a medição a seguir acusa, que é o que deve fazer */ }
  await pg.waitForTimeout(600)
}
const pintado=(s)=>pg.evaluate((sel)=>{const e=document.querySelector(sel)
  return e ? e.checkVisibility({checkVisibilityCSS:true, contentVisibilityAuto:true}) : false}, s)
try{
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]',CONTA);await pg.fill('input[type=password]',SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)

// Uma pessoa real e nao a conta de quem esta a ver.
const alguem = await pg.evaluate(async()=>{
  const r=await fetch('/api/projects/jesus-alfabeto-saudavel/people'); if(!r.ok) return null
  const d=await r.json(); const l=Array.isArray(d)?d:(d.pessoas??[])
  return l.find(p=>!/desenvolvedor/i.test(p.displayName||''))?.id ?? null
}) ?? 'b34ff502-a4d9-4cb7-b2a2-e5e9b302a005'

await pg.goto(`${SITE}/${PROJ}/pessoa/${alguem}`,{waitUntil:'domcontentloaded'});await perfilPronto();await limpar();await perfilPronto()

p_('quem e a pessoa esta na pagina, e nao so na gaveta', await pintado('.identidade-da-pessoa'))
p_('o @identificador aparece', await pg.evaluate(()=>/^@\w/.test(
     document.querySelector('.identidade-da-pessoa .identificador-perfil')?.textContent?.trim()??'')))
p_('"Escolha uma letra" NAO aparece ao abrir', !(await pintado('.grade-letras')))
p_('"letras liberadas" NAO aparece ao abrir', !(await pintado('.progresso-letras')))
p_('a porta para a plataforma esta la', await pintado('.plataforma-no-perfil > summary'))

// E abre mesmo: o pedido dele de 25/08 era que o perfil nao fosse um beco.
await pg.click('.plataforma-no-perfil > summary'); await pg.waitForTimeout(1200)
p_('e ao tocar nela a plataforma abre', await pintado('.grade-letras'))

// No perfil DELE proprio nada disto muda.
// A grelha das letras e desenhada no navegador e chega depois do primeiro
// pintar. Esperar 4s dava `null` e eu quase dei por partido um ecra que estava
// inteiro. Espera-se por ela, e nao por um relogio.
//
// ESTA PARTE MUDOU EM 01/09 E EU DEIXEI A VERIFICACAO PARA TRAS.
//
// Quando escrevi isto, a plataforma estava fechada no perfil dos outros e
// aberta no dele, e era isso que eu media aqui. Ele respondeu no dia seguinte:
// "no meu perfil ainda aparece aquela estrutura antiga e no dos outros o
// alfabeto desapareceu, deixe consistente". Fechei nos dois e nao voltei aqui.
//
// A verificacao passou a acusar uma correccao que estava certa. Uma
// verificacao desactualizada e pior do que nenhuma: ensina a ignorar as falhas,
// e a proxima que falhar a serio passa despercebida no meio delas.
await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'})
await perfilPronto();await limpar();await perfilPronto()
p_('no perfil do proprio a plataforma tambem esta fechada', !(await pintado('.grade-letras')))
p_('e a porta esta la, igual a dos outros', await pintado('.plataforma-no-perfil > summary'))
// Abre nos dois, que e o pedido de 25/08: um perfil nao pode ser um beco.
await pg.click('.plataforma-no-perfil > summary'); await pg.waitForTimeout(1200)
p_('e abre com um toque, tambem aqui', await pintado('.grade-letras'))
}catch(e){falhas.push(`excepcao: ${e.message}`);console.log(`  ✗ excepcao: ${e.message}`)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')
process.exit(falhas.length?1:0)
