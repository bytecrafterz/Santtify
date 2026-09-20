// O CARTAO QUE CHEGA AO WHATSAPP. Nao o endereco: o que aparece na mensagem.
// Ele disse tres vezes que o compartilhar "chega de forma generica" e eu andava
// a olhar para o endereco, que ja estava certo.
import { chromium } from 'playwright'
const SITE = process.env.SITE ?? 'https://santtify.com', PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const meta=async(url)=>{
  const r=await fetch(url); const h=await r.text()
  const g=(prop)=>(h.match(new RegExp(`<meta property="og:${prop}" content="([^"]*)"`))||[])[1]??null
  return {titulo:g('title'), descricao:g('description'), imagem:g('image')}
}
try{
const nav=await chromium.launch({ executablePath: process.env.CHROMIUM || undefined }); const pg=await (await nav.newContext()).newPage()
await pg.goto(`${SITE}/${PROJ}`,{waitUntil:'domcontentloaded'})
const faixas=await pg.evaluate(async()=>{
  const r=await fetch('/api/projects/jesus-alfabeto-saudavel/contents/b')
  const d=await r.json(); const c=d.content||d
  return (c.blocks||[]).filter(b=>b.type==='AUDIO'&&b.arte).map(b=>({id:b.id,titulo:b.titulo,arte:b.arte}))})
await nav.close()

const projeto = await meta(`${SITE}/${PROJ}`)
console.log(`   cartao do projeto:  "${projeto.titulo}"`)
p_('a pagina sem partilha mantem o cartao do projeto', projeto.titulo==='Jesus Alfabeto Saudável')

// Duas faixas DIFERENTES da mesma letra tem de dar cartoes diferentes.
const a=await meta(`${SITE}/${PROJ}?letra=b&pub=${faixas[0].id}`)
const b=await meta(`${SITE}/${PROJ}?letra=b&pub=${faixas[1].id}`)
console.log(`   faixa 1: "${a.titulo}"`)
console.log(`   faixa 2: "${b.titulo}"`)
p_('o cartao traz o titulo da publicacao', a.titulo && a.titulo!==projeto.titulo, a.titulo)
p_('e a arte da publicacao', a.imagem===faixas[0].arte, a.imagem?.split('/').pop())
p_('duas faixas dao cartoes diferentes', a.titulo!==b.titulo || a.imagem!==b.imagem)
p_('a descricao e a da publicacao', Boolean(a.descricao) && a.descricao!==projeto.descricao)
p_('o titulo diz a faixa E a letra', /·/.test(a.titulo||'') || a.titulo===b.titulo, a.titulo)

// Um endereco inventado nao pode partir a pagina nem mentir.
const mau=await fetch(`${SITE}/${PROJ}?letra=b&pub=nao-existe`)
p_('um endereco inventado devolve a pagina na mesma', mau.status===200, String(mau.status))
}catch(e){falhas.push('excepcao: '+e.message);console.log('  ✗ '+e.message)}
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')
process.exit(falhas.length?1:0)
