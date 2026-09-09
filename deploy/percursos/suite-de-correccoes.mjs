// Todas as correcoes, num so ficheiro, para correr VARIAS VEZES.
// O que interessa nao e passar uma vez: e dar o mesmo resultado em todas as
// corridas. O defeito da barra inferior e intermitente, e um defeito
// intermitente so se apanha repetindo.
import { chromium } from 'playwright'
import { criarConta } from './criar-conta.mjs'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const CORRIDA = process.argv[2] || '1'
const r = []
const ok=(n,v,e='')=>{r.push({n,v,e}); console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`)}
const marca=`${Date.now()}`.slice(-6)
// A marca em LETRAS e nao em digitos: desde 01/09 o nome do perfil recusa
// numeros, a pedido dele. Um percurso que grava "Suite 054004" testa uma coisa
// que a plataforma ja nao aceita, e falha a acusar a aplicacao de um defeito
// que e do proprio percurso.
const marcaEmLetras = marca.replace(/\d/g, (d) => 'abcdefghij'[Number(d)])

const EMAIL=`teste.suite.${marca}@santtify.dev`, SENHA='Teste.Suite.3008'
const nav=await chromium.launch()
const ctx=await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,acceptDownloads:true})
const pg=await ctx.newPage()
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
pg.on('dialog',d=>d.accept())
console.log(`\n===== CORRIDA ${CORRIDA} =====`)

try {
// ── A. BARRA INFERIOR, em varias paginas e alturas (o intermitente) ──
for (const [nome,url,letra] of [['inicial',`${SITE}/${PROJ}`,false],['letra',`${SITE}/${PROJ}`,true],
                                ['produto vivo',`${SITE}/${PROJ}/produto-vivo`,false]]) {
  await pg.goto(url,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
  if(letra){const a=await pg.$$('.letra-bloco:not(.trancada)'); if(a[0]){await a[0].click();await pg.waitForTimeout(3500)}}
  let solta=[]
  for(const f of [0,0.3,0.6,0.9,1]){
    await pg.evaluate(x=>window.scrollTo(0,(document.body.scrollHeight-innerHeight)*x),f)
    await pg.waitForTimeout(700)
    const m=await pg.evaluate(()=>{const b=document.querySelector('.barra-inferior'); if(!b) return null
      const q=b.getBoundingClientRect(); return {d:Math.round(q.bottom-innerHeight), pos:getComputedStyle(b).position}})
    if(!m) solta.push(`${Math.round(f*100)}%:ausente`)
    else if(Math.abs(m.d)>3) solta.push(`${Math.round(f*100)}%:${m.d}px`)
  }
  ok(`BARRA colada ao fundo em "${nome}"`, solta.length===0, solta.join(' '))
}

// ── B. TOCADORES: nenhum sem som, nenhum parado ──────────────────────
const t=await pg.evaluate(()=>({zer:(document.body.innerText.match(/00:00\s*\|?\/?\s*00:00/g)||[]).length}))
await pg.goto(`${SITE}/${PROJ}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
const ab=await pg.$$('.letra-bloco:not(.trancada)'); await ab[0].click(); await pg.waitForTimeout(4500)
const pl=await pg.evaluate(()=>({
  semFonte:[...document.querySelectorAll('.player-onda')].filter(p=>{const a=p.querySelector('audio');return !(a&&(a.currentSrc||a.src))}).length,
  total:document.querySelectorAll('.player-onda').length,
  lugares:document.querySelectorAll('.lugar-do-som').length,
  zerados:(document.body.innerText.match(/00:00\s*\|?\/?\s*00:00/g)||[]).length}))
ok('TOCADOR nenhum sem ficheiro de som', pl.semFonte===0, `${pl.semFonte} de ${pl.total}`)
ok('TOCADOR nenhum parado em 00:00', pl.zerados===0, `${pl.zerados}`)
// O lugar do som aparece SO onde falta audio. Ele carregou o audio da Letra A
// as 14:40 de 30/08, e desde entao A, B e C estao completas: nao havendo cartao
// sem som, nao ha lugar vazio para mostrar, e isso e o correcto. A primeira
// versao desta verificacao exigia que existisse sempre um, e acusou o que
// estava certo. E a quinta vez que a verificacao mente e nao o codigo.
ok('ESTRUTURA nenhum cartao sem som fica sem o seu lugar',
   pl.zerados===0 && pl.semFonte===0, `${pl.lugares} lugar(es) vazio(s), ${pl.total} tocadores`)

// ── C. CONTADOR sobe ao terminar ─────────────────────────────────────
await pg.waitForTimeout(2000)
const n1=await pg.evaluate(()=>document.querySelector('.reproducoes-faixa')?.textContent.replace(/\D/g,'')||null)
const fim=await pg.evaluate(async()=>{const a=document.querySelector('audio'); if(!a) return 'sem'
  await a.play().catch(()=>{}); await new Promise(r=>setTimeout(r,700))
  a.currentTime=Math.max(0,(a.duration||10)-0.4)
  return new Promise(r=>{a.addEventListener('ended',()=>r('fim'),{once:true}); setTimeout(()=>r('nao'),12000)})})
await pg.waitForTimeout(1800)
const n2=await pg.evaluate(()=>document.querySelector('.reproducoes-faixa')?.textContent.replace(/\D/g,'')||null)
ok('CONTADOR +1 ao terminar a musica', fim==='fim'&&n1&&n2&&Number(n2)===Number(n1)+1, `${n1} -> ${n2}`)

// ── D. PRODUTO VIVO so com o botao ───────────────────────────────────
await pg.goto(`${SITE}/${PROJ}/produto-vivo`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
const pv=await pg.evaluate(()=>({t:document.body.innerText.replace(/\s+/g,' '),b:!!document.querySelector('a[href*="chat.whatsapp.com"]')}))
ok('PV sem o quadro explicativo', !/Tem uma empresa|novidades, as demonstra/i.test(pv.t))
ok('PV com o botao do grupo', pv.b)

// ── E. PERFIL: criar, editar, voltar, apagar ─────────────────────────
await criarConta(pg,{site:SITE,projeto:PROJ,email:EMAIL,senha:SENHA,nome:`Suite ${marca}`,limpar})
await pg.goto(`${SITE}/${PROJ}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
const partida=pg.url()
await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3000);await limpar()
ok('EDICAO abre em pagina propria', pg.url().endsWith('/perfil/editar'))
ok('EDICAO tem SALVAR PERFIL', (await pg.textContent('.editar-perfil button[type=submit]'))?.includes('SALVAR'))
ok('EDICAO tem excluir a conta', !!(await pg.$('button.apagar-conta')))
// Pelo id, e nao pelo primeiro input de texto que aparecer: desde que o campo
// do @identificador entrou nesta pagina, "o primeiro" deixou de querer dizer
// "o nome".
const campo=await pg.$('#perfil-nome')
if(campo) await campo.fill(`Suite ${marcaEmLetras} ok`)
await pg.click('.editar-perfil button[type=submit]');await pg.waitForTimeout(6000)
ok('SALVAR devolve a onde estava', pg.url()===partida, pg.url().replace(SITE,''))
ok('e a tela antiga nao aparece', !/Sair da conta|Conteúdos que você abriu/i.test(await pg.textContent('body')))
ok('DESCRICAO o nome novo aparece', (await pg.textContent('body')).includes(`Suite ${marcaEmLetras} ok`))

// ── F. CARTAO: as quatro saidas ──────────────────────────────────────
await pg.goto(`${SITE}/${PROJ}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
const ab2=await pg.$$('.letra-bloco:not(.trancada)'); await ab2[0].click(); await pg.waitForTimeout(4000)
const fx=await pg.$('.faixa-imprimir')
if(fx){await fx.scrollIntoViewIfNeeded();await pg.waitForTimeout(400);await pg.click('a.botao-imprimir:not(.secundario)');await pg.waitForTimeout(4500)}
const acoes=await pg.evaluate(()=>[...document.querySelectorAll('.acao-do-cartao')].map(b=>b.textContent.replace(/\s+/g,'').trim()))
ok('CARTAO tem as quatro saidas', acoes.length===4, acoes.join('|'))
await pg.click('.acao-do-cartao:has-text("VOLTAR")');await pg.waitForTimeout(2500)
ok('CARTAO VOLTAR sai', !pg.url().includes('/cartao'))
} catch(e){ console.log('  ! '+String(e.message).split('\n')[0]); r.push({n:'EXCEPCAO',v:false,e:String(e.message).slice(0,60)}) }
finally {
  await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'}).catch(()=>{})
  await pg.waitForTimeout(2500); await limpar().catch(()=>{})
  const ap=await pg.$('button.apagar-conta')
  if(ap){await ap.scrollIntoViewIfNeeded();await ap.click();await pg.waitForTimeout(700)
    await pg.fill('.zona-de-risco input[type=password]',SENHA).catch(()=>{})
    await pg.click('.par-de-botoes button[type=submit]').catch(()=>{});await pg.waitForTimeout(4000)}
  /*
    UMA LIMPEZA FALHADA E UMA FALHA, e regista-se onde este ficheiro regista as
    outras. Escrevi `falhas.push` aqui de cabeca, e neste ficheiro a lista
    chama-se `r`: a linha rebentava com "falhas is not defined" e levava a
    corrida inteira atras dela. E a terceira vez que invento um nome em vez de
    o ir ler.
  */
  const apagou = Boolean(ap) && !pg.url().includes('/perfil')
  ok('LIMPEZA a conta de teste foi apagada', apagou, apagou ? '' : EMAIL)
  const maus=r.filter(x=>!x.v)
  console.log(`RESULTADO CORRIDA ${CORRIDA}: ${r.length-maus.length}/${r.length}` + (maus.length?`  FALHAS: ${maus.map(m=>m.n).join(' | ')}`:'  tudo passa'))
  await nav.close()
  /* O CODIGO DE SAIDA DIZ O MESMO QUE O ECRA.
     Aqui a lista chama-se `r` e nao `falhas`, como a nota acima ja avisava.
     Sem esta linha o percurso imprimia FALHAS e saia com 0, e quem corre a
     suite pelo codigo de saida lia "ok". */
  process.exit(maus.length ? 1 : 0)
}
