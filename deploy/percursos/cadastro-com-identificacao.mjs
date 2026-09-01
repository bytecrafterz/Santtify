// O cadastro que ele pediu em 31/08: nome, @identificador UNICO e fotografia,
// antes de a conta existir.
//
// Cria UMA conta de teste e apaga-a no fim pelo botao de apagar conta. Se a
// limpeza falhar, o percurso FALHA: uma conta de teste esquecida na base dele
// foi o que o levou a escrever este requisito.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,v,e='')=>{console.log(`  ${v?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!v) falhas.push(n)}
const marca=String(Date.now()).slice(-6)
const EMAIL=`teste.id.${marca}@santtify.dev`, SENHA='Teste.Id.0109.xyz', NOME=`Teste Id ${marca}`
const FOTO='/tmp/foto-teste.png'
// Um PNG de 8x8, escrito aqui: o percurso nao pode depender de um ficheiro que
// por acaso exista na maquina de quem o corre.
writeFileSync(FOTO, Buffer.from(
 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWklEQVR4nO3NMQEAAAgDoC1Z+hcaTh'+
 '+gAnOmCggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI'+
 'CAgICAgICAgICAgIDA/wMHFwABZfqzUgAAAABJRU5ErkJggg==','base64'))

const nav=await chromium.launch()
const pg=await (await nav.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('dialog',d=>d.accept())
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}
let criada=false
try{

await pg.goto(`${SITE}/${PROJ}/cadastrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3000);await limpar()

// ── O servidor exige, e nao so o formulario ────────────────────────
// Corre DEPOIS de abrir a pagina: a partir de about:blank um fetch para o
// site e outra origem e o navegador recusa-o antes de sair.
console.log('\nA REGRA VIVE NO SERVIDOR')
const semFoto = await pg.evaluate(async (email) => {
  const c=new FormData(); c.append('projectId','00000000-0000-0000-0000-000000000000')
  c.append('email',email); c.append('password','SenhaLongaSuficiente1')
  c.append('displayName','Sem Foto'); c.append('username','semfototeste')
  const r=await fetch('/api/auth/register',{method:'POST',body:c})
  return {estado:r.status, corpo:(await r.json().catch(()=>({}))).message}
}, `x.${marca}@santtify.dev`)
p_('um cadastro sem fotografia e recusado pelo servidor', semFoto.estado>=400, `${semFoto.estado} ${semFoto.corpo}`)

// ── O formulario ───────────────────────────────────────────────────
console.log('\nO FORMULARIO')
p_('a regra da comunidade aparece antes dos campos', await pg.isVisible('.regra-do-cadastro'))
p_('existe campo de identificador', await pg.isVisible('.campo-identificador input'))

await pg.fill('input[name=displayName]', NOME)
await pg.click('input[name=email]')     // blur do nome sugere o identificador
await pg.waitForTimeout(1200)
const sugerido = await pg.inputValue('.campo-identificador input')
p_('o identificador vem sugerido a partir do nome', sugerido.length>0, `@${sugerido}`)

// Um identificador que JA existe: @kadosh e de uma pessoa real dele.
await pg.fill('.campo-identificador input','kadosh')
await pg.waitForTimeout(1800)
const ocupado = await pg.textContent('.recado-identificador')
p_('um identificador ja usado e recusado enquanto se escreve', /em uso/i.test(ocupado||''), ocupado?.trim())
p_('e oferece um livre por perto', /usar @/.test(ocupado||''), ocupado?.trim())

const meu = `teste${marca}`
await pg.fill('.campo-identificador input', meu)
await pg.waitForTimeout(1800)
const livre = await pg.textContent('.recado-identificador')
p_('um identificador livre e confirmado', /livre/i.test(livre||''), livre?.trim())

await pg.fill('input[name=email]', EMAIL)
await pg.fill('input[name=password]', SENHA)

// Sem fotografia, nao passa.
await pg.click('button[type=submit]'); await pg.waitForTimeout(2500)
p_('sem fotografia o formulario nao deixa avancar', pg.url().includes('/cadastrar'))

// Com fotografia: escolher -> enquadrar -> confirmar
await pg.setInputFiles('.campo-foto-cadastro input[type=file]', FOTO)
await pg.waitForTimeout(2500)
const enquadrador = await pg.isVisible('.ajustar-foto')
p_('a fotografia passa pelo enquadrador', enquadrador)
if (enquadrador) {
  const b=await pg.$('.ajustar-foto button:has-text("Usar"), .ajustar-foto button:has-text("Confirmar"), .ajustar-foto button[type=submit]')
  if(b){await b.click()} else {
    const todos=await pg.$$('.ajustar-foto button'); if(todos.length) await todos[todos.length-1].click()
  }
  await pg.waitForTimeout(3000)
}
p_('a fotografia escolhida aparece antes de enviar', await pg.isVisible('.campo-foto-cadastro .previa-avatar'))

await pg.click('button[type=submit]'); await pg.waitForTimeout(7000); await limpar()
criada = !pg.url().includes('/cadastrar')
p_('a conta e criada', criada, pg.url())

// ── O que ficou gravado ────────────────────────────────────────────
if (criada) {
  console.log('\nO QUE FICOU GRAVADO')
  await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4000);await limpar()
  const perfil = await pg.evaluate(async()=>{
    const r=await fetch('/api/me/profile',{headers:{Authorization:'Bearer '+(window.__t??'')}})
    return r.ok? await r.json() : null
  })
  const noEcra = await pg.evaluate(()=>{
    const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && /^@/.test(e.textContent?.trim()??''))
    const foto=document.querySelector('.foto-capa')
    return {arroba: el?.textContent?.trim()??null, temFoto: Boolean(foto && !foto.classList.contains('arte-sem-foto'))}
  })
  p_('o perfil mostra o @identificador', noEcra.arroba===`@${meu}`, String(noEcra.arroba))
  p_('o perfil mostra a fotografia, e nao a arte de quem nao tem', noEcra.temFoto)
}

}catch(e){falhas.push(`excepcao: ${e.message}`);console.log(`  ✗ excepcao: ${e.message}`)}

// ── Limpeza. Falhar aqui e falhar o percurso. ──────────────────────
console.log('\nLIMPEZA')
if (criada) {
  try{
    // /perfil/editar, e nao /perfil: e ali que vive o apagar conta. A primeira
    // versao deste percurso procurou o botao na pagina errada, nao o encontrou,
    // e deixou a conta de teste na base dele. Foi assim que ele apanhou a conta
    // "Pf 005981" e escreveu o requisito que este percurso verifica.
    await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4000);await limpar()
    const abrir=await pg.$('button.apagar-conta')
    if(!abrir) throw new Error('nao encontrei o botao de apagar conta')
    await abrir.click()
    await pg.waitForTimeout(1000)
    await pg.fill('.apagar-conta-aberto input[type=password], input[type=password]', SENHA)
    await pg.click('button[type=submit].apagar-conta')
    await pg.waitForTimeout(5000)
    // Confere pelo unico sitio que nao mente: tentar entrar outra vez.
    await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
    await pg.fill('input[type=email]',EMAIL); await pg.fill('input[type=password]',SENHA)
    await pg.click('button[type=submit]'); await pg.waitForTimeout(4000)
    p_('a conta de teste foi mesmo apagada', pg.url().includes('/entrar'), pg.url())
  }catch(e){ p_('a conta de teste foi mesmo apagada', false, `limpeza rebentou: ${e.message}`) }
} else {
  console.log('  (nao houve conta para apagar)')
}

await nav.close()
console.log(falhas.length?`\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}`:'\nTUDO CERTO')
process.exit(falhas.length?1:0)
