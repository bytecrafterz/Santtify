/**
 * Os QR Codes dos cartões de cada categoria, para o designer colocar na arte.
 *
 *   npx tsx packages/db/prisma/qr-dos-cartoes.ts [pasta-de-saida]
 *
 * O QUE ESTE FICHEIRO RESOLVE, e é um problema com data marcada:
 *
 * O endereço fica CODIFICADO dentro de cada QR. Uma vez impresso, não se muda —
 * está escrito no `.env.example` desde o início e continua verdade. Se eu
 * gerasse os QR agora com o endereço de desenvolvimento, o designer imprimiria
 * `localhost` em milhares de cartões.
 *
 * Mas o designer precisa dos QR HOJE, e o site ainda não foi publicado. A saída
 * é fixar os códigos aqui: os sete códigos abaixo são gerados uma vez, ficam
 * escritos, e este script cria exactamente esses códigos em qualquer base de
 * dados onde correr. O designer recebe QR com o endereço de produção, e no dia
 * em que o site subir os códigos já lá estão à espera.
 *
 * POR ISSO NÃO SE MUDAM os códigos desta lista depois de as artes irem para a
 * gráfica. Acrescentar um oitavo dia é acrescentar uma linha; reescrever uma
 * das sete é invalidar o que já foi impresso.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { PrismaClient, ContentStatus, ShortLinkKind } from '@prisma/client'
import * as QRCode from 'qrcode'

const prisma = new PrismaClient()

const PROJETO = 'minha-identidade-e-poder-em-jesus'

/**
 * Os dias de cada categoria, com o código curto de cada um FIXO.
 *
 * Os códigos usam o mesmo alfabeto do resto da plataforma, sem caracteres que
 * se confundem à vista (nada de O/0 nem l/1), porque alguém vai acabar por os
 * ler em voz alta ao telefone.
 */
const CONJUNTOS = [
  {
    /**
     * AS CRIANÇAS: estes sete códigos JÁ FORAM ENVIADOS AO DESIGNER em 10/09.
     * Os slugs também ficam como estavam (`dia-1`...). Mudar qualquer um destes
     * valores é invalidar o que ele já pôs nas artes.
     */
    categoria: 'criancas',
    dias: [
      { dia: 1, slug: 'dia-1', titulo: 'Identidade em Deus', codigo: 'Kd7mQx2' },
      { dia: 2, slug: 'dia-2', titulo: 'Espírito Santo', codigo: 'Rn4pTv8' },
      { dia: 3, slug: 'dia-3', titulo: 'Armadura de Deus', codigo: 'Hs9wYb3' },
      { dia: 4, slug: 'dia-4', titulo: 'Há Poder no Nome de Jesus', codigo: 'Jf6zLm5' },
      { dia: 5, slug: 'dia-5', titulo: 'Jesus Está Formando o Meu Caráter', codigo: 'Vc3gNp7' },
      { dia: 6, slug: 'dia-6', titulo: 'O Fruto do Espírito em Mim', codigo: 'Xt8kDr4' },
      { dia: 7, slug: 'dia-7', titulo: 'Jesus Me Guia Todos os Dias', codigo: 'Bq5jWh9' },
    ],
  },
  {
    /**
     * OS ADULTOS, pedidos em 11/09. Os títulos são provisórios — o designer
     * ainda está a fazer as artes — e mudam-se no painel sem tocar no código,
     * porque o QR só leva o CÓDIGO, não o título. Os códigos, esses, ficam.
     */
    categoria: 'adultos',
    dias: [
      { dia: 1, slug: 'adultos-dia-1', titulo: 'Adultos — Dia 1', codigo: 's9U7957' },
      { dia: 2, slug: 'adultos-dia-2', titulo: 'Adultos — Dia 2', codigo: 'b7hZzMT' },
      { dia: 3, slug: 'adultos-dia-3', titulo: 'Adultos — Dia 3', codigo: 'DzaZRYH' },
      { dia: 4, slug: 'adultos-dia-4', titulo: 'Adultos — Dia 4', codigo: 'dXY5KEe' },
      { dia: 5, slug: 'adultos-dia-5', titulo: 'Adultos — Dia 5', codigo: 'zm2ToMn' },
      { dia: 6, slug: 'adultos-dia-6', titulo: 'Adultos — Dia 6', codigo: 'CBNom3S' },
      { dia: 7, slug: 'adultos-dia-7', titulo: 'Adultos — Dia 7', codigo: 'GmQuYLm' },
    ],
  },
]

async function main() {
  const pasta = resolve(process.argv[2] ?? 'qr-dos-cartoes')
  const base = (process.env.PUBLIC_SHORTLINK_BASE ?? '').replace(/\/$/, '')

  if (!base) {
    console.error('Falta PUBLIC_SHORTLINK_BASE no ambiente.')
    process.exit(1)
  }
  if (base.includes('localhost') || base.includes('127.0.0.1')) {
    console.error(
      '\n  RECUSADO: PUBLIC_SHORTLINK_BASE aponta para localhost.\n\n' +
        '  O endereço fica gravado dentro do QR e não se muda depois de impresso.\n' +
        '  Corra com o endereço de produção, por exemplo:\n\n' +
        '    PUBLIC_SHORTLINK_BASE=https://santtify.com/r \\\n' +
        '      npx tsx packages/db/prisma/qr-dos-cartoes.ts\n',
    )
    process.exit(1)
  }

  const projeto = await prisma.project.findUnique({ where: { slug: PROJETO } })
  if (!projeto) {
    console.error(`Projeto "${PROJETO}" não existe nesta base de dados.`)
    process.exit(1)
  }

  for (const conjunto of CONJUNTOS) {
    const pastaDoConjunto = join(pasta, conjunto.categoria)
    await mkdir(pastaDoConjunto, { recursive: true })
    const linhas: string[] = []

    for (const d of conjunto.dias) {
      const conteudo = await prisma.content.upsert({
        where: { projectId_slug: { projectId: projeto.id, slug: d.slug } },
        update: { title: d.titulo },
        create: {
          projectId: projeto.id,
          slug: d.slug,
          title: d.titulo,
          position: d.dia,
          status: ContentStatus.DRAFT,
        },
      })

      /**
       * Um código que já pertença a OUTRO conteúdo não se reaproveita.
       *
       * O `upsert` por código mudaria o destino de um QR que já existe — e em
       * produção há 26 letras com QR impressos. A probabilidade de um sorteio de
       * 7 caracteres coincidir é ínfima, mas o custo de coincidir é um cartão do
       * alfabeto a abrir outra coisa, para sempre.
       */
      const jaExiste = await prisma.shortLink.findUnique({ where: { code: d.codigo } })
      if (jaExiste && jaExiste.contentId !== conteudo.id) {
        throw new Error(
          `O código ${d.codigo} já pertence a outro conteúdo. Não foi alterado — ` +
            `sorteie outro código para ${conjunto.categoria}/${d.slug}.`,
        )
      }

      await prisma.shortLink.upsert({
        where: { code: d.codigo },
        update: { contentId: conteudo.id, projectId: projeto.id },
        create: {
          code: d.codigo,
          projectId: projeto.id,
          contentId: conteudo.id,
          kind: ShortLinkKind.CONTENT_QR,
          targetUrl: `/${PROJETO}/${d.slug}`,
        },
      })

      const url = `${base}/${d.codigo}`

      /**
       * Correcção de erro alta e margem larga, porque isto vai para papel.
       *
       * Um QR num ecrã lê-se sempre; um QR impresso num cartão que uma criança
       * dobra, molha e leva na mochila, nem sempre. O nível H recupera a leitura
       * com até 30% do código danificado, e custa apenas um desenho um pouco mais
       * denso. A margem de 4 módulos é a que a norma exige e a que os leitores
       * esperam — sem ela, um QR colado à arte deixa de ser lido.
       */
      const svg = await QRCode.toString(url, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 4,
        color: { dark: '#000000', light: '#FFFFFF' },
      })

      await writeFile(join(pastaDoConjunto, `dia-${d.dia}.svg`), svg, 'utf8')
      linhas.push(`Dia ${d.dia}  ${d.titulo}\n         ${url}`)
      console.log(`  ✓ ${conjunto.categoria}/dia-${d.dia}.svg  →  ${url}`)
    }

    const leiame =
      `QR Codes dos cartões — ${conjunto.categoria === 'adultos' ? 'Adultos' : 'Crianças'}\n` +
      `${'='.repeat(56)}\n\n` +
      `Um ficheiro por dia, em SVG (vectorial). Para impressão, use sempre o SVG:\n` +
      `um QR em PNG ou JPEG perde definição ao ser ampliado e falha na leitura.\n\n` +
      `TAMANHO MÍNIMO NA ARTE: 20 x 20 mm. Abaixo disso a câmara de um telemóvel\n` +
      `comum tem dificuldade a partir de meio metro de distância.\n\n` +
      `NÃO RECORTE A MARGEM BRANCA à volta do código. Ela faz parte do desenho e\n` +
      `sem ela muitos leitores não o encontram.\n\n` +
      `NÃO MUDE AS CORES nem coloque o código sobre uma fotografia. Preto sobre\n` +
      `branco é o que se lê em qualquer condição de luz.\n\n` +
      `Cada dia tem o seu código próprio e não são intercambiáveis:\n\n` +
      linhas.map((l) => `  ${l}`).join('\n\n') +
      `\n\nEstes endereços só respondem depois de a plataforma estar publicada.\n` +
      `Os códigos já estão reservados, por isso as artes podem ir para a gráfica\n` +
      `antes disso.\n`

    await writeFile(join(pastaDoConjunto, 'LEIA-ME.txt'), leiame, 'utf8')
  }

  console.log(`\n  QR Codes em ${pasta} (uma pasta por categoria)`)
  console.log(`  Endereço base: ${base}`)
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
