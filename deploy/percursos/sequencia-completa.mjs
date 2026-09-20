// A SEQUENCIA INTEIRA, e nao so o primeiro salto. Ele testou varias vezes e
// viu comportamentos diferentes: A->B uma vez, A->D outra, e a categoria a
// mudar sozinha. Um salto certo nao prova nada; o que prova e a cadeia.
import { chromium } from 'playwright'
const SITE = process.env.SITE ?? 'https://santtify.com', PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
const API = process.env.API ?? `${API}`
const CAT=(process.argv[2]||'EXPLICAÇÃO')
const SALTOS=Number(process.argv[3]||6)
const d=await (await fetch(`${API}/projects/${PROJ}/playlist`)).json()
const info=Object.fromEntries((d.faixas??[]).map(f=>[f.id,{letra:f.letra,cat:f.categoriaNome}]))
const daCat=(d.faixas??[]).filter(f=>f.letra && (f.categoriaNome||'').toUpperCase()===CAT)
console.log(`categoria ${CAT}: ${daCat.length} faixa(s) -> letras ${daCat.map(f=>f.letra).join(', ')}`)

const nav=await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',x=>x.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
await pg.goto(`${SITE}/${PROJ}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
await pg.click('.grade-letras button.letra-bloco >> nth=0');await pg.waitForTimeout(4500)

// Escolher a categoria no menu do tocador.
await pg.evaluate(async(cat)=>{
  const esperar=(ms)=>new Promise(s=>setTimeout(s,ms))
  document.querySelectorAll('.menu-player')[0].click(); await esperar(500)
  const b=[...document.querySelectorAll('.menu-categorias button')].find(x=>x.textContent.trim()===cat)
  b?.click(); await esperar(600)
}, CAT)

// Comecar pela primeira faixa dessa categoria que exista nesta pagina.
await pg.evaluate(()=>{ window.__ev=[]
  window.addEventListener('pv:tocar-faixa',(e)=>window.__ev.push(e.detail)) })
const arranque=await pg.evaluate(async(cat)=>{
  const esperar=(ms)=>new Promise(s=>setTimeout(s,ms))
  document.querySelectorAll('audio').forEach(a=>{a.muted=true})
  // Comecar por uma faixa DA LETRA aberta: o primeiro audio da pagina inicial
  // pertence a introducao, que nao faz parte do percurso das letras.
  const audios=[...document.querySelectorAll('.letra-aberta audio')]
  const a=audios[0]
  await a.play().catch(()=>{}); await esperar(700)
  return a.closest('[id^="cartao-"]')?.id?.replace('cartao-','')??null
}, CAT)
const nome=(id)=>{const i=info[id]; return i? `${i.cat||'SEM CATEGORIA'} da letra ${i.letra||'-'}` : '(desconhecida)'}
console.log(`\narranque: ${nome(arranque)}`)

const cadeia=[]
for (let n=0;n<SALTOS;n++){
  const passo=await pg.evaluate(async()=>{
    const esperar=(ms)=>new Promise(s=>setTimeout(s,ms))
    const id=(x)=>x.closest('[id^="cartao-"]')?.id?.replace('cartao-','')??null
    document.querySelectorAll('audio').forEach(a=>{a.muted=true})
    const atual=[...document.querySelectorAll('audio')].find(a=>!a.paused)
    if(!atual) return {fim:'nada a tocar'}
    const de=id(atual)
    /*
      ESPERAR PELA DURACAO ANTES DE SALTAR PARA O FIM.

      Numa faixa que a sequencia acabou de abrir, `duration` ainda e NaN: o
      elemento e novo e os metadados nao chegaram. `NaN - 0.2` e NaN, o
      currentTime nao se move, a faixa nunca acaba, e o percurso conclui que a
      sequencia parou. Era o percurso a mentir, nao a aplicacao.
    */
    for (let i=0;i<40 && !isFinite(atual.duration);i++) await esperar(250)
    if(!isFinite(atual.duration)) return {fim:'a faixa nao carregou a duracao'}
    atual.currentTime=Math.max(0,atual.duration-0.2)
    /*
      ESPERAR ATE ALGUMA COISA DIFERENTE ESTAR A TOCAR, em vez de dormir um
      numero fixo. Mudar de letra custa um pedido a rede mais o desenho da
      pagina; onze segundos chegavam para as transicoes dentro da letra e nao
      para a volta ao principio, e o percurso concluia que a sequencia parava
      quando ela estava so a demorar.
    */
    let agora=[]
    for (let i=0;i<40;i++){
      await esperar(400)
      agora=[...document.querySelectorAll('audio')].filter(a=>!a.paused)
      if (agora.length && id(agora[0])!==de) break
    }
    const ev=(window.__ev||[]).slice(-1)[0]??null
    return {de, para:agora.map(id), quantos:agora.length,
            ultimoEvento:ev,
            alvoExiste: ev? Boolean(document.querySelector(`#cartao-${ev.blockId}`)) : null,
            alvoAudio: ev? Boolean(document.querySelector(`#cartao-${ev.blockId} audio`)) : null,
            cartoes: document.querySelectorAll('.letra-aberta [id^=\"cartao-\"]').length}
  })
  if(passo.fim){ cadeia.push('  (parou)'); break }
  const pedido = passo.ultimoEvento
    ? `  [pediu ${passo.ultimoEvento.slug}; alvo na pagina=${passo.alvoExiste}/${passo.alvoAudio}; ${passo.cartoes} cartoes]` : ''
  cadeia.push(`  ${nome(passo.de)}  ->  ${passo.para.map(nome).join(' + ')||'(nada)'}${pedido}${passo.quantos>1?'  !! '+passo.quantos+' ao mesmo tempo':''}`)
  if(!passo.para.length) break
}
console.log('\ncadeia:'); cadeia.forEach(l=>console.log(l))
await nav.close()
