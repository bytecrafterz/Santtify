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

/* As medidas medidas na arte em 23/09. Se estes números mudarem sem ninguém
   ter ido ao painel, alguma coisa lhes passou por cima. */
const m1 = modelos.find((m) => m.dia === 1)
ok('moldura da foto intacta',
   m1.fotoX === 66 && m1.fotoY === 62 && m1.fotoLargura === 78 && m1.fotoAltura === 96 &&
   m1.fotoFormato === 'RETANGULO',
   `${m1.fotoX},${m1.fotoY} ${m1.fotoLargura}×${m1.fotoAltura} ${m1.fotoFormato}`)
ok('caixa do nome intacta',
   m1.nomeX === 60 && m1.nomeY === 151 && m1.nomeLargura === 90 && m1.nomeAltura === 20,
   `${m1.nomeX},${m1.nomeY} ${m1.nomeLargura}×${m1.nomeAltura}`)

const preco = await ch(`/admin/projects/${CARTOES}/preco-de-cartoes`)
ok('preço e desconto',
   preco.precoUnitarioCent === 3000 && preco.descontoPercentagem === 30,
   `R$ ${(preco.precoUnitarioCent / 100).toFixed(2)} · −${preco.descontoPercentagem}% a partir de ${preco.descontoAPartirDe}`)

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

console.log(
  falhas === 0
    ? '\n  Tudo o que funcionava continua a funcionar.\n'
    : `\n  ${falhas} falha(s) — NÃO PUBLICAR.\n`,
)
process.exit(falhas ? 1 : 0)
