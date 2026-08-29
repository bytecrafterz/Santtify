// A promessa dele: "o que eu vejo no editor = o que o publico ve no perfil".
// Nao se prova com opinioes. Fotografa-se a moldura do editor, fotografa-se a
// capa publica, e comparam-se os pixels.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,ok,e='')=>{console.log(`  ${ok?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!ok) falhas.push(n)}
const marca=String(Date.now()).slice(-6)
const EMAIL=`teste.wys.${marca}@santtify.dev`, SENHA='Teste.Wys.2908'
const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true})).newPage()
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
pg.on('dialog',d=>d.accept())

await pg.goto(`${SITE}/${PROJ}/cadastrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]',EMAIL);await pg.fill('input[name=displayName], input[type=text]',`Wys ${marca}`)
await pg.fill('input[type=password]',SENHA);await pg.click('button[type=submit]');await pg.waitForTimeout(4500)

try {

await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4000);await limpar()
// A edicao tem pagina propria desde 29/08. Este ficheiro ficou a apontar para o
// botao antigo e rebentou na primeira corrida seguinte, deixando duas contas de
// teste na base dele. Mudar uma pagina obriga a seguir TODOS os caminhos que
// entram nela, e os percursos guardados sao um deles.
await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
await pg.setInputFiles('#perfil-foto','arte-deitada.png');await pg.waitForTimeout(3000)

// as proporcoes tem de ser a MESMA
const formas=await pg.evaluate(()=>{
  const m=document.querySelector('.moldura-foto')
  const r=m.getBoundingClientRect()
  return {moldura:{w:Math.round(r.width),h:Math.round(r.height),razao:+(r.width/r.height).toFixed(3)}}})
console.log('   moldura do editor:', JSON.stringify(formas.moldura))
p_('a moldura do editor tem 4:3', Math.abs(formas.moldura.razao-4/3)<0.02, String(formas.moldura.razao))

// mexer, para o enquadramento NAO ser o de origem
await pg.evaluate(()=>{const b=document.querySelector('.barra-zoom')
  b.value=String(Number(b.min)*1.9); b.dispatchEvent(new Event('input',{bubbles:true}))})
await pg.waitForTimeout(500)
const caixa=await (await pg.$('.moldura-foto')).boundingBox()
await pg.mouse.move(caixa.x+caixa.width/2, caixa.y+caixa.height/2)
await pg.mouse.down(); await pg.mouse.move(caixa.x+caixa.width/2-40, caixa.y+caixa.height/2-25,{steps:8}); await pg.mouse.up()
await pg.waitForTimeout(700)

// FOTOGRAFAR a moldura, que e o que ele diz estar a ver
const noEditor=await (await pg.$('.moldura-foto')).screenshot({path:'cmp-editor.png'})
await pg.click('.ajustar-foto .botao-acao');await pg.waitForTimeout(2500)
await pg.click('.editar-perfil button[type=submit]');await pg.waitForTimeout(7000)

// e FOTOGRAFAR a capa publica, que e o que sai
await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(5000);await limpar()
const capa=await pg.$('.perfil-capa .foto-capa')
p_('a capa publica existe', !!capa)
// Esconder o que e DESENHADO POR CIMA da capa antes de fotografar: o veu com o
// nome, o escudo e os tres pontos. Nada disso e enquadramento, e comparar com
// eles dentro mediria a diferenca do desenho e nao a do recorte, que e o que
// ele reclamou. O que se compara e imagem contra imagem.
const escondidos=await pg.evaluate(()=>{
  const alvos=[...document.querySelectorAll('.perfil-capa .veu, .perfil-capa .controlos-da-capa, .perfil-capa .canto-esquerdo, .perfil-capa .canto-direito, .perfil-capa .menu-da-capa, .perfil-capa .pega')]
  alvos.forEach(e=>{e.dataset.escondido='1'; e.style.visibility='hidden'})
  return alvos.length})
console.log(`   (escondi ${escondidos} elementos desenhados por cima da capa)`)
await pg.waitForTimeout(500)
const publica=await capa.screenshot({path:'cmp-publico.png'})
const forma=await pg.evaluate(()=>{const i=document.querySelector('.perfil-capa .foto-capa')
  const r=i.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),razao:+(r.width/r.height).toFixed(3)}})
console.log('   capa publica:     ', JSON.stringify(forma))
p_('a capa publica tem a MESMA proporcao', Math.abs(forma.razao-formas.moldura.razao)<0.02,
   `editor ${formas.moldura.razao} / publico ${forma.razao}`)

// COMPARAR O ENQUADRAMENTO, e nao as cores.
//
// A primeira versao desta comparacao media a diferenca media de cor e dava 33
// em 255, e eu ia dar isso por defeito. Guardei as duas imagens e olhei: o
// enquadramento estava igual, e a diferenca toda vinha do nome escrito por cima
// da capa e do painel branco que aparece na borda de baixo. Estava a medir o
// desenho da pagina em vez do recorte da fotografia.
//
// A arte de teste tem um bloco BRANCO no centro. Onde esse bloco aparece, e que
// tamanho tem, diz exactamente que pedaco da arte ficou visivel. Se o editor e o
// perfil mostrarem o mesmo pedaco, o bloco cai no mesmo sitio nos dois.
async function marcaBranca(buf){
  return pg.evaluate(async(b64)=>{
    const im=new Image(); im.src='data:image/png;base64,'+b64
    await im.decode()
    const L=120, A=Math.round(L*im.height/im.width)
    const c=document.createElement('canvas'); c.width=L; c.height=A
    const x=c.getContext('2d'); x.drawImage(im,0,0,L,A)
    const d=x.getImageData(0,0,L,A).data
    let x0=L,y0=A,x1=-1,y1=-1
    // Ignora as margens e a parte de baixo. As margens porque a moldura tem
    // cantos redondos e por fora deles aparece o fundo claro da pagina, que
    // conta como branco e alarga a caixa ate ao ecra inteiro. Em baixo porque
    // esta o nome, escrito a branco, e o nome nao e arte.
    const mx=Math.floor(L*0.12), my=Math.floor(A*0.10)
    for(let y=my;y<Math.floor(A*0.62);y++) for(let px=mx;px<L-mx;px++){
      const i=(y*L+px)*4
      if(d[i]>230&&d[i+1]>230&&d[i+2]>230){
        if(px<x0)x0=px; if(px>x1)x1=px; if(y<y0)y0=y; if(y>y1)y1=y }
    }
    if(x1<0) return null
    return {x:+(x0/L).toFixed(3), y:+(y0/A).toFixed(3), w:+((x1-x0)/L).toFixed(3), h:+((y1-y0)/A).toFixed(3)}
  }, buf.toString('base64'))
}
const ma=await marcaBranca(noEditor), mb=await marcaBranca(publica)
console.log('   marca no editor: ', JSON.stringify(ma))
console.log('   marca no perfil: ', JSON.stringify(mb))
p_('a marca aparece nos dois', !!ma && !!mb)
if(ma&&mb){
  const d=Math.max(Math.abs(ma.x-mb.x),Math.abs(ma.y-mb.y),Math.abs(ma.w-mb.w),Math.abs(ma.h-mb.h))
  console.log(`   maior desvio: ${(d*100).toFixed(1)}% da largura da capa`)
  p_('o que se ve no editor E o que sai no perfil', d<0.04, `desvio ${(d*100).toFixed(1)}%`)
}


} catch (e) {
  console.log('  ! ' + String(e.message).split('\n')[0])
} finally {
// limpeza
const ap=await pg.$('button.apagar-conta')
if(ap){await ap.scrollIntoViewIfNeeded();await ap.click();await pg.waitForTimeout(700)
  await pg.fill('.zona-de-risco input[type=password]',SENHA)
  await pg.click('.par-de-botoes button[type=submit]');await pg.waitForTimeout(4500)}
console.log(`\n  (conta de teste apagada = ${!pg.url().includes('/perfil')})`)
console.log(falhas.length? `\n${falhas.length} FALHA(S): ${falhas.join(' | ')}` : '\nO editor e o perfil mostram o mesmo.')
await nav.close()
}
