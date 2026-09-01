// O percurso que ele escreveu no item 8, pela ordem em que o escreveu:
// Entrar -> Perfil -> Voltar -> Editar -> Salvar -> Cancelar -> Produto Vivo
// -> Conteudo -> Audio -> PDF -> Imprimir -> Compartilhar -> Voltar -> Fechar
// -> Entrar novamente.
import { chromium } from 'playwright'
import { criarConta } from './criar-conta.mjs'
const SITE='https://santtify.com', PROJ='jesus-alfabeto-saudavel'
const falhas=[]
const p_=(n,ok,e='')=>{console.log(`  ${ok?'✓':'✗'} ${n}${e?'   '+e:''}`); if(!ok) falhas.push(n)}
const marca=String(Date.now()).slice(-6)
const EMAIL=`teste.item8.${marca}@santtify.dev`, SENHA='Teste.Item8.2808', NOME=`Item8 ${marca}`

const nav=await chromium.launch()
const ctx=await nav.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true,
  permissions:['clipboard-read','clipboard-write']})
const pg=await ctx.newPage()
const limpar=async()=>{for(const t of ['AGORA NÃO','CONTINUAR EXPLORANDO','Aceitar']){const b=await pg.$(`button:has-text("${t}")`);if(b){await b.click();await pg.waitForTimeout(400)}}}

console.log(`\nconta descartavel: ${EMAIL}\n`)

// 1. ENTRAR (cadastro conta como entrar pela primeira vez)
await criarConta(pg,{site:SITE,projeto:PROJ,email:EMAIL,senha:SENHA,nome:NOME,limpar})

// A limpeza corre mesmo que o percurso falhe a meio. Sem isto, uma falha
// deixa a conta de teste na base dele: aconteceu em 29/08 com o percurso
// do editor, que ficou a apontar para um botao que eu tinha mudado.
try {
p_('1. ENTRAR', !pg.url().includes('/cadastrar'))

// 2. PERFIL
await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
p_('2. PERFIL abre com a pessoa la dentro', (await pg.textContent('h1'))?.includes(NOME.split(' ')[0]) || !!(await pg.$('.voltar-do-perfil')))

// 3. VOLTAR
await pg.click('.voltar-do-perfil');await pg.waitForTimeout(2500)
p_('3. VOLTAR sai do perfil', pg.url().endsWith(`/${PROJ}`), pg.url().replace(SITE,''))

// 4. EDITAR -> SALVAR
await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
// A edicao tem pagina propria desde 29/08: /perfil/editar. O atalho no perfil
// e um link e nao um botao que abre um formulario ali mesmo.
const abrirEditar = await pg.$('a[href$="/perfil/editar"]')
p_('4. EDITAR: o atalho para a pagina de edicao existe', !!abrirEditar)
if(abrirEditar){await abrirEditar.scrollIntoViewIfNeeded();await abrirEditar.click();await pg.waitForTimeout(3500);await limpar()}
p_('4. EDITAR: abre em pagina propria', pg.url().endsWith('/perfil/editar'), pg.url().replace(SITE,''))
// Pelo id: desde que o campo do @identificador entrou nesta pagina, "o
// primeiro input de texto" deixou de querer dizer "o nome".
const campoNome = await pg.$('#perfil-nome')
p_('4. EDITAR: o formulario abre', !!campoNome)
if(campoNome){
  await campoNome.scrollIntoViewIfNeeded();await pg.waitForTimeout(300)
  // Sem digitos: o nome do perfil recusa numeros desde 01/09.
  await campoNome.fill(`${NOME.replace(/\d/g, (d) => 'abcdefghij'[Number(d)])} editado`)
  const gravar = await pg.$('.editar-perfil button[type=submit]')
  const visivel = gravar ? await gravar.isVisible() : false
  p_('5. SALVAR esta a vista sem procurar', visivel)
  await gravar.click();await pg.waitForTimeout(6000)
  p_('5. SALVAR devolve ao perfil publico sozinho', pg.url().endsWith('/perfil'), pg.url().replace(SITE,''))
  await pg.waitForTimeout(500);await limpar()
  const guardou = (await pg.textContent('body'))?.includes('editado')
  p_('5. SALVAR guardou mesmo', !!guardou)
}

// 6. CANCELAR (a outra porta: entrar, cancelar, voltar)
// Gravar devolve ao perfil, por isso volta-se a entrar na edicao para a porta
// do cancelar.
await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
const campo2 = await pg.$('#perfil-nome')
if(campo2){
  await campo2.scrollIntoViewIfNeeded()
  await campo2.fill('NOME QUE NAO DEVE FICAR')
  const cancelar = await pg.$('.editar-perfil button.secundario, .editar-perfil button:has-text("Cancelar")')
  p_('6. CANCELAR existe e esta a vista', cancelar? await cancelar.isVisible():false)
  if(cancelar){await cancelar.click();await pg.waitForTimeout(1500)}
  await pg.reload({waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
  p_('6. CANCELAR nao guardou nada', !(await pg.textContent('body'))?.includes('NAO DEVE FICAR'))
}

// 7. PRODUTO VIVO
await pg.goto(`${SITE}/${PROJ}/produto-vivo`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
p_('7. PRODUTO VIVO abre', pg.url().includes('/produto-vivo'))
p_('7. e sem andaime de administrador a vista', !(await pg.textContent('body'))?.includes('aguardando o link'))

// 8. CONTEUDO -> AUDIO
await pg.goto(`${SITE}/${PROJ}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
const letras=await pg.$$('.letra-bloco')
const abertas = await pg.$$('.letra-bloco:not(.trancada)')
p_('8. ha letras destrancadas para abrir', abertas.length>0, `${abertas.length} de ${letras.length}`)
await abertas[0].click();await pg.waitForTimeout(4500)
// A plataforma e uma sequencia continua: a letra abre aqui mesmo, sem mudar de
// endereco. Foi assim que ele a desenhou, e nao um defeito.
p_('8. CONTEUDO da letra abre', !!(await pg.$('.faixa-imprimir, .tocador, audio')))
const audio = await pg.$('audio, .tocador, .faixa')
p_('9. AUDIO esta na pagina', !!audio)

// 10. PDF -> IMPRIMIR -> COMPARTILHAR
const faixa=await pg.$('.faixa-imprimir')
if(faixa){await faixa.scrollIntoViewIfNeeded();await pg.waitForTimeout(400)
  await pg.click('a.botao-imprimir:not(.secundario)');await pg.waitForTimeout(4500)}
p_('10. PDF: a pagina do cartao abre', pg.url().includes('/cartao'))
await pg.waitForTimeout(4000)
const prefetch = await pg.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('cartao.pdf')).length)
p_('10. o cartao ja esta preparado antes do toque', prefetch>0, `${prefetch} pedido(s)`)
const resp = await pg.evaluate(async()=>{
  const b=[...document.querySelectorAll('.acao-do-cartao')].find(x=>/COMPARTILHAR/.test(x.textContent))
  b.click(); await new Promise(r=>setTimeout(r,2500))
  return document.querySelector('.nota-ok')?.textContent || document.querySelector('.vista-cartao .erro')?.textContent || null})
p_('11. COMPARTILHAR responde sempre', !!resp, (resp||'NADA').slice(0,60))
const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:20000}).catch(()=>null), pg.click('a.acao-do-cartao[download]')])
p_('12. BAIXAR entrega o PDF', !!dl, dl?dl.suggestedFilename():'sem download')

// 13. VOLTAR / FECHAR
await pg.click('.acao-do-cartao:has-text("VOLTAR")');await pg.waitForTimeout(2500)
p_('13. VOLTAR sai do cartao', !pg.url().includes('/cartao'), pg.url().replace(SITE,''))

// 14. ENTRAR NOVAMENTE
await pg.evaluate(()=>localStorage.clear())
await pg.goto(`${SITE}/${PROJ}/entrar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(2500);await limpar()
await pg.fill('input[type=email]',EMAIL);await pg.fill('input[type=password]',SENHA)
await pg.click('button[type=submit]');await pg.waitForTimeout(4500)
p_('14. ENTRAR NOVAMENTE', !pg.url().includes('/entrar'), pg.url().replace(SITE,''))

// LIMPEZA: a conta descartavel apaga-se a si propria pelo botao novo
await pg.goto(`${SITE}/${PROJ}/perfil`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
} catch (e) {
  // Uma excepção é uma falha: ver a nota em editor-igual-ao-publico.mjs.
  falhas.push('rebentou: ' + String(e.message).split('\n')[0].slice(0, 60))
} finally {
// Apagar a conta mudou para a pagina de edicao, com a troca de senha.
await pg.goto(`${SITE}/${PROJ}/perfil/editar`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(3500);await limpar()
const ap=await pg.$('button.apagar-conta')
if(ap){await ap.scrollIntoViewIfNeeded();await ap.click();await pg.waitForTimeout(700)
  await pg.fill('.zona-de-risco input[type=password]',SENHA)
  await pg.click('.par-de-botoes button[type=submit]');await pg.waitForTimeout(4500)}
/*
  UMA LIMPEZA FALHADA E UMA FALHA, e nao uma linha de registo.

  Isto escrevia "apagada = false" e seguia. Em 31/08 uma conta de teste minha
  sobreviveu assim, apareceu na comunidade dele como "Pf 005981" sem foto e sem
  nome a serio, e ele escreveu-me a pedir regras de seguranca no cadastro por
  causa dela. Um aviso que nao entra na lista de falhas desaparece de qualquer
  resumo filtrado — e eu filtro sempre.
*/
if (ap && !pg.url().includes('/perfil')) console.log('\n  (conta de teste apagada)')
else falhas.push(`A CONTA DE TESTE NAO FOI APAGADA: ${EMAIL}`)
console.log(falhas.length? `\n${falhas.length} FALHA(S): ${falhas.join(' | ')}` : '\nO percurso inteiro passa.')
await nav.close()

}