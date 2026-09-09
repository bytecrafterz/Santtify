import { chromium } from 'playwright'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const CONTA=process.env.PV_ADMIN_EMAIL, SENHA=process.env.PV_ADMIN_SENHA
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const og=async(u)=>{const h=await (await fetch(u)).text()
  const g=(p)=>(h.match(new RegExp(`<meta property="og:${p}" content="([^"]*)"`))||[])[1]??null
  return {titulo:g('title'), imagem:g('image')}}
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
try{
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]',CONTA);await pg.fill('input[type=password]',SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)

console.log('\n1. A PARTILHA DO PERFIL E DO CARTAO')
await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4000);await limpar()
const urlPerfil=await pg.evaluate(async()=>{
  window.__u=null; navigator.share=async(d)=>{window.__u=d.url}
  const b=[...document.querySelectorAll('button')].find(x=>/partilh|compartilh/i.test(x.getAttribute('aria-label')||''))
  b?.click(); await new Promise(r=>setTimeout(r,1500)); return window.__u})
console.log(`   perfil partilha: ${urlPerfil}`)
p_('o perfil partilha o endereco publico da pessoa', /\/pessoa\//.test(urlPerfil??''), urlPerfil)
if(urlPerfil){const m=await og(urlPerfil); console.log(`   cartao: "${m.titulo}"`)
  p_('e o cartao traz a pessoa', Boolean(m.titulo) && m.titulo!=='Jesus Alfabeto Saudável', m.titulo)}
const projeto=await og(`${SITE}/${PROJ}`)
const cartao=await og(`${SITE}/${PROJ}/b/cartao`)
p_('o cartao de impressao tem cartao proprio', cartao.imagem!==projeto.imagem && /Cartão da/.test(cartao.titulo??''), cartao.titulo)

console.log('\n2. A CATEGORIA QUE TOCA')
await pg.goto(`${SITE}/${PROJ}/b`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);await limpar()
const cat=await pg.evaluate(async()=>{
  const a=[...document.querySelectorAll('audio')]; a[0].muted=true
  await a[0].play().catch(()=>{}); await new Promise(r=>setTimeout(r,1200))
  const menu=[...document.querySelectorAll('.menu-player')][0]; menu?.click()
  await new Promise(r=>setTimeout(r,600))
  const linhas=[...document.querySelectorAll('.menu-categorias button')]
  const azul=linhas.filter(b=>b.classList.contains('a-tocar'))
  const cor=azul[0]?getComputedStyle(azul[0]).backgroundColor:null
  const larg=azul[0]?Math.round(azul[0].getBoundingClientRect().width):0
  const menuLarg=azul[0]?Math.round(azul[0].parentElement.getBoundingClientRect().width):0
  return {linhas:linhas.length, azuis:azul.length, rotulo:azul[0]?.textContent?.trim(), cor, larg, menuLarg}})
console.log(`   ${JSON.stringify(cat)}`)
p_('exactamente uma categoria fica marcada', cat.azuis===1, `${cat.azuis} de ${cat.linhas}`)
p_('e a faixa e azul', /rgb\(37, 99, 235\)/.test(cat.cor??''), cat.cor)
p_('de fora a fora do menu', cat.larg===cat.menuLarg, `${cat.larg}px de ${cat.menuLarg}px`)

console.log('\n4. O NOME E O ICONE DA INSTALACAO')
const man=await (await fetch(`${SITE}/manifest.json`)).json()
p_('o manifesto chama-se Santtify', man.name==='Santtify' && man.short_name==='Santtify', `${man.name} / ${man.short_name}`)
const html=await (await fetch(`${SITE}/${PROJ}/b`)).text()
p_('o iPhone recebe o nome Santtify', /apple-mobile-web-app-title" content="Santtify"/.test(html))
p_('e a marca que faz o Safari usa-lo', /apple-mobile-web-app-capable" content="yes"/.test(html))

console.log('\n6. A DENUNCIA')
await pg.goto(`${SITE}/${PROJ}/pessoa/b34ff502-a4d9-4cb7-b2a2-e5e9b302a005`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4000);await limpar()
const d=await pg.$('button:has-text("Bloquear"), .denunciar, [aria-label*="enunciar"]')
if(d){ await d.click(); await pg.waitForTimeout(1000)
  const r=await pg.evaluate(async()=>{
    const m=[...document.querySelectorAll('.motivos button')]; m[0]?.click()
    await new Promise(r=>setTimeout(r,500))
    const cx=document.querySelector('.acoes-denuncia')
    const b=[...cx.querySelectorAll('button')].find(x=>/Enviar/i.test(x.textContent))
    const rr=b.getBoundingClientRect()
    return {colado:getComputedStyle(cx).position==='sticky',
            noEcra: rr.top>=0 && rr.bottom<=innerHeight, activo:!b.disabled, texto:b.textContent.trim()}})
  console.log(`   ${JSON.stringify(r)}`)
  p_('o botao de enviar fica colado ao fundo da folha', r.colado)
  p_('esta a vista depois de escolher o motivo', r.noEcra)
  p_('e fica activo', r.activo, r.texto)
}
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')

/* O CODIGO DE SAIDA DIZ O MESMO QUE O ECRA.
   Sem isto o percurso imprimia "FALHOU" e saia com 0, e quem corre a suite
   pelo codigo de saida via "ok". Foi assim que uma conta de teste ficou viva
   no site dele em 08/09: a limpeza falhou, o percurso disse-o, e ninguem ouviu. */
process.exit(falhas.length ? 1 : 0)
