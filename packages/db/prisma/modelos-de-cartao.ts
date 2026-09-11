/**
 * Semeia o projeto dos cartões personalizados e os dois destaques do carrossel.
 *
 *   npx tsx packages/db/prisma/modelos-de-cartao.ts
 *
 * OS SETE MODELOS SÃO DADOS, e é esse o ponto. Este ficheiro escreve sete
 * linhas numa tabela; um oitavo modelo, no dia em que o cliente quiser, entra
 * pelo painel sem passar por aqui e sem passar por mim.
 *
 * AS MEDIDAS SÃO UM PONTO DE PARTIDA, NÃO UMA VERDADE. Foram tiradas a olho
 * das artes que ele mandou, e estão aqui para o editor abrir a funcionar em vez
 * de abrir vazio. As definitivas saem da régua do designer — é o número que
 * ainda falta pedir-lhe — e corrigem-se no painel, modelo a modelo, sem tocar
 * em código.
 */
import { PrismaClient, ProjectStatus, DestaqueDoCarrossel, FormatoDaMoldura } from '@prisma/client'

const prisma = new PrismaClient()

/** Os sete, como aparecem no mockup do editor. */
const MODELOS = [
  { dia: 1, nome: 'Identidade em Deus' },
  { dia: 2, nome: 'Espírito Santo' },
  { dia: 3, nome: 'Armadura de Deus' },
  { dia: 4, nome: 'Há Poder no Nome de Jesus' },
  { dia: 5, nome: 'Jesus Está Formando o Meu Caráter' },
  { dia: 6, nome: 'O Fruto do Espírito em Mim' },
  { dia: 7, nome: 'Jesus Me Guia Todos os Dias' },
]

/**
 * A geometria partilhada pelos sete, em milímetros sobre A4.
 *
 * O cliente garantiu que os sete têm exactamente o mesmo espaço para a
 * fotografia e para o nome, e é essa garantia que faz um enquadramento servir
 * os sete. Por isso está escrita uma vez.
 */
const GEOMETRIA = {
  fotoX: 68,
  fotoY: 92,
  fotoLargura: 74,
  fotoAltura: 92,
  fotoFormato: FormatoDaMoldura.ELIPSE,
  nomeX: 55,
  nomeY: 190,
  nomeLargura: 100,
  nomeAltura: 16,
  nomeCorHex: '#12356B',
  nomeCorpoMinimo: 8,
  nomeCorpoMaximo: 20,
  nomeMaiusculas: true,
}

async function main() {
  const projeto = await prisma.project.upsert({
    where: { slug: 'minha-identidade-e-poder-em-jesus' },
    update: {},
    create: {
      slug: 'minha-identidade-e-poder-em-jesus',
      name: 'Minha Identidade e Poder em Jesus',
      tagline: 'Sete cartões para a criança levar consigo',
      status: ProjectStatus.ACTIVE,
      ordemNoCarrossel: 2,
    },
  })

  /**
   * As duas categorias que o cliente pediu em 11/09.
   *
   * Os Adultos nascem ACTIVOS e sem modelo nenhum, e isso é seguro: o editor só
   * mostra as categorias que têm pelo menos um cartão activo. No dia em que o
   * designer entregar as artes dos adultos, ele cadastra-as pelo painel e a
   * categoria aparece sozinha.
   */
  const criancas = await prisma.categoriaDeCartoes.upsert({
    where: { projectId_slug: { projectId: projeto.id, slug: 'criancas' } },
    update: {},
    create: {
      projectId: projeto.id,
      slug: 'criancas',
      nome: 'Crianças',
      rotuloSingular: 'criança',
      rotuloPlural: 'crianças',
      ordem: 1,
    },
  })
  await prisma.categoriaDeCartoes.upsert({
    where: { projectId_slug: { projectId: projeto.id, slug: 'adultos' } },
    update: {},
    create: {
      projectId: projeto.id,
      slug: 'adultos',
      nome: 'Adultos',
      rotuloSingular: 'pessoa',
      rotuloPlural: 'pessoas',
      ordem: 2,
    },
  })

  for (const modelo of MODELOS) {
    await prisma.modeloDeCartao.upsert({
      where: {
        categoriaId_slug: { categoriaId: criancas.id, slug: `dia-${modelo.dia}` },
      },
      update: { nome: modelo.nome, ordem: modelo.dia },
      create: {
        projectId: projeto.id,
        categoriaId: criancas.id,
        slug: `dia-${modelo.dia}`,
        dia: modelo.dia,
        nome: modelo.nome,
        ordem: modelo.dia,
        ...GEOMETRIA,
      },
    })
  }

  await prisma.precoDeCartoes.upsert({
    where: { projectId: projeto.id },
    update: {},
    // R$ 30,00 por conjunto e 30% acima de um conjunto — a regra que ele
    // escreveu no ponto 5. Fica aqui só como valor inicial: quem manda nela é
    // o painel.
    create: {
      projectId: projeto.id,
      precoUnitarioCent: 3000,
      moeda: 'BRL',
      descontoPercentagem: 30,
      descontoAPartirDe: 2,
    },
  })

  const atributos = await prisma.project.upsert({
    where: { slug: '31-atributos-de-deus' },
    update: {},
    create: {
      slug: '31-atributos-de-deus',
      name: '31 Atributos de Deus',
      tagline: 'Conheça e viva os atributos do nosso Deus',
      status: ProjectStatus.ACTIVE,
      ordemNoCarrossel: 3,
    },
  })

  // Os dois destaques. Um de cada lado, e a base não deixa haver dois no mesmo.
  const alfabeto = await prisma.project.findUnique({
    where: { slug: 'jesus-alfabeto-saudavel' },
  })
  /**
   * Os destaques só se preenchem se estiverem VAZIOS.
   *
   * Este seed pode voltar a correr — em produção, depois de o cliente já ter
   * escolhido os destaques dele no painel. Pôr os valores iniciais por cima
   * desfaria essa escolha sem aviso. E pô-los quando outro projeto ocupa a casa
   * rebentava contra o `@unique` do campo.
   */
  const ocupado = async (lado: DestaqueDoCarrossel) =>
    Boolean(await prisma.project.findFirst({ where: { destaque: lado } }))

  if (alfabeto) {
    await prisma.project.update({
      where: { id: alfabeto.id },
      data: {
        ...((await ocupado(DestaqueDoCarrossel.ESQUERDA))
          ? {}
          : { destaque: DestaqueDoCarrossel.ESQUERDA, ordemNoCarrossel: 0 }),
        tagline: alfabeto.tagline ?? 'Aprenda com fé, saúde, música e diversão',
      },
    })
  }
  if (!(await ocupado(DestaqueDoCarrossel.DIREITA))) {
    await prisma.project.update({
      where: { id: projeto.id },
      data: { destaque: DestaqueDoCarrossel.DIREITA, ordemNoCarrossel: 1 },
    })
  }

  console.log('✓ Cartões personalizados semeados:', {
    projeto: projeto.slug,
    modelos: MODELOS.length,
    destaqueEsquerda: alfabeto?.slug ?? '(nenhum)',
    destaqueDireita: projeto.slug,
    outroProjeto: atributos.slug,
  })
  console.log(
    '\n  As artes ainda não estão carregadas. Sem elas o PDF não sai — é o que\n' +
      '  falta do designer, e o painel avisa modelo a modelo.',
  )
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
