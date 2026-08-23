import { PrismaClient, BlockType, CardPapel, CardEstado, ContentStatus } from '@prisma/client'

/**
 * Monta a composição: 26 vagões, cada um com quatro cartões inseparáveis.
 *
 * É a estrutura que o cliente descreveu em 23/08, e a comparação é dele — a
 * Letra A é o primeiro vagão, a B o segundo, e assim até à Z, sem interrupção.
 * Cada vagão nasce com quatro cartões: explicação, música, repetição do
 * versículo e oração. Os quadrados existem mesmo vazios; é isso que impede um
 * cartão de se perder ou de aparecer na letra errada.
 *
 * O QUE ESTE SCRIPT NUNCA FAZ: apagar. Cria letras que faltam, cria quadrados
 * que faltam, e dá casa aos áudios que já existem. O que não couber nas quatro
 * casas fica como cópia, a seguir às originais, e continua a tocar.
 *
 * Idempotente: correr outra vez não muda nada do que já estiver certo.
 */
const prisma = new PrismaClient()

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** As quatro casas, na ordem que ele fixou. */
const CASAS = [
  { slot: 1, nome: 'Explicação' },
  { slot: 2, nome: 'Música' },
  { slot: 3, nome: 'Repetição do versículo' },
  { slot: 4, nome: 'Oração' },
]

/** Sem acentos e em minúsculas: os rótulos foram escritos à mão ao longo de dias. */
function simples(v: string | null | undefined) {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * A casa a que um áudio já existente pertence, pelo rótulo que tem.
 *
 * "Memorização" e "Repetição do versículo" são a mesma coisa com dois nomes: o
 * primeiro é como ele lhe chamou em 18/08, o segundo é como lhe chama agora.
 */
function casaDoRotulo(label: string | null): number | null {
  const s = simples(label)
  if (!s) return null
  if (s.includes('explica')) return 1
  if (s.includes('music') || s.includes('músic')) return 2
  if (s.includes('memoriz') || s.includes('versicul') || s.includes('repeti')) return 3
  if (s.includes('orac')) return 4
  return null
}

/** Um cartão está inteiro quando tem imagem, som, título e descrição. */
function estadoDe(b: {
  assetId: string | null
  imageAssetId: string | null
  titulo: string | null
  text: string | null
}): CardEstado {
  const inteiro =
    Boolean(b.assetId) && Boolean(b.imageAssetId) && Boolean(b.titulo?.trim()) && Boolean(b.text?.trim())
  return inteiro ? CardEstado.PUBLICADO : CardEstado.RASCUNHO
}

async function main() {
  const projeto = await prisma.project.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!projeto) throw new Error('Nenhum projeto na base de dados.')

  let letrasCriadas = 0
  let quadradosCriados = 0
  let casasAtribuidas = 0

  for (const [i, letra] of ALFABETO.entries()) {
    let conteudo = await prisma.content.findFirst({
      where: { projectId: projeto.id, letra },
      include: { blocks: { orderBy: { position: 'asc' } } },
    })

    if (!conteudo) {
      // A letra B não existia — a lista saltava de A para C. Nasce como
      // rascunho: aparece trancada na grade até ele a preencher.
      const criado = await prisma.content.create({
        data: {
          projectId: projeto.id,
          letra,
          slug: `letra-${letra.toLowerCase()}`,
          title: `Letra ${letra}`,
          status: ContentStatus.DRAFT,
          position: 100 + i,
        },
      })
      conteudo = { ...criado, blocks: [] }
      letrasCriadas++
    }

    const audios = conteudo.blocks.filter((b) => b.type === BlockType.AUDIO)
    const porCasa = new Map<number, string>()

    // Primeiro os que já têm casa marcada — respeita-se o que já foi decidido.
    for (const b of audios) {
      if (b.slot && !porCasa.has(b.slot)) porCasa.set(b.slot, b.id)
    }
    // Depois os que se reconhecem pelo rótulo.
    for (const b of audios) {
      if (b.slot) continue
      const casa = casaDoRotulo(b.label)
      if (casa && !porCasa.has(casa)) {
        porCasa.set(casa, b.id)
        await prisma.contentBlock.update({
          where: { id: b.id },
          data: { slot: casa, label: CASAS[casa - 1].nome },
        })
        casasAtribuidas++
      }
    }

    // As casas que ficaram vazias nascem como quadrados em branco.
    for (const casa of CASAS) {
      if (porCasa.has(casa.slot)) continue
      await prisma.contentBlock.create({
        data: {
          contentId: conteudo.id,
          type: BlockType.AUDIO,
          papel: CardPapel.CARTAO,
          estado: CardEstado.RASCUNHO,
          slot: casa.slot,
          label: casa.nome,
          position: casa.slot,
        },
      })
      quadradosCriados++
    }

    // As casas mandam na ordem; o que não tem casa vai a seguir, pela ordem
    // que já tinha. Sem isto, um quadrado criado agora aparecia antes de um
    // áudio que ele pôs há três dias.
    const todos = await prisma.contentBlock.findMany({
      where: { contentId: conteudo.id, type: BlockType.AUDIO },
      orderBy: [{ slot: 'asc' }, { position: 'asc' }],
      select: { id: true, slot: true, assetId: true, imageAssetId: true, titulo: true, text: true },
    })
    for (const [j, b] of todos.entries()) {
      await prisma.contentBlock.update({
        where: { id: b.id },
        data: { position: j + 1, estado: estadoDe(b) },
      })
    }
  }

  console.log(`  letras criadas:        ${letrasCriadas}`)
  console.log(`  quadrados criados:     ${quadradosCriados}`)
  console.log(`  casas atribuídas:      ${casasAtribuidas}`)

  const resumo = await prisma.content.findMany({
    where: { projectId: projeto.id, letra: { not: null } },
    orderBy: { letra: 'asc' },
    select: {
      letra: true,
      _count: { select: { blocks: true } },
      blocks: { where: { estado: CardEstado.PUBLICADO }, select: { id: true } },
    },
  })
  const prontas = resumo.filter((r) => r.blocks.length > 0)
  console.log(`  vagões:                ${resumo.length} (${prontas.length} com cartão pronto)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
