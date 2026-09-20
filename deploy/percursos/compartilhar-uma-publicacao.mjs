// O BOTAO, e nao um endereco que eu escrevi a mao. Intercepta o que a pagina
// entrega ao sistema de partilha e le o endereco que la vai dentro.
import { chromium } from 'playwright'
const SITE = process.env.SITE ?? 'https://santtify.com', PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
// A CONTA DE ADMINISTRADOR VEM DO AMBIENTE, e nunca escrita aqui.
// Uma senha de administrador do site que esta no ar, escrita num ficheiro do
// repositorio, e uma senha publicada: fica no historico para sempre e vai com o
// repositorio para todas as maos que o receberem.
//   PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node este-ficheiro.mjs
const CONTA = process.env.PV_ADMIN_EMAIL, SENHA = process.env.PV_ADMIN_SENHA
if (!CONTA || !SENHA) { console.log('Faltam PV_ADMIN_EMAIL e PV_ADMIN_SENHA no ambiente.'); process.exit(2) }
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const nav=await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
try{
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]', CONTA); await pg.fill('input[type=password]', SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)

await pg.goto(`${SITE}/${PROJ}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3000);await limpar()
// Instalar o espiao ANTES de tocar em nada.

// A Letra A e o primeiro botao da grade: a grade tem 26 casas pela ordem do
// alfabeto e as trancadas sao <div>, nao <button>.
await pg.click('.grade-letras button.letra-bloco >> nth=0')
await pg.waitForTimeout(4000)
/*
  SO AS PUBLICACOES DA LETRA ABERTA.

  Contava `.publicacao` na pagina toda, e a pagina inicial tambem desenha as
  publicacoes da INTRODUCAO. Dava dez em vez de oito, e a segunda que eu
  apanhava era de outra seccao — com um botao de partilhar que responde de
  outra maneira. O percurso acusava a aplicacao de nao fazer nada quando o que
  estava errado era a minha conta.
*/
const pubs = await pg.evaluate(()=>[...document.querySelectorAll('.letra-aberta .publicacao')].map(a=>a.id))
console.log(`   publicacoes na Letra A: ${pubs.length}`)
p_('a letra abriu com publicacoes', pubs.length>0)

// Carregar no compartilhar DA SEGUNDA publicacao, para o endereco ter de a
// distinguir das outras.
const alvo = pubs[1] ?? pubs[0]
// O espiao e o toque no MESMO evaluate: instalar num e ler noutro punha o
// percurso a depender de o contexto da pagina sobreviver entre os dois.
const r = await pg.evaluate(async (id)=>{
  window.__partilhado=null
  navigator.share = async (d)=>{ window.__partilhado=d }
  const art=document.getElementById(id)
  const b=art.querySelector('button[aria-label="Partilhar"]')
  if(!b) throw new Error('sem botao de partilhar nesta publicacao')
  b.click()
  await new Promise(r=>setTimeout(r,3000))
  return window.__partilhado
}, alvo)
console.log(`   endereco entregue ao compartilhar: ${r?.url}`)
const idAlvo = alvo.replace('cartao-','')
p_('o botao entrega mesmo um endereco', Boolean(r?.url))
p_('e esse endereco identifica ESTA publicacao', (r?.url||'').includes(`pub=${idAlvo}`), r?.url)
p_('e nao e a pagina geral', !/^https?:\/\/[^/]+\/[^?#]*$/.test(r?.url||'x'), r?.url)

// E abrindo-o, chega-se a ela.
await pg.goto(r.url,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
const chegou = await pg.evaluate((id)=>{ const el=document.getElementById(id); if(!el) return null
  const b=el.getBoundingClientRect(); return {acesa:el.classList.contains('publicacao-apontada'), topo:Math.round(b.top)} }, alvo)
p_('quem recebe o link cai nesta publicacao', chegou!==null && chegou.topo>-250 && chegou.topo<844, `topo ${chegou?.topo}`)
p_('e ela acende para se saber qual e', chegou?.acesa===true)
}catch(e){falhas.push(`excepcao: ${e.message}`);console.log(`  ✗ excepcao: ${e.message}`)}
await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')
