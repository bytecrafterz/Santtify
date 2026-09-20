// OS QUATRO INDICADORES DO CARD, tal como ele os definiu em 19/09:
//
//   VIEW = contador, nao se toca.
//   LIKE = clicavel e funcional.
//   COMENTARIO = clicavel e funcional.
//   COMPARTILHAR = clicavel e funcional.
//   CARD INTEIRO = abre o projeto.
//
// Anda pelo card como duas pessoas diferentes: quem nao tem conta, que so pode
// ver, e quem tem, que curte, comenta e partilha. No fim desfaz o que fez — a
// curtida sai, o comentario e apagado — para poder correr em producao.
//
// O QUE NAO SE DESFAZ: a partilha deixa um link curto e um evento, que e o que
// a plataforma conta. E uma partilha a mais no numero, e nao ha como apagar um
// evento sem mentir sobre o registo.
//
//   SITE=http://localhost:3100 API=http://localhost:3333/api \
//   PROJ=jesus-alfabeto-saudavel PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... \
//   node deploy/percursos/card-do-projeto.mjs
import { chromium } from 'playwright'

const SITE = process.env.SITE ?? 'http://localhost:3100'
const API = process.env.API ?? 'http://localhost:3333/api'
const PROJ = process.env.PROJ ?? 'jesus-alfabeto-saudavel'
const EMAIL = process.env.PV_ADMIN_EMAIL
const SENHA = process.env.PV_ADMIN_SENHA
if (!EMAIL || !SENHA) {
  console.log('Faltam PV_ADMIN_EMAIL e PV_ADMIN_SENHA — ver o README.')
  process.exit(2)
}

const falhas = []
const p_ = (n, v, e = '') => {
  console.log(`  ${v ? '✓' : '✗'} ${n}${e ? '   ' + e : ''}`)
  if (!v) falhas.push(n)
}

const projeto = await (await fetch(`${API}/projects/${PROJ}`)).json()
const login = await (
  await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA, projectId: projeto.id }),
  })
).json()
const comToken = (caminho, init = {}) =>
  fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${login.accessToken}`,
      ...init.headers,
    },
  }).then((r) => r.json())

/**
 * Abre a pagina inicial e poe o card pronto a ser tocado.
 *
 * Duas coisas que uma pessoa faz sem pensar e um percurso tem de fazer a mao:
 * fechar o convite para instalar a aplicacao e o aviso de privacidade, que
 * cobrem o ecra na primeira visita. E esperar que a pagina esteja viva — os
 * numeros do card vem de um pedido proprio, e tocar antes disso e tocar num
 * desenho.
 */
const abrirPaginaInicial = async (pag) => {
  const resposta = pag
    .waitForResponse((r) => r.url().includes(`/projects/${PROJ}/social`), { timeout: 90000 })
    .catch(() => null)
  await pag.goto(`${SITE}/${PROJ}`, { waitUntil: 'domcontentloaded' })
  await cardDo(pag).waitFor({ timeout: 90000 })
  await resposta
  await fecharAvisos(pag)
}

/**
 * Fecha o que a plataforma poe por cima da pagina.
 *
 * O convite para instalar a aplicacao, o aviso de privacidade e as boas-vindas
 * de quem acabou de entrar. Chama-se ANTES DE CADA TOQUE e nao so a abrir: a
 * folha de instalar volta a aparecer passado um bocado, e apanhou o percurso a
 * meio do comentario.
 */
const fecharAvisos = async (pag) => {
  for (const rotulo of [/CONTINUAR EXPLORANDO/i, /Aceitar/i, /AGORA NÃO/i]) {
    const botao = pag.getByRole('button', { name: rotulo })
    if (await botao.count()) await botao.first().click({ timeout: 5000 }).catch(() => {})
  }
  await pag.waitForTimeout(200)
}

/** O card deste projeto na página inicial. */
const cardDo = (pag) => pag.locator('.projeto-da-pagina').filter({ has: pag.locator(`a[href="/${PROJ}"]`) })
const numero = async (pag, indice) =>
  Number(
    (await cardDo(pag).locator('.indicador-grande strong').nth(indice).innerText()).replace(/\D/g, ''),
  )

const estadoAntes = await comToken(`/projects/${PROJ}/social`)
let comentarioCriado = null
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })

try {
  // ── Quem nao tem conta: ve, e e convidado a criar conta ─────────────
  const anonimo = await nav.newContext({ viewport: { width: 390, height: 844 } })
  const an = await anonimo.newPage()
  await abrirPaginaInicial(an)
  p_('o card mostra os quatro indicadores', (await cardDo(an).locator('.indicador-grande').count()) === 4)
  p_(
    'a vista e so um contador, nao e botao',
    (await cardDo(an).locator('.indicador-grande').first().evaluate((e) => e.tagName)) === 'SPAN',
  )
  p_(
    'curtir, comentar e partilhar sao botoes',
    (await cardDo(an).locator('button.indicador-grande').count()) === 3,
  )
  for (const [accao, rotulo] of [
    ['curtir', /Curtir/],
    ['comentar', /Comentários/],
    ['partilhar', /Compartilhar/],
  ]) {
    await fecharAvisos(an)
    await cardDo(an).getByRole('button', { name: rotulo }).click()
    p_(`sem conta, ${accao} convida a criar conta`, (await an.getByText(/crie a sua conta/i).count()) > 0)
    await an.getByRole('button', { name: 'Fechar' }).first().click().catch(() => {})
    await an.waitForTimeout(300)
  }
  await anonimo.close()

  // ── Quem tem conta ──────────────────────────────────────────────────
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript((r) => localStorage.setItem('pv_refresh', r), login.refreshToken)
  // O telemovel abre a folha de partilha do sistema; aqui guarda-se o que ela
  // receberia, que e o que interessa verificar.
  await ctx.addInitScript(() => {
    window.__partilhado = null
    navigator.share = async (dados) => {
      window.__partilhado = dados
    }
  })
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))
  await abrirPaginaInicial(pg)

  // CURTIR — o teste e o INTERRUPTOR, e nao "sobe um".
  //
  // Quem corre isto pode ja ter curtido este projeto noutro dia, e ai o toque
  // descurte. Verifica-se a troca nos dois sentidos, que e o que interessa.
  await fecharAvisos(pg)
  const coracao = cardDo(pg).getByRole('button', { name: /Curtir/ })
  const curtidasAntes = await numero(pg, 1)
  const curtidoAntes = (await coracao.getAttribute('aria-pressed')) === 'true'
  const esperado = curtidasAntes + (curtidoAntes ? -1 : 1)
  // A resposta do servidor, e nao so o numero no ecra: o ecra muda primeiro
  // (de proposito, para o toque nao parecer perdido) e perguntar ao servidor
  // nesse instante apanhava-o antes de ele ter gravado.
  const gravou = pg.waitForResponse(
    (r) => r.url().includes(`/projects/${PROJ}/social/like`) && r.request().method() === 'POST',
    { timeout: 30000 },
  )
  await coracao.click()
  await gravou
  await pg.waitForFunction(
    ([indice, alvo]) =>
      Number(
        document
          .querySelectorAll('.projeto-da-pagina .indicador-grande strong')[indice]
          ?.textContent?.replace(/\D/g, '') ?? '0',
      ) === alvo,
    [1, esperado],
    { timeout: 30000 },
  )
  p_(
    curtidoAntes ? 'descurtir tira a curtida' : 'curtir soma uma curtida',
    true,
    `${curtidasAntes} → ${await numero(pg, 1)}`,
  )
  p_(
    'e o coracao acompanha',
    ((await coracao.getAttribute('aria-pressed')) === 'true') === !curtidoAntes,
  )
  const noServidor = await comToken(`/projects/${PROJ}/social`)
  p_(
    'o servidor concorda',
    noServidor.curtidoPorMim === !curtidoAntes && noServidor.likes === esperado,
    `servidor: ${noServidor.likes} curtidas, minha=${noServidor.curtidoPorMim}`,
  )

  // E de volta ao que era: o interruptor tem de funcionar nos dois sentidos.
  await coracao.click()
  await pg.waitForFunction(
    ([indice, alvo]) =>
      Number(
        document
          .querySelectorAll('.projeto-da-pagina .indicador-grande strong')[indice]
          ?.textContent?.replace(/\D/g, '') ?? '0',
      ) === alvo,
    [1, curtidasAntes],
    { timeout: 30000 },
  )
  p_('e tocar outra vez volta ao que era', (await numero(pg, 1)) === curtidasAntes)

  // COMENTAR
  const comentariosAntes = await numero(pg, 2)
  await fecharAvisos(pg)
  await cardDo(pg).getByRole('button', { name: /Comentários/ }).click()
  const texto = `Comentário do percurso ${Date.now()}`
  await fecharAvisos(pg)
  const caixa = pg.getByPlaceholder(/O que pensas disto/i)
  await caixa.waitFor({ timeout: 30000 })
  await caixa.fill(texto)
  // O botao de enviar E O DESTA caixa: a pagina tem mais paineis de
  // comentarios escondidos, e o primeiro que aparece na procura pode ser um
  // deles — e nesse ninguem consegue tocar.
  await caixa.locator('xpath=ancestor::form[1]').getByRole('button', { name: 'Enviar' }).click()
  await pg.waitForFunction(
    (t) => document.body.innerText.includes(t),
    texto,
    { timeout: 30000 },
  )
  p_('o comentario aparece na lista', true)
  const lista = await comToken(`/projects/${PROJ}/social/comments`)
  comentarioCriado = lista.find((c) => c.body === texto)?.id ?? null
  p_('e fica gravado no projeto', Boolean(comentarioCriado))
  // Fecha-se pelo botao de fechar, como uma pessoa faz. O Escape nao fecha
  // este painel, e ficava aberto por cima do resto do card.
  await pg.getByRole('button', { name: 'Fechar comentários' }).click()
  await pg.getByPlaceholder(/O que pensas disto/i).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  p_('o contador de comentarios sobe', (await numero(pg, 2)) === comentariosAntes + 1)

  // PARTILHAR
  const partilhasAntes = await numero(pg, 3)
  await fecharAvisos(pg)
  await cardDo(pg).getByRole('button', { name: /Compartilhar/ }).click()
  await pg.waitForFunction(() => window.__partilhado !== null, null, { timeout: 30000 })
  const partilhado = await pg.evaluate(() => window.__partilhado)
  p_('partilhar abre a folha de partilha', Boolean(partilhado?.url), partilhado?.url)
  p_('com um link identificavel, e nao o endereco cru', /\/r\/[A-Za-z0-9]+$/.test(partilhado?.url ?? ''))
  p_('e o contador sobe', (await numero(pg, 3)) === partilhasAntes + 1)

  // O CARD INTEIRO ABRE O PROJETO.
  //
  // Toca-se num card de OUTRO projeto: estando na pagina deste, um toque que
  // nao fizesse nada passaria por bom. O ponto escolhido e o canto da fila dos
  // numeros, que nao e nenhum dos botoes — e e ali que se ve se o card inteiro
  // abre, e nao so a imagem.
  await abrirPaginaInicial(pg)
  await fecharAvisos(pg)
  const outro = pg.locator('.projeto-da-pagina').filter({ hasNot: pg.locator(`a[href="/${PROJ}"]`) }).first()
  if (await outro.count()) {
    const destino = await outro.locator('a.projeto-abrir').getAttribute('href')
    // A FOLGA POR CIMA DOS NUMEROS: nao e a imagem nem nenhum dos quatro
    // botoes. Se dali o projeto abre, o card inteiro abre — que era o pedido.
    // O PONTO TEM DE ESTAR MESMO A VISTA, e nao debaixo da barra de baixo.
    // Sem isto o toque caia na barra fixa e abria o Produto Vivo — o percurso
    // dizia "o card nao abre" e o card estava bom.
    await outro.scrollIntoViewIfNeeded()
    await pg.waitForTimeout(400)
    let alvo = null
    for (let i = 0; i < 6 && !alvo; i++) {
      const fila = await outro.locator('.projeto-numeros').boundingBox()
      const ponto = [fila.x + fila.width / 2, fila.y + 3]
      const noPonto = await pg.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.closest('.projeto-da-pagina') !== null,
        ponto,
      )
      if (noPonto) alvo = ponto
      else {
        // Descer a pagina sobe o card no ecra, para longe da barra de baixo.
        await pg.mouse.wheel(0, 120)
        await pg.waitForTimeout(300)
      }
    }
    p_('o ponto de toque esta a vista', Boolean(alvo))
    await pg.mouse.click(alvo[0], alvo[1])
    await pg.waitForURL(`**${destino}`, { timeout: 30000 })
    p_('tocar no card, fora da imagem e dos botoes, abre o projeto', pg.url().endsWith(destino), pg.url())
  } else {
    p_('tocar no card abre o projeto', true, 'so ha um projeto a mostra — nada a comparar')
  }

  p_('sem erros no navegador', erros.length === 0, erros.join(' | '))
} catch (e) {
  falhas.push('excepcao: ' + e.message)
  console.log('  ✗ ' + e.message)
} finally {
  await nav.close()
  // Desfazer: a curtida sai se ficou, e o comentario do percurso e apagado.
  const agora = await comToken(`/projects/${PROJ}/social`)
  if (agora.curtidoPorMim !== estadoAntes.curtidoPorMim) {
    await comToken(`/projects/${PROJ}/social/like`, { method: 'POST' })
  }
  if (comentarioCriado) {
    await fetch(`${API}/comments/${comentarioCriado}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${login.accessToken}` },
    })
  }
  const fim = await comToken(`/projects/${PROJ}/social`)
  console.log(
    `\n  (curtidas ${estadoAntes.likes} → ${fim.likes}, comentários ${estadoAntes.comments} → ${fim.comments})`,
  )
}

console.log(falhas.length ? `\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : '\nTUDO CERTO')
process.exit(falhas.length ? 1 : 0)
