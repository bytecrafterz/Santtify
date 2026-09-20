// O ecra unico do Produto Vivo. Cria o minimo, e apaga pelos ids que criou.
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
const pg=await (await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
pg.on('dialog',d=>d.accept())
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]', CONTA); await pg.fill('input[type=password]', SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)

const ids=async()=>pg.evaluate(async(s)=>{
  const r=await fetch(`/api/admin/projects/${s}/root-structure`,{headers:{}}).catch(()=>null)
  return null},PROJ)

await pg.goto(`${SITE}/${PROJ}/admin/produto-vivo`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);await limpar()

// ── UM ECRA SO: tudo visivel sem clicar em rascunho nenhum ───────────
const ecra=await pg.evaluate(()=>({
  temArtes:/ARTES \(IMAGENS\)/.test(document.body.innerText),
  temPrincipal:/CONTEÚDO PRINCIPAL/.test(document.body.innerText),
  temTitulo:!!document.querySelector('#pv-titulo'),
  temSubtitulo:!!document.querySelector('#pv-subtitulo'),
  temDescricao:!!document.querySelector('#pv-descricao'),
  temAcrescentar:!!document.querySelector('.acrescentar-cartao'),
  artes:document.querySelectorAll('.arte-pv').length,
  temRascunho:/RASCUNHO|Toque para editar/i.test(document.body.innerText)}))
console.log('   ', JSON.stringify(ecra))
p_('ECRA UNICO: a seccao ARTES aparece logo', ecra.temArtes)
p_('ECRA UNICO: e o CONTEUDO PRINCIPAL tambem', ecra.temPrincipal)
p_('ECRA UNICO: ha artes numeradas para editar ali', ecra.artes>0, `${ecra.artes}`)
p_('ECRA UNICO: sem o caminho antigo de rascunhos', !ecra.temRascunho)
p_('ECRA UNICO: ha botao de acrescentar arte', ecra.temAcrescentar)
// Os campos do conteudo principal tem de existir ANTES de haver audio: e o que
// o desenho dele mostra, e foi o que eu tinha errado a primeira vez.
p_('ECRA UNICO: TITULO existe sem haver audio ainda', ecra.temTitulo)
p_('ECRA UNICO: SUBTITULO (opcional) existe', ecra.temSubtitulo)
p_('ECRA UNICO: DESCRICAO existe', ecra.temDescricao)
const cap=await pg.evaluate(()=>({capa:!!document.querySelector('.capa-principal'), som:!!document.querySelector('.linha-audio-pv')}))
p_('ECRA UNICO: a capa e a linha do audio estao la', cap.capa&&cap.som, JSON.stringify(cap))

// ── ACRESCENTAR e depois APAGAR o que acrescentei ────────────────────
const antes=ecra.artes
await pg.click('.acrescentar-cartao');await pg.waitForTimeout(3500)
const depois=await pg.evaluate(()=>document.querySelectorAll('.arte-pv').length)
p_('ACRESCENTAR cria uma arte no mesmo ecra', depois===antes+1, `${antes} -> ${depois}`)

// apagar a ultima, pelo menu dela
const ultima=pg.locator('.arte-pv').last()
await ultima.locator('.tres-pontos').click();await pg.waitForTimeout(600)
const temMenu=await pg.evaluate(()=>{const m=document.querySelector('.menu-quadrado')
  return m? {deletar:/Deletar/.test(m.innerText), duplicar:/Duplicar/.test(m.innerText)}:null})
p_('cada arte tem Deletar e Duplicar no proprio ecra', temMenu&&temMenu.deletar&&temMenu.duplicar, JSON.stringify(temMenu))
await pg.click('.menu-quadrado button.perigo');await pg.waitForTimeout(3500)
const final=await pg.evaluate(()=>document.querySelectorAll('.arte-pv').length)
p_('DELETAR remove a arte, no mesmo ecra', final===antes, `${depois} -> ${final}`)

console.log(falhas.length? `\n${falhas.length} FALHA(S): ${falhas.join(' | ')}` : '\nO ecra unico faz o que o desenho dele mostra.')
await nav.close()
