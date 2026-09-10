/**
 * Os QR Codes dos sete cartões, para o designer colocar na arte.
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
 * Os sete dias, com o código curto de cada um FIXO.
 *
 * Os códigos usam o mesmo alfabeto do resto da plataforma, sem caracteres que
 * se confundem à vista (nada de O/0 nem l/1), porque alguém vai acabar por os
 * ler em voz alta ao telefone.
 */
const DIAS = [
  { dia: 1, slug: 'dia-1', titulo: 'Identidade em Deus', codigo: 'Kd7mQx2' },
  { dia: 2, slug: 'dia-2', titulo: 'Espírito Santo', codigo: 'Rn4pTv8' },
  { dia: 3, slug: 'dia-3', titulo: 'Armadura de Deus', codigo: 'Hs9wYb3' },
  { dia: 4, slug: 'dia-4', titulo: 'Há Poder no Nome de Jesus', codigo: 'Jf6zLm5' },
  { dia: 5, slug: 'dia-5', titulo: 'Jesus Está Formando o Meu Caráter', codigo: 'Vc3gNp7' },
  { dia: 6, slug: 'dia-6', titulo: 'O Fruto do Espírito em Mim', codigo: 'Xt8kDr4' },
  { dia: 7, slug: 'dia-7', titulo: 'Jesus Me Guia Todos os Dias', codigo: 'Bq5jWh9' },
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

  await mkdir(pasta, { recursive: true })
  const linhas: string[] = []

  for (const d of DIAS) {
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

    await writeFile(join(pasta, `dia-${d.dia}.svg`), svg, 'utf8')
    linhas.push(`Dia ${d.dia}  ${d.titulo}\n         ${url}`)
    console.log(`  ✓ dia-${d.dia}.svg  →  ${url}`)
  }

  const leiame =
    `QR Codes dos cartões — Minha Identidade e Poder em Jesus\n` +
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

  await writeFile(join(pasta, 'LEIA-ME.txt'), leiame, 'utf8')

  console.log(`\n  ${DIAS.length} QR Codes em ${pasta}`)
  console.log(`  Endereço base: ${base}`)
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
