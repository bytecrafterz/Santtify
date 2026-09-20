// AS LETRAS ESCREVEM-SE SOZINHAS, do envio do audio ate a letra no ar.
//
// Pedido dele em 19/09: "eu publico o audio e o sistema reconhece o que esta
// sendo cantado". Este percurso segue esse caminho inteiro como uma pessoa o
// faz: envia o audio, ve a musica entrar na fila sem carregar em nada, ve a
// percentagem a subir no painel, e ve a letra publicada no fim.
//
// O transcritor a serio demora o tempo da musica. Aqui quem faz o papel dele e
// o proprio percurso, pela mesma porta e com a mesma chave (TRANSCRITOR_TOKEN):
// pede a proxima da fila, diz em que ponto vai, e entrega o que ouviu. E
// exactamente o que o programa faz no servidor, sem os minutos de espera.
//
// SEGURO EM PRODUCAO: so mexe no cartao VAGO que lhe derem — um cartao de audio
// AINDA SEM AUDIO — e repoe-o vazio no fim, mesmo se falhar a meio. Sem VAGO,
// faz so as verificacoes que nao escrevem nada.
//
//   SITE=http://localhost:3100 API=http://localhost:3333/api \
//   PROJ=31-atributos-de-deus VAGO=<id de um cartao de audio sem audio> \
//   TRANSCRITOR_TOKEN=... PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... \
//   node deploy/percursos/letras-automaticas.mjs
import { chromium } from 'playwright'

const SITE = process.env.SITE ?? 'http://localhost:3100'
const API = process.env.API ?? 'http://localhost:3333/api'
const PROJ = process.env.PROJ ?? '31-atributos-de-deus'
const VAGO = process.env.VAGO
const CHAVE = process.env.TRANSCRITOR_TOKEN
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
const saltar = (n, porque) => console.log(`  – ${n}   (${porque})`)

const projeto = await (await fetch(`${API}/projects/${PROJ}`)).json()
const login = await (
  await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA, projectId: projeto.id }),
  })
).json()
const admin = (caminho, init = {}) =>
  fetch(`${API}/admin${caminho}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${login.accessToken}`,
      ...init.headers,
    },
  }).then((r) => r.json())
const transcritor = (caminho, corpo, metodo = 'POST') =>
  fetch(`${API}/interno/transcricoes${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-transcritor-token': CHAVE ?? '' },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  })

/**
 * Um som de um segundo, feito aqui.
 *
 * Um WAV e um cabecalho e as amostras a seguir; escreve-se em vinte linhas e
 * evita guardar um ficheiro de audio no repositorio so para o teste. Ninguem o
 * ouve: serve para haver mesmo um ficheiro no fim do caminho do envio.
 */
function somDeTeste() {
  const taxa = 8000
  const amostras = taxa
  const dados = Buffer.alloc(amostras * 2)
  for (let i = 0; i < amostras; i++) {
    dados.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 8000), i * 2)
  }
  const cabecalho = Buffer.alloc(44)
  cabecalho.write('RIFF', 0)
  cabecalho.writeUInt32LE(36 + dados.length, 4)
  cabecalho.write('WAVEfmt ', 8)
  cabecalho.writeUInt32LE(16, 16)
  cabecalho.writeUInt16LE(1, 20)
  cabecalho.writeUInt16LE(1, 22)
  cabecalho.writeUInt32LE(taxa, 24)
  cabecalho.writeUInt32LE(taxa * 2, 28)
  cabecalho.writeUInt16LE(2, 32)
  cabecalho.writeUInt16LE(16, 34)
  cabecalho.write('data', 36)
  cabecalho.writeUInt32LE(dados.length, 40)
  return Buffer.concat([cabecalho, dados])
}

const enviarSom = async () => {
  const forma = new FormData()
  forma.append('file', new Blob([somDeTeste()], { type: 'audio/wav' }), 'teste-do-percurso.wav')
  const r = await fetch(`${API}/admin/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${login.accessToken}` },
    body: forma,
  })
  return r.json()
}

/** O que o transcritor diria ter ouvido. Tres frases com tempo de cada palavra. */
const TIRADAS = [
  { texto: 'Antes de eu nascer', inicioMs: 200, fimMs: 900 },
  { texto: 'Deus ja me conhecia', inicioMs: 900, fimMs: 1600 },
  { texto: 'E o amor dele nunca acaba', inicioMs: 1600, fimMs: 2400 },
].map((t) => {
  const palavras = t.texto.split(' ')
  const passo = (t.fimMs - t.inicioMs) / palavras.length
  return {
    ...t,
    palavras: palavras.map((texto, i) => ({
      texto,
      inicioMs: Math.round(t.inicioMs + i * passo),
      fimMs: Math.round(t.inicioMs + (i + 1) * passo),
    })),
  }
})

const fecharAvisos = async (pag) => {
  for (const rotulo of [/CONTINUAR EXPLORANDO/i, /Aceitar/i, /AGORA NÃO/i]) {
    const botao = pag.getByRole('button', { name: rotulo })
    if (await botao.count()) await botao.first().click({ timeout: 5000 }).catch(() => {})
  }
  await pag.waitForTimeout(200)
}

/** Espera que a oficina mostre o que se lhe pede. O painel pergunta de 4 em 4 s. */
const ateQue = async (pag, quando, segundos = 20) => {
  for (let i = 0; i < segundos * 2; i++) {
    if (await quando()) return true
    await pag.waitForTimeout(500)
  }
  return false
}

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
let repor = null

try {
  const antes = await admin(`/projects/${PROJ}/transcricoes`)
  p_('o painel sabe quantas musicas ha', Array.isArray(antes.faixas), `${antes.resumo?.total} faixas`)

  const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } })
  await ctx.addInitScript((r) => localStorage.setItem('pv_refresh', r), login.refreshToken)
  const pg = await ctx.newPage()
  const erros = []
  pg.on('pageerror', (e) => erros.push(e.message))

  await pg.goto(`${SITE}/${PROJ}/admin/karaoke`, { waitUntil: 'domcontentloaded' })
  await pg.locator('.oficina').waitFor({ timeout: 90000 })
  await fecharAvisos(pg)

  // ── O que ele ve al chegar ──────────────────────────────────────────
  const anel = await pg.locator('.oficina-anel-centro strong').innerText()
  p_(
    'o anel mostra a mesma percentagem que o servidor',
    Number(anel.replace(/\D/g, '')) === antes.resumo.percentagem,
    `${anel.replace(/\n/g, '')} vs ${antes.resumo.percentagem}%`,
  )
  const numeros = await pg.locator('.oficina-numeros li strong').allTextContents()
  p_(
    'os quatro numeros sao os do servidor',
    numeros.join(',') ===
      [antes.resumo.prontas, antes.resumo.aOuvirAgora, antes.resumo.naFila, antes.resumo.falhadas].join(','),
    numeros.join(', '),
  )
  p_('e ha um botao para escrever as que faltam', await pg.locator('.oficina-botao.principal').isVisible())

  /*
    SO SE A FILA ESTIVER VAZIA.

    O percurso faz de transcritor: pede a proxima da fila. Se houver musicas
    dele a espera, a que vinha na mao era uma delas — e o percurso escrevia-lhe
    por cima uma letra de mentira. Com a fila vazia, a unica que la esta e a
    que este percurso acabou de por.
  */
  const filaOcupada = antes.resumo.naFila + antes.resumo.aOuvirAgora > 0

  if (!VAGO) {
    saltar('o caminho inteiro de uma musica', 'sem VAGO — ver o cabecalho deste ficheiro')
  } else if (!CHAVE) {
    saltar('o caminho inteiro de uma musica', 'sem TRANSCRITOR_TOKEN')
  } else if (filaOcupada) {
    saltar(
      'o caminho inteiro de uma musica',
      `ha ${antes.resumo.naFila + antes.resumo.aOuvirAgora} musica(s) na fila — o percurso nao lhes toca`,
    )
  } else {
    // ── Enviar o audio poe a musica na fila, sem carregar em nada ──────
    const cartaoAntes = await admin(`/cards/${VAGO}/karaoke`)
    p_('o cartao de teste esta mesmo vago', !cartaoAntes.faixa?.audio, cartaoAntes.faixa?.titulo)
    const som = await enviarSom()
    repor = { cartao: VAGO, titulo: cartaoAntes.faixa?.titulo ?? null }
    await admin(`/cards/${VAGO}`, { method: 'PATCH', body: JSON.stringify({ assetId: som.id }) })

    const comAudio = await admin(`/projects/${PROJ}/transcricoes`)
    const posta = comAudio.faixas.find((f) => f.id === VAGO)
    p_('enviar o audio poe a musica na fila sozinho', posta?.estado === 'PENDENTE', posta?.estado)

    // ── O transcritor faz o seu trabalho, pela porta dele ──────────────
    const pedida = await (await transcritor('/proxima')).json()
    p_('o transcritor recebe a musica e o endereco do audio', pedida.id && String(pedida.audio).includes('/uploads/'))
    // Cinto e suspensorios: se por alguma razao veio outra musica, devolve-se a
    // fila e nao se lhe escreve nada por cima.
    if (pedida.audio !== som.url) {
      if (pedida.id) await transcritor(`/${pedida.id}/falhou`, { erro: 'devolvida pelo percurso' })
      throw new Error(`a fila devolveu outra musica (${pedida.nome ?? 'sem nome'}) — nada foi escrito`)
    }
    // Marcada como "a ouvir" ANTES de responder: e o que impede dois
    // transcritores de ouvirem a mesma musica ao mesmo tempo. Confere-se pelo
    // painel e nao pedindo outra vez — pedir outra vez tirava da fila uma
    // musica a serio, e ela ficava meia hora presa por culpa do teste.
    const aOuvir = await admin(`/projects/${PROJ}/transcricoes`)
    p_(
      'e ela fica logo marcada como "a ouvir"',
      aOuvir.faixas.find((f) => f.id === VAGO)?.estado === 'A_OUVIR',
    )

    await transcritor(`/${pedida.id}/progresso`, { progresso: 50 }, 'PATCH')

    // ── A percentagem que ele ve, no painel, a subir ───────────────────
    // Pela id da faixa, e nao pelo nome: "Bloco 1" e o titulo de uma e o
    // conteudo de outra, e o percurso media a linha errada.
    const naLista = pg.locator(`.oficina-faixa[data-faixa="${VAGO}"]`)
    p_(
      'o painel mostra a musica a ser ouvida, com a percentagem',
      await ateQue(pg, async () => (await naLista.locator('.oficina-selo').innerText().catch(() => '')).includes('50')),
      await naLista.locator('.oficina-selo').innerText().catch(() => '(nao apareceu)'),
    )
    p_('com a roda a andar enquanto espera', await pg.locator('.oficina .oficina-roda').first().isVisible())
    p_('e a barra da musica acompanha', (await naLista.locator('.oficina-faixa-barra > span').getAttribute('style'))?.includes('50%'))

    const aMeio = await admin(`/projects/${PROJ}/transcricoes`)
    const sos = Math.round((aMeio.resumo.prontas / aMeio.resumo.total) * 100)
    p_(
      'a percentagem geral conta meia musica a ser ouvida',
      aMeio.resumo.aOuvirAgora === 1 &&
        aMeio.resumo.percentagem ===
          Math.round(((aMeio.resumo.prontas + 0.5) / aMeio.resumo.total) * 100),
      `${aMeio.resumo.percentagem}% (so as acabadas dariam ${sos}%)`,
    )

    // ── A letra fica escrita, publicada, e marcada como automatica ─────
    const fim = await (await transcritor(`/${pedida.id}/pronta`, { tiradas: TIRADAS, segundos: 3 })).json()
    p_('o que foi ouvido vira frases de karaoke', fim.frases === 3, `${fim.frases} frases`)

    const letra = await admin(`/cards/${VAGO}/karaoke`)
    p_('a letra fica publicada sem ele ter de a rever', letra.letra.publicada)
    p_(
      'e e a letra da musica, palavra a palavra',
      letra.letra.frases[0]?.texto === 'Antes de eu nascer' &&
        letra.letra.frases[0]?.palavras.length === 4 &&
        letra.letra.frases[0]?.palavras[0]?.inicioMs === 200,
      letra.letra.frases.map((f) => f.texto).join(' / '),
    )

    const depois = await admin(`/projects/${PROJ}/transcricoes`)
    const pronta = depois.faixas.find((f) => f.id === VAGO)
    p_('o painel marca-a como automatica', pronta?.origem === 'AUTOMATICA' && pronta?.estado === 'PRONTA')

    await pg.reload({ waitUntil: 'domcontentloaded' })
    await pg.locator('.oficina').waitFor({ timeout: 60000 })
    await fecharAvisos(pg)
    const verTodas = pg.locator('.oficina-mais')
    if (await verTodas.count()) await verTodas.first().click()
    const selosDaFaixa = () =>
      pg.locator(`.oficina-faixa[data-faixa="${VAGO}"] .oficina-selo`).allTextContents()
    p_(
      'e diz, na lista, que a letra e automatica',
      await ateQue(pg, async () => (await selosDaFaixa()).some((t) => t.includes('automática'))),
      (await selosDaFaixa()).join(' | ') || '(nenhuma linha com esse nome)',
    )

    // ── TROCAR O AUDIO E TROCAR A MUSICA ───────────────────────────────
    //
    // Uma letra automatica e da musica que estava la. Se ele substituir o
    // audio, a letra antiga acenderia palavras que ninguem esta a cantar —
    // por isso a faixa volta a fila sozinha.
    const som2 = await enviarSom()
    await admin(`/cards/${VAGO}`, { method: 'PATCH', body: JSON.stringify({ assetId: som2.id }) })
    const outraMusica = await admin(`/projects/${PROJ}/transcricoes`)
    p_(
      'trocar o audio manda ouvir a musica nova',
      outraMusica.faixas.find((f) => f.id === VAGO)?.estado === 'PENDENTE',
      outraMusica.faixas.find((f) => f.id === VAGO)?.estado,
    )
    const segunda = await (await transcritor('/proxima')).json()
    if (segunda.audio !== som2.url) {
      if (segunda.id) await transcritor(`/${segunda.id}/falhou`, { erro: 'devolvida pelo percurso' })
      throw new Error('a fila devolveu outra musica na segunda volta — nada foi escrito')
    }
    await transcritor(`/${segunda.id}/pronta`, { tiradas: TIRADAS, segundos: 3 })

    // ── O QUE ELE ESCREVEU A MAO E DELE ────────────────────────────────
    //
    // A outra metade da mesma regra: mal ele toque na letra, ela passa a ser
    // dele, e nem um audio novo a manda apagar.
    await admin(`/cards/${VAGO}/karaoke`, {
      method: 'PUT',
      body: JSON.stringify({ texto: 'Letra escrita por ele\nNa segunda linha' }),
    })
    const manual = await admin(`/projects/${PROJ}/transcricoes`)
    p_('gravar a letra a mao torna-a dele', manual.faixas.find((f) => f.id === VAGO)?.origem === 'MANUAL')

    const som3 = await enviarSom()
    await admin(`/cards/${VAGO}`, { method: 'PATCH', body: JSON.stringify({ assetId: som3.id }) })
    const depoisDoTerceiro = await admin(`/projects/${PROJ}/transcricoes`)
    const estado = depoisDoTerceiro.faixas.find((f) => f.id === VAGO)
    p_(
      'e um audio novo nao manda apagar a letra dele',
      estado?.estado === 'PRONTA' && estado?.origem === 'MANUAL',
      `${estado?.estado} / ${estado?.origem}`,
    )
  }

  p_('sem erros no painel', erros.length === 0, erros.join(' | '))
} catch (e) {
  falhas.push('excepcao: ' + e.message)
  console.log('  ✗ ' + e.message)
} finally {
  await nav.close()
  if (repor) {
    // O cartao volta a ficar vago: sem letra e sem audio, como estava.
    await admin(`/cards/${repor.cartao}/karaoke`, {
      method: 'PUT',
      body: JSON.stringify({ texto: '', publicada: false }),
    }).catch(() => {})
    await admin(`/cards/${repor.cartao}`, {
      method: 'PATCH',
      body: JSON.stringify({ assetId: null, titulo: repor.titulo }),
    }).catch(() => {})
    const conferir = await admin(`/cards/${repor.cartao}/karaoke`).catch(() => null)
    console.log(
      `\n  (cartao ${repor.cartao} reposto: audio ${conferir?.faixa?.audio ? 'AINDA LA' : 'fora'}, ` +
        `letra ${conferir?.letra?.texto ? 'AINDA LA' : 'fora'})`,
    )
  }
}

console.log(falhas.length ? `\nFALHOU: ${falhas.length}\n  - ${falhas.join('\n  - ')}` : '\nTUDO CERTO')
process.exit(falhas.length ? 1 : 0)
