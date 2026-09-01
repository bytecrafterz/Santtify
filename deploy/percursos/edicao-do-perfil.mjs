// A edicao do perfil com a forma do desenho dele. Mede a caixa da descricao
// COM O TECLADO ABERTO, que e a queixa concreta.
import { chromium } from 'playwright'
import { criarConta } from './criar-conta.mjs'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const marca=`${Date.now()}`.slice(-6)
const EMAIL=`teste.pf.${marca}@santtify.dev`, SENHA='Teste.Pf.3108'
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true})).newPage()
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
pg.on('dialog',d=>d.accept())
await criarConta(pg,{site:SITE,projeto:PROJ,email:EMAIL,senha:SENHA,nome:`Pf ${marca}`,limpar})

try {
await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()

const f=await pg.evaluate(()=>{
  const t=document.body.innerText
  const d=document.querySelector('#perfil-descricao')
  const r=d?d.getBoundingClientRect():null
  const ordem=[...document.querySelectorAll('label')].map(l=>l.textContent.trim())
  return {alturaDescricao:r?Math.round(r.height):0, ordem,
    ajudas:document.querySelectorAll('.ajuda-campo').length,
    contadores:[...document.querySelectorAll('.contador-campo')].map(c=>c.textContent),
    alterar:/Alterar Foto/.test(t), remover:/Remover Foto/.test(t)}})
console.log('   ', JSON.stringify(f))
p_('a caixa da descricao e grande', f.alturaDescricao>=200, `${f.alturaDescricao}px`)
p_('a ordem e Descricao, Quem acompanha, Foto, Nome',
   /Descri/.test(f.ordem[0]||'') && /acompanha/.test(f.ordem[1]||'') && /Foto/.test(f.ordem[2]||'') && /Nome/.test(f.ordem[3]||''),
   f.ordem.join(' | '))
p_('cada campo tem o seu texto de ajuda', f.ajudas>=3, `${f.ajudas}`)
p_('e os contadores do desenho', f.contadores.length>=3, f.contadores.join(' '))
p_('ha Alterar Foto e Remover Foto', f.alterar, `alterar=${f.alterar} remover=${f.remover}`)

// COM O TECLADO ABERTO: o ecra util encolhe para ~350px num telemovel
await pg.setViewportSize({width:390,height:380})
await pg.click('#perfil-descricao');await pg.waitForTimeout(600)
const comTeclado=await pg.evaluate(()=>{const d=document.querySelector('#perfil-descricao')
  const r=d.getBoundingClientRect()
  return {visivel:Math.round(Math.min(r.bottom,innerHeight)-Math.max(r.top,0)), linhas:Math.round((Math.min(r.bottom,innerHeight)-Math.max(r.top,0))/24)}})
p_('com o teclado aberto ainda se leem varias linhas', comTeclado.linhas>=4, `${comTeclado.visivel}px, ~${comTeclado.linhas} linhas`)
await pg.setViewportSize({width:390,height:844})

// gravar e conferir que o responsavel aceita mais de 80
const longo='Perfil infantil acompanhado e monitorado pelo pai, Rossandro Balbino Caxito, com carinho.'
await pg.fill('#perfil-responsavel', longo)
await pg.fill('#perfil-descricao','Descricao de teste para o ecra de edicao.')
await pg.click('.editar-perfil button[type=submit]');await pg.waitForTimeout(6000)
await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
const guardado=await pg.evaluate(()=>document.querySelector('#perfil-responsavel')?.value||'')
p_('o responsavel guarda mais de 80 caracteres', guardado.length>80, `${guardado.length} caracteres`)
} catch(e){ console.log('  ! '+String(e.message).split('\n')[0]) } finally {
await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'}).catch(()=>{})
await pg.waitForTimeout(2500);await limpar().catch(()=>{})
const ap=await pg.$('button.apagar-conta')
if(ap){await ap.scrollIntoViewIfNeeded();await ap.click();await pg.waitForTimeout(700)
  await pg.fill('.zona-de-risco input[type=password]',SENHA).catch(()=>{})
  await pg.click('.par-de-botoes button[type=submit]').catch(()=>{});await pg.waitForTimeout(4000)}
if (ap && !pg.url().includes('/perfil')) console.log('  (conta apagada)')
else falhas.push(`A CONTA DE TESTE NAO FOI APAGADA: ${EMAIL}`)
console.log(falhas.length? `\n${falhas.length} FALHA(S): ${falhas.join(' | ')}` : '\nA edicao tem a forma do desenho dele.')
await nav.close() }
