/**
 * A lista de verificação que o cliente escreveu, corrida de fio a pavio.
 *
 *   PV_ADMIN_EMAIL=... PV_ADMIN_SENHA=... node deploy/conferir-modulos.mjs
 *
 * ── PORQUE É QUE ISTO EXISTE ──────────────────────────────────────────
 *
 * Em 24/09 ele escreveu: "Se qualquer função que já funcionava antes deixar de
 * funcionar, não publique a alteração." E deu a lista, por esta ordem:
 *
 *   Dias → Dia 1 → quatro conteúdos → contador → thumbnails → QR Code →
 *   voltar → Cartões personalizados → categorias → abrir modelo → arte →
 *   medidas → foto → nome → preço/desconto.
 *
 * A queixa por trás dela é justa: corrigir uma área e partir outra. O que
 * impede isso não é a intenção de ter cuidado — é uma lista que corre sozinha
 * e que falha em voz alta.
 *
 * SÓ LÊ. Não cria, não altera, não apaga nada. Pode correr contra produção a
 * qualquer momento, inclusive com o cliente a trabalhar do outro lado.
 *
 * Sai com código 1 se alguma coisa falhar, para poder travar uma publicação.
 */
const API = process.env.PV_API ?? 'https://santtify.com/api'
const SITE = API.replace(/\/api$/, '')
const ALFABETO = 'jesus-alfabeto-saudavel'
const CARTOES = 'minha-identidade-e-poder-em-jesus'

let token = null
async function ch(caminho, init = {}) {
  const r = await fetch(API + caminho, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...init.headers,
    },
  })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(b.message ?? b).slice(0, 160)}`)
  return b
}

let falhas = 0
function ok(rotulo, condicao, detalhe = '') {
  if (!condicao) falhas++
  console.log(`  ${condicao ? '✓' : '✗'} ${rotulo.padEnd(54)} ${detalhe}`)
}

const projeto = await ch(`/projects/${ALFABETO}`)
token = (
  await ch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.PV_ADMIN_EMAIL,
      password: process.env.PV_ADMIN_SENHA,
      projectId: projeto.id,
    }),
  })
).accessToken

// ── MÓDULO A — Dias, letras, conteúdo, áudio, QR ─────────────────────
console.log('\n── MÓDULO A — conteúdo, áudio e QR ──────────────────────')

const projetos = await ch('/admin/projetos-do-painel')
ok('o painel lista os projetos', projetos.length >= 2, projetos.map((p) => p.nome).join(' · '))
ok('o Jesus Alfabeto Saudável está no painel', projetos.some((p) => p.slug === ALFABETO))

const alf = await ch(`/admin/projects/${ALFABETO}/alfabeto`)
ok('Alfabeto: 26 casas', alf.vagoes.length === 26)
const letraA = alf.vagoes.find((v) => v.casa === 'A')
ok('Letra A: contador diz quatro preenchidos', letraA.prontos === 4, `prontos=${letraA.prontos}`)
/* Só os cartões de CONTEÚDO. O de IMPRESSAO tem arte e não tem som, por
   desenho: é uma folha para imprimir, não uma faixa para ouvir. */
ok(
  'Letra A: foto e som em todos os cartões de conteúdo',
  letraA.cartoes
    .filter((c) => c.estado === 'PUBLICADO' && c.papel === 'CARTAO')
    .every((c) => c.imagem && c.audio),
)
ok('Letra A: o cartão de impressão tem arte',
   letraA.cartoes.some((c) => c.papel === 'IMPRESSAO' && c.imagem))

const dias = await ch(`/admin/projects/${CARTOES}/alfabeto`)
ok('Dias: 7 casas', dias.vagoes.length === 7, `unidade=${dias.project?.unidade}`)
const dia1 = dias.vagoes.find((v) => v.casa === '1')
ok('Dia 1: publicado', dia1.publicado)
ok('Dia 1: o cartão tem foto e som', dia1.cartoes.some((c) => c.imagem && c.audio))

const pub1 = await ch(`/projects/${CARTOES}/contents/dia-1`)
ok('Dia 1 público: tem capa', Boolean(pub1.content.coverUrl))
ok(
  'Dia 1 público: faixa com som e arte própria',
  (pub1.content.blocks ?? []).some((b) => b.type === 'AUDIO' && b.asset?.url && b.arte),
)
/* A fronteira entre os módulos, medida: nada que venha da arte impressa dos
   cartões pode estar dentro de um dia. */
ok(
  'Dia 1 público: sem material do módulo dos cartões',
  !(pub1.content.blocks ?? []).some((b) => b.label === 'Arte do cartão'),
)
ok('Dia 1: QR existe', Boolean(pub1.content.qrUrl), pub1.content.qrUrl ?? '')

const destino = await fetch(SITE + new URL(pub1.content.qrUrl).pathname, { redirect: 'manual' })
ok('o QR impresso leva ao Dia 1', destino.headers.get('location') === `/${CARTOES}/dia-1`,
   destino.headers.get('location') ?? '')

const vizinhas = await ch(`/projects/${ALFABETO}/contents/i`)
ok('anterior e seguinte trazem a arte da casa',
   Boolean(vizinhas.navegacao.anterior?.coverUrl && vizinhas.navegacao.proximo?.coverUrl))

// ── MÓDULO B — Cartões personalizados ────────────────────────────────
console.log('\n── MÓDULO B — cartões personalizados ────────────────────')

const cats = await ch(`/admin/projects/${CARTOES}/categorias-de-cartoes`)
ok('categorias: Crianças e Adultos', cats.length === 2,
   cats.map((c) => `${c.nome}(${c.modelos})`).join(' '))

const modelos = await ch(`/admin/projects/${CARTOES}/modelos-de-cartao`)
ok('sete modelos', modelos.length === 7)
ok('os sete com arte carregada', modelos.filter((m) => m.arteUrl).length === 7)
ok('nenhum com aviso de arte em falta', modelos.every((m) => !m.aviso))

/* As medidas tiradas da arte LIMPA em 25/09, uma por dia: cada arte tem o céu
   e a caixa branca num sítio ligeiramente diferente. Se estes números mudarem
   sem ninguém ter ido ao painel, alguma coisa lhes passou por cima. */
const MEDIDAS = {
  1: [68.7, 64.5, 73.3, 92, 72.8, 160.6, 68, 10.7],
  2: [66.5, 65.9, 76.9, 91.7, 72.3, 161.6, 67.7, 10.7],
  3: [66.6, 63.5, 74.8, 91.2, 71.6, 158.6, 68, 10.7],
  4: [66.5, 67.8, 75.2, 89.6, 71.4, 161.4, 68.2, 10.7],
  5: [68.7, 65.2, 73.3, 89.2, 71.8, 158.4, 68.2, 10.7],
  6: [68.7, 65.8, 73.3, 90.6, 72.1, 160.4, 68.2, 10.7],
  7: [64.9, 66.8, 81.1, 95, 72.3, 165.8, 68.2, 10.7],
}
const geometria = (m) => [m.fotoX, m.fotoY, m.fotoLargura, m.fotoAltura, m.nomeX, m.nomeY, m.nomeLargura, m.nomeAltura]
const fora = modelos.filter((m) => geometria(m).join() !== (MEDIDAS[m.dia] ?? []).join() || m.fotoFormato !== 'RETANGULO')
ok('moldura e caixa do nome intactas nos sete',
   fora.length === 0,
   fora.length ? fora.map((m) => `Dia ${m.dia}: ${geometria(m).join(',')}`).join(' · ') : 'medidas da arte limpa')

/* A foto não pode invadir a caixa do nome — era o defeito da arte antiga. */
const invadem = modelos.filter((m) => m.fotoY + m.fotoAltura > m.nomeY)
ok('nenhuma foto por cima do nome',
   invadem.length === 0,
   invadem.map((m) => `Dia ${m.dia}`).join(' ') || 'folga em todos')

const preco = await ch(`/admin/projects/${CARTOES}/preco-de-cartoes`)
ok('preço e desconto',
   preco.precoUnitarioCent === 4900 && preco.descontoPercentagem === 30,
   `R$ ${(preco.precoUnitarioCent / 100).toFixed(2)} · −${preco.descontoPercentagem}% a partir de ${preco.descontoAPartirDe}`)

// "Coloca preço 79 por 49" — 25/09. O riscado tem de existir E de ficar ACIMA
// do que se cobra; abaixo, o servidor engole-o, e um riscado que não aparece é
// tão errado como um que mente.
ok('preço riscado acima do que se cobra',
   preco.precoDeTabelaCent === 7900 && preco.precoDeTabelaCent > preco.precoUnitarioCent,
   preco.precoDeTabelaCent ? `de R$ ${(preco.precoDeTabelaCent / 100).toFixed(2)}` : 'sem riscado')

const precoPublico = (await ch(`/projects/${CARTOES}/cartoes/categorias`))[0]?.preco
ok('o riscado chega ao ecrã de quem compra',
   precoPublico?.precoDeTabelaCent === 7900 && precoPublico?.precoUnitarioCent === 4900,
   `de R$ ${((precoPublico?.precoDeTabelaCent ?? 0) / 100).toFixed(2)} por R$ ${((precoPublico?.precoUnitarioCent ?? 0) / 100).toFixed(2)}`)

const publicos = await ch(`/projects/${CARTOES}/cartoes/modelos?categoria=criancas`)
ok('o editor público vê os sete com arte',
   publicos.length === 7 && publicos.every((m) => m.arteUrl))

// A porta que ele desenhou em 24/09: o cartaz por baixo dos dias e o caminho
// que ele abre. Duas partes, e são duas verificações de propósito — o cartaz
// pode estar cá e o link levar a lado nenhum.
const oferecidas = await ch(`/projects/${CARTOES}/cartoes/categorias`)
const criancas = oferecidas.find((c) => c.slug === 'criancas')
ok('a oferta tem cartaz', Boolean(criancas?.capaUrl), criancas?.capaUrl ?? 'sem arte')

const pagina = await (await fetch(`${SITE}/${CARTOES}`)).text()
ok('o cartaz está na página dos dias', pagina.includes('oferta-cartaz'))

// A porta abre ou não conforme a chave dele, e a verificação segue a chave em
// vez de exigir uma das duas: as duas são estados legítimos. O que NUNCA pode
// acontecer é desencontrarem-se — dizer "em breve" e abrir na mesma, ou estar
// aberta e não ter para onde ir.
const abre = pagina.includes(`/${CARTOES}/cartoes?categoria=criancas`)
ok(criancas?.ofertaEmBreve ?? criancas?.emBreve ? 'em breve: o cartaz não abre o editor'
                                                : 'o cartaz leva ao editor',
   (criancas?.emBreve ?? false) ? !abre : abre)

ok('o áudio da oferta está na página',
   !criancas?.audioUrl || pagina.includes('voz-oferta'))

ok('o Mercado Pago aparece ao pé do cartaz', /Mercado(&nbsp;|\s|\u00a0)?Pago/.test(pagina))

// Ver, curtir, comentar, partilhar — os quatro que ele pediu em 25/09.
const socialDaOferta = await ch(`/projects/${CARTOES}/cartoes/criancas/social`)
ok('a oferta tem os quatro números',
   ['visualizacoes', 'curtidas', 'comentarios', 'compartilhamentos']
     .every((k) => typeof socialDaOferta[k] === 'number'),
   `vistas ${socialDaOferta.visualizacoes} · curtidas ${socialDaOferta.curtidas} · comentários ${socialDaOferta.comentarios} · partilhas ${socialDaOferta.compartilhamentos}`)

// A barra tem de estar DESENHADA, e não só respondida: já aconteceu três vezes
// neste projeto números pintados à mão que não chamavam ninguém.
ok('os quatro botões estão debaixo do cartaz',
   pagina.includes('indicadores-publicacao') && pagina.includes('vista-da-oferta'))

console.log(
  falhas === 0
    ? '\n  Tudo o que funcionava continua a funcionar.\n'
    : `\n  ${falhas} falha(s) — NÃO PUBLICAR.\n`,
)
process.exit(falhas ? 1 : 0)
