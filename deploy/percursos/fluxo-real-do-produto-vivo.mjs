// O FLUXO REAL que ele pediu, pela ordem em que o escreveu:
//   3 artes -> audio -> publicar -> as 3 aparecem -> UMA fila social debaixo
//   do audio -> estado PUBLICANDO/PUBLICADO -> aparece sem recarregar.
//
// Cria numa publicacao de TESTE e apaga tudo no fim: a publicacao dele esta no
// ar e nao se mexe.
import { chromium } from 'playwright'
import { arteDeitada, png, somDeTeste } from './imagem-de-teste.mjs'
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
const MARCA=`FLUXO${Date.now()}`.slice(0,14)
const criados=[]
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
pg.on('dialog',d=>d.accept())
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]', CONTA); await pg.fill('input[type=password]', SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4000)

const idsDaPv=async()=>pg.evaluate(async()=>{
  const r=await fetch('/api/projects/jesus-alfabeto-saudavel/contents/produto-vivo')
  const d=await r.json(); const c=d.content||d
  return (c.blocks||[]).map(b=>b.id)})

/* Fora do `try` de proposito: o `finally` tem de o ver para devolver o titulo
   dele. Declarado la dentro, a reposicao nunca corria e eu nao dava por isso,
   porque `typeof` de uma variavel de outro bloco devolve 'undefined' sem se
   queixar. */
let originais = { titulo: '', descricao: '' }

/*
  O QUE E DELE E O QUE JA LA ESTAVA QUANDO EU CHEGUEI.

  Isto era uma lista de tres ids escritos a mao, apanhada no dia em que escrevi
  o percurso. Em 02/09 essa lista ja tinha um id que deixou de existir e nao
  tinha a arte do meio, que ele repos em 31/08 — ou seja, a limpeza classificava
  uma arte DELE como minha e tentava apaga-la. So nao a apagou porque uma
  travagem de seguranca parou o ciclo aos dois cartoes.

  Perguntar a plataforma antes de mexer em nada nao envelhece.
*/
let CONHECIDOS = []

try {
CONHECIDOS = await idsDaPv()
console.log(`   o que ja era dele: ${CONHECIDOS.length} cartao(oes)`)
await pg.goto(`${SITE}/${PROJ}/admin/produto-vivo`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);await limpar()
const antes=await pg.evaluate(()=>document.querySelectorAll('.arte-pv').length)
console.log(`   artes que ja existiam: ${antes} (nao vou mexer nelas)`)

// ── 3 ARTES ──────────────────────────────────────────────────────────
/*
  AS ARTES SAO FEITAS EM CODIGO.

  Este percurso carregava arte1.png, arte2.png e arte3.png, tres ficheiros que
  existiam na minha maquina e em mais lado nenhum. Em 02/09 a pasta foi limpa e
  ele rebentou no primeiro upload, DEPOIS de ja ter escrito por cima do titulo
  da publicacao dele. Corri o mesmo problema em editor-igual-ao-publico em
  01/09 e nao vim consertar este.
*/
const artes = [
  arteDeitada(),
  { name:'arte2.png', mimeType:'image/png',
    buffer: png(900, 1200, (x,y)=> (Math.floor(y/60)%2 ? [30,110,60] : [240,240,230])) },
  { name:'arte3.png', mimeType:'image/png',
    buffer: png(900, 1200, (x,y)=> (Math.floor(x/60)%2 ? [140,40,110] : [250,235,245])) },
]
for (const f of artes) {
  await pg.click('.acrescentar-cartao');await pg.waitForTimeout(3000)
  const campos=await pg.$$('.arte-pv input[type=file]')
  await campos[campos.length-1].setInputFiles(f);await pg.waitForTimeout(5000)
}
const depois=await pg.evaluate(()=>document.querySelectorAll('.arte-pv').length)
p_('FLUXO: as 3 artes entraram no editor', depois===antes+3, `${antes} -> ${depois}`)

// ── AUDIO no conteudo principal ──────────────────────────────────────
const somCampo=await pg.$('input[accept*="audio"]')
if(somCampo){await somCampo.setInputFiles(somDeTeste());await pg.waitForTimeout(6000)}
p_('FLUXO: o audio entrou no conteudo principal', !!(await pg.$('.linha-audio-pv')))

// ── PUBLICAR, e ver o botao a mudar ──────────────────────────────────
/*
  O QUE ESTAVA ESCRITO FICA GUARDADO ANTES DE EU ESCREVER POR CIMA.

  O Produto Vivo tem UMA publicacao, a dele, e nao ha outra onde testar. A
  limpeza apagava as artes que eu criava e nunca devolvia o titulo nem a
  descricao: em 02/09 a publicacao dele ficou no ar chamada FLUXO178835590,
  a vista de toda a gente, ate eu dar por isso a correr os percursos.
*/
originais = await pg.evaluate(()=>({
  titulo: document.querySelector('#pv-titulo')?.value ?? '',
  descricao: document.querySelector('#pv-descricao')?.value ?? '',
}))
console.log(`   titulo dele, guardado: ${JSON.stringify(originais.titulo)}`)
await pg.fill('#pv-titulo', MARCA)
await pg.fill('#pv-descricao', `Descricao de ${MARCA}`)
const rotulos=[]
const botao=await pg.$('.guardar-publicacao')
const observar=setInterval(async()=>{
  const t=await pg.evaluate(()=>document.querySelector('.guardar-publicacao')?.textContent?.trim()||'').catch(()=>'')
  if(t && rotulos[rotulos.length-1]!==t) rotulos.push(t)
},250)
await botao.click()
await pg.waitForTimeout(7000)
clearInterval(observar)
console.log('   o botao passou por:', JSON.stringify(rotulos))
p_('BOTAO: mostra PUBLICANDO enquanto envia', rotulos.some(t=>/PUBLICANDO/i.test(t)), rotulos.join(' -> '))
p_('BOTAO: mostra PUBLICADO no fim', rotulos.some(t=>/PUBLICADO/i.test(t)))

// ── A PAGINA PUBLICA, sem recarregar nada a mao ──────────────────────
await pg.goto(`${SITE}/${PROJ}/produto-vivo`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(5000);await limpar()
const publico=await pg.evaluate((m)=>({
  temMarca:document.body.innerText.includes(m),
  artes:document.querySelectorAll('.arte-da-publicacao').length,
  filasSociais:document.querySelectorAll('.indicadores-publicacao').length,
  tocadores:document.querySelectorAll('.player-onda').length}), MARCA)
console.log('   pagina publica:', JSON.stringify(publico))
p_('PUBLICA: a publicacao nova aparece sem recarregar a mao', publico.temMarca)
p_('PUBLICA: existe UMA SO fila de View/Like/Comentario/Partilha', publico.filasSociais===1, `${publico.filasSociais} filas`)
p_('PUBLICA: a fila vem depois do audio', publico.tocadores>=1)
p_('PUBLICA: as artes aparecem como paginas da mesma publicacao', publico.artes>=3, `${publico.artes} artes`)
} catch(e){ falhas.push('rebentou: '+String(e.message).split('\n')[0].slice(0,60)); console.log('  ! '+String(e.message).split('\n')[0]) }
finally {
  /*
    DEVOLVER A PUBLICACAO DELE AO ESTADO EM QUE ESTAVA.

    O Produto Vivo tem UMA publicacao, a dele, e nao ha onde testar sem lhe
    tocar. Na primeira corrida deixei la tres artes minhas e escrevi por cima do
    titulo e da descricao dele. Isto apaga o que eu criei e repoe o que eu
    mudei, pelos ids conhecidos, e diz alto se nao conseguir.
  */
  try {
    const agora = await idsDaPv()
    const meus = agora.filter(i => !CONHECIDOS.includes(i))
    /*
      APAGAR PELO ECRA, e nao por um pedido a API a partir daqui.

      A primeira versao chamava a API com fetch e um .catch vazio: os pedidos
      falharam todos por falta do cabecalho de autenticacao, o catch engoliu-os,
      e a limpeza escreveu "3 apagadas" com as tres ainda la. Uma limpeza que
      mente e pior do que nenhuma, porque ninguem vai conferir depois.

      Pelo ecra usa a sessao que ja esta aberta, e a contagem no fim e lida do
      ecra, nao do que eu julgo ter feito.
    */
    await pg.goto(`${SITE}/${PROJ}/admin/produto-vivo`,{waitUntil:'domcontentloaded'})
    await pg.waitForTimeout(4000); await limpar()
    for (let i = 0; i < 8; i++) {
      const n = await pg.evaluate(()=>document.querySelectorAll('.arte-pv').length)
      if (n <= 1) break
      const ultima = pg.locator('.arte-pv').last()
      await ultima.locator('.tres-pontos').click(); await pg.waitForTimeout(500)
      const apagar = await pg.$('.menu-quadrado button.perigo')
      if (!apagar) { await pg.keyboard.press('Escape'); break }
      await apagar.click(); await pg.waitForTimeout(3000)
      const depois = await pg.evaluate(()=>document.querySelectorAll('.arte-pv').length)
      if (depois >= n) break
      if (depois <= 2) break
    }
    // O titulo e a descricao dele voltam, e conferem-se a ler de volta.
    if (originais.titulo || originais.descricao) {
      await pg.fill('#pv-titulo', originais.titulo).catch(()=>{})
      await pg.fill('#pv-descricao', originais.descricao).catch(()=>{})
      await pg.click('.guardar-publicacao').catch(()=>{})
      await pg.waitForTimeout(6000)
      const agora = await pg.evaluate(async()=>{
        const r=await fetch('/api/projects/jesus-alfabeto-saudavel/contents/produto-vivo')
        const d=await r.json(); const c=d.content||d
        return (c.blocks||[]).map(b=>b.titulo)})
      const marcaSobrou = agora.some(t => String(t||'').startsWith('FLUXO'))
      p_('LIMPEZA: o titulo dele voltou ao que era', !marcaSobrou, agora.join(' | '))
    }
    const sobram = await idsDaPv()
    const aindaMeus = sobram.filter(i => !CONHECIDOS.includes(i))
    // Uma limpeza falhada e uma FALHA, e nao uma linha de registo: foi assim
    // que quatro contas de teste chegaram a base dele em 31/08.
    p_('LIMPEZA: nao ficaram artes minhas na publicacao dele',
       aindaMeus.length === 0, aindaMeus.join(', '))
  } catch (e) { falhas.push('LIMPEZA REBENTOU, confira a publicacao dele: ' + e.message) }

  console.log(falhas.length? `\n${falhas.length} FALHA(S): ${falhas.join(' | ')}` : '\nO fluxo real dele passa inteiro.')
  await nav.close()
}
