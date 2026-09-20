// A PROMESSA CENTRAL DOS CARTOES: o que a mae aprova no ecra e o que sai na
// grafica. Foi dita por escrito ao cliente duas vezes e e a unica coisa deste
// percurso — se o nome ou o enquadramento mudarem entre a previa e o PDF, o
// resto nao interessa.
//
// Verifica tambem o que so se ve andando: a foto pequena recusada sem travar as
// outras, o ficheiro trancado antes do pagamento, e o pedido a sobreviver ao
// separador fechado.
//
//   SITE=http://localhost:3100 API=http://localhost:3333/api \
//   PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node deploy/percursos/cartoes-personalizados.mjs
import { chromium } from 'playwright'
import sharp from 'sharp'

const SITE = process.env.SITE ?? 'http://localhost:3100'
const API = process.env.API ?? 'http://localhost:3333/api'
const PROJ = process.env.PROJ ?? 'minha-identidade-e-poder-em-jesus'

const falhas = []
const p_ = (n, v, e = '') => {
  console.log(`  ${v ? '✓' : '✗'} ${n}${e ? '   ' + e : ''}`)
  if (!v) falhas.push(n)
}

/** As imagens sao feitas em codigo — ver a nota do README sobre a arte-deitada. */
const foto = async (largura, altura) =>
  sharp({
    create: { width: largura, height: altura, channels: 3, background: '#8fd17a' },
  })
    .jpeg()
    .toBuffer()

try {
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
  const ctx = await nav.newContext({ viewport: { width: 430, height: 1100 } })
  let pg = await ctx.newPage()

  let pedidoId = null
  pg.on('response', async (r) => {
    if (r.url().includes('/cartoes/pedidos') && r.request().method() === 'POST' && !pedidoId) {
      try {
        pedidoId = (await r.json()).id
      } catch {
        /* nao era o pedido */
      }
    }
  })

  await pg.goto(`${SITE}/${PROJ}/cartoes`, { waitUntil: 'networkidle' })

  // Duas criancas: uma com foto boa, outra com foto pequena.
  // "Mais uma foto" e não "Mais uma criança": desde as categorias (11/09) o
  // editor serve também os Adultos, e o rótulo não pode dizer criança.
  await pg.getByRole('button', { name: 'Mais uma foto' }).click()
  await pg.getByRole('button', { name: 'Continuar' }).click()
  await pg.locator('.cartoes-crianca').first().waitFor()

  const caixas = pg.locator('.cartoes-crianca')
  await caixas.nth(0).locator('input[type=file]').setInputFiles({
    name: 'boa.jpg',
    mimeType: 'image/jpeg',
    buffer: await foto(2000, 2600),
  })
  await pg.locator('.cartoes-veredicto-boa').first().waitFor({ timeout: 60000 })
  p_('a foto grande e aprovada', true)

  await caixas.nth(1).locator('input[type=file]').setInputFiles({
    name: 'pequena.jpg',
    mimeType: 'image/jpeg',
    buffer: await foto(300, 300),
  })
  await pg.locator('.cartoes-veredicto-ma').first().waitFor({ timeout: 60000 })
  p_('a foto pequena e recusada', true)
  p_(
    'e a recusa de uma nao trava a outra',
    (await pg.locator('.cartoes-crianca-boa').count()) === 1,
  )

  // O separador fecha-se a meio. O pedido tem de sobreviver: o Pix confirma-se
  // por fora e a mae vai sair da pagina.
  await pg.close()
  pg = await ctx.newPage()
  await pg.goto(`${SITE}/${PROJ}/cartoes`, { waitUntil: 'networkidle' })
  // Esperar pelo que se quer ver, e não pelo relógio. Uma pausa fixa de 2,5 s
  // falhava num servidor lento com o pedido retomado um instante depois.
  await pg.locator('.cartoes-escolha').first().waitFor({ timeout: 30000 }).catch(() => {})
  p_(
    'fechar o separador nao perde o pedido',
    (await pg.locator('.cartoes-escolha').count()) > 0,
  )

  await pg.locator('.cartoes-escolha input[type=checkbox]').first().check()
  p_('a caixa marca sem esperar pelo servidor', await pg.locator('.cartoes-escolha input[type=checkbox]').first().isChecked())
  await pg.waitForTimeout(1500)

  await pg.getByRole('button', { name: /pagamento/i }).click()
  // O processador exige o e-mail de quem paga. Sem ele os botões ficam parados.
  p_('sem e-mail nao se paga', await pg.getByRole('button', { name: /Pagar com Pix/i }).isDisabled())
  // O endereço de comprador de teste da documentação do Mercado Pago.
  await pg.locator('.cartoes-email-pagamento input').fill(process.env.EMAIL_PAGADOR ?? 'test_user_br@testuser.com')
  await pg.getByRole('button', { name: /Pagar com Pix/i }).click()
  await pg.locator('.cartoes-pix-qr svg').waitFor({ timeout: 45000 })
  p_('o Pix mostra um QR', true)
  // Com o Mercado Pago ligado o código é um Pix a sério (EMV, começa por 000201);
  // com o provedor manual é o texto de aviso. Os dois têm de ter o botão de copiar.
  const codigo = await pg.locator('.cartoes-pix-codigo').inputValue().catch(() => '')
  p_('o Pix tem o codigo copia e cola', codigo.length > 20, codigo.slice(0, 24) + '…')
  if (process.env.PROVEDOR === 'mercadopago') {
    p_('e e um Pix de verdade', codigo.startsWith('000201'), codigo.slice(0, 6))
  }
  p_('com o botao de copiar', (await pg.getByRole('button', { name: /Copiar código Pix/i }).count()) === 1)

  // O ficheiro esta trancado enquanto o pagamento nao confirma. A verificacao
  // e no servidor: o botao a cinzento nao impede ninguem de escrever o endereco.
  const crianca = await (await fetch(`${API}/projects/${PROJ}/cartoes/pedidos/${pedidoId}`))
    .json()
    .then((d) => d.criancas.find((c) => c.selecionada))
  const trancado = await fetch(
    `${API}/projects/${PROJ}/cartoes/pedidos/${pedidoId}/criancas/${crianca.id}/cartoes.pdf`,
  )
  p_('o PDF esta trancado antes do pagamento', trancado.status === 403, String(trancado.status))

  await pg.getByRole('button', { name: /Personalizar os cart/i }).click()
  await pg.locator('.cartoes-folha').first().waitFor({ timeout: 45000 })
  await pg.locator('.cartoes-campo input[type=text]').fill('ANA BEATRIZ')
  await pg.waitForTimeout(2500)

  // O NOME NUMA LINHA SO, como o PDF o escreve. Enquanto partia em duas, a
  // previa mentia sobre o que ia sair impresso.
  const nome = await pg.locator('.cartoes-folha-nome').first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return { corpo: parseFloat(cs.fontSize), quebra: cs.whiteSpace, texto: el.textContent }
  })
  p_('o nome nao parte em duas linhas', nome.quebra === 'nowrap', nome.texto)

  // Os sete atualizam-se juntos: uma foto, um nome, um enquadramento.
  const miniaturas = await pg.locator('.cartoes-miniatura .cartoes-folha-nome').allTextContents()
  p_(
    'o nome aparece nos sete cartoes',
    miniaturas.length >= 7 && miniaturas.every((t) => t === nome.texto),
    `${miniaturas.length} miniaturas`,
  )

  await nav.close()

  console.log(
    '\n  (a comparacao previa/PDF a 300 dpi precisa do pagamento confirmado —\n' +
      '   ver o painel, em Pedidos de cartoes)',
  )
} catch (e) {
  falhas.push('excepcao: ' + e.message)
  console.log('  ✗ ' + e.message)
}

console.log(falhas.length ? `\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : '\nTUDO CERTO')
process.exit(falhas.length ? 1 : 0)
