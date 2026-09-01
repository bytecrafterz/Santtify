// A pagina que o QR Code abre, e os dois perfis.
//
// 01/09, num Android acabado de estrear: "escaneamos o QR Code e os audios
// abriram sem as fotos correspondentes". Procurei lentidao e cache durante uma
// hora. Naquela pagina as fotos nao existiam de todo: desenhava uma capa e por
// baixo os sete tocadores empilhados. E a pagina que TODOS os QR Codes
// impressos abrem, e um QR Code impresso nao se corrige depois.
//
// E os perfis: eu tinha fechado a plataforma no perfil dos outros e deixado
// aberta no dele. Duas coisas diferentes com a mesma coisa.
import { chromium } from 'playwright'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const CONTA=process.env.PV_ADMIN_EMAIL, SENHA=process.env.PV_ADMIN_SENHA
if(!CONTA||!SENHA){console.log('Faltam PV_ADMIN_EMAIL e PV_ADMIN_SENHA no ambiente.');process.exit(2)}
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
const pintado=(s)=>pg.evaluate((sel)=>{const e=document.querySelector(sel)
  return e?e.checkVisibility({checkVisibilityCSS:true,contentVisibilityAuto:true}):false},s)
try{
console.log('\nA PAGINA DO QR CODE')
await pg.goto(`${SITE}/${PROJ}/b`,{waitUntil:'networkidle',timeout:60000});await limpar()
const qr=await pg.evaluate(()=>({
  artes:document.querySelectorAll('img.foto-publicacao').length,
  tocadores:document.querySelectorAll('.player-onda').length,
  filasSociais:[...document.querySelectorAll('.indicadores-publicacao')].filter(e=>e.checkVisibility()).length,
  barraSocial:[...document.querySelectorAll('.barra-social')].filter(e=>e.checkVisibility()).length,
  comentarios:Boolean(document.querySelector('#comentarios')),
  semMedidas:[...document.querySelectorAll('img.foto-publicacao')].filter(i=>!i.getAttribute('width')).length}))
p_('cada audio tem a sua arte', qr.artes>=qr.tocadores-1, `${qr.artes} artes para ${qr.tocadores} tocadores`)
p_('todas as artes reservam o seu espaco', qr.semMedidas===0, `sem medidas: ${qr.semMedidas}`)
p_('nao ha uma segunda fila social da pagina', qr.barraSocial===0)
p_('os comentarios da letra continuam la', qr.comentarios)

console.log('\nOS DOIS PERFIS, CONSISTENTES')
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]',CONTA);await pg.fill('input[type=password]',SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)
await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);await limpar()
p_('no MEU perfil a plataforma esta fechada', !(await pintado('.grade-letras')))
p_('e a porta esta la', await pintado('.plataforma-no-perfil > summary'))
p_('"Escolha uma letra" nao aparece', !(await pintado('.progresso-letras')))
const id=await pg.evaluate(()=>{
  const a=document.querySelector('.escolher-identificador'), p=document.querySelector('.perfil-topo .identificador-perfil')
  return {convite:a?a.textContent.trim():null, arroba:p?p.textContent.trim():null}})
p_('quem nao tem identificador ve o convite no proprio perfil', Boolean(id.convite||id.arroba), id.convite??id.arroba)
await pg.screenshot({path:'meu-perfil-agora.png'})
await pg.goto(`${SITE}/${PROJ}/pessoa/b34ff502-a4d9-4cb7-b2a2-e5e9b302a005`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4000);await limpar()
p_('no perfil de OUTRA pessoa esta igual', !(await pintado('.grade-letras')) && await pintado('.plataforma-no-perfil > summary'))
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')
process.exit(falhas.length?1:0)
