import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  BlockType,
  CardEstado,
  CardPapel,
  DestaqueDoCarrossel,
  ProjectStatus,
  SequenciaDoProjeto,
} from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { ContagensService } from '../social/contagens.service'
import { ShortLinksService } from '../short-links/short-links.service'

/**
 * O carrossel de projetos que fica debaixo do perfil.
 *
 * O perfil já existe e não se toca — o cliente foi explícito duas vezes. Isto
 * acrescenta-se por baixo e mais nada.
 *
 * A ORDEM É A REGRA INTEIRA, e vale a pena escrevê-la: primeiro o destaque da
 * esquerda, depois o da direita, e a seguir todos os outros por `ordemNoCarrossel`.
 * Quem escolhe os dois destaques é ele, no painel. O projeto que sai de um
 * destaque não desaparece: cai para o meio do carrossel, que foi exactamente o
 * que ele descreveu.
 *
 * Um projeto novo entra sozinho, sem programação nenhuma, porque a lista é uma
 * consulta e não uma lista escrita à mão.
 */
@Injectable()
export class CarrosselService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contagens: ContagensService,
    private readonly shortLinks: ShortLinksService,
  ) {}

  /**
   * O QR Code de um bloco novo.
   *
   * CADA PORTA NOVA POR ONDE NASCE CONTEÚDO TEM DE REPETIR O QUE A PORTA
   * ANTIGA FAZIA. Está escrito assim em `admin-content.service`, e foi por não
   * o cumprir que a Letra B ficou sem QR nenhum. Criar projetos e definir a
   * quantidade de blocos são duas portas novas: sem isto, os blocos nasciam
   * sem QR e o ponto 4 do que ele pediu — um QR por bloco, como no alfabeto —
   * ficava por cumprir sem dar erro a ninguém.
   */
  private async garantirQr(projeto: { id: string; slug: string }, contents: { id: string; slug: string }[]) {
    for (const c of contents) {
      await this.shortLinks.criarQrDeConteudo({
        projectId: projeto.id,
        contentId: c.id,
        projectSlug: projeto.slug,
        contentSlug: c.slug,
      })
    }
  }

  /**
   * A lista do carrossel.
   *
   * `incluirRascunhos` separa dois públicos com a mesma consulta. Quem visita o
   * site vê só o que está publicado — um projeto por acabar não pode aparecer
   * no perfil. Mas o PAINEL tem de ver os rascunhos, senão ele cria um projeto
   * novo, que nasce em rascunho, e ele não o vê em lado nenhum: parece que o
   * botão não funcionou e a única saída seria voltar a criá-lo.
   */
  async listar(incluirRascunhos = false) {
    const projetos = await this.prisma.project.findMany({
      where: incluirRascunhos
        ? { status: { in: [ProjectStatus.ACTIVE, ProjectStatus.DRAFT] } }
        : { status: ProjectStatus.ACTIVE },
      orderBy: [{ ordemNoCarrossel: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        coverUrl: true,
        destaque: true,
        ordemNoCarrossel: true,
        status: true,
        sequencia: true,
        blocos: true,
      },
    })

    const contagens = await this.contagens.deProjectos(projetos.map((p) => p.id))

    /*
      AS MEDIDAS DA IMAGEM VIAJAM COM ELA.

      Desde 19/09 a imagem de cada projeto aparece inteira, na proporção dela: a
      do Jesus Alfabeto é uma faixa 3:1, a do Minha Identidade é 16:9, e são
      artes com texto até à borda que não se podem cortar. Sem as medidas, o
      navegador não sabe que altura guardar e a lista salta quando cada imagem
      chega. O upload já as guarda no `MediaAsset`; lê-se de lá pelo endereço.
    */
    const enderecos = projetos.map((p) => p.coverUrl).filter((u): u is string => Boolean(u))
    const medidas = new Map(
      (enderecos.length
        ? await this.prisma.mediaAsset.findMany({
            where: { url: { in: enderecos } },
            select: { url: true, width: true, height: true },
          })
        : []
      ).map((m) => [m.url, m]),
    )

    const posicao = (d: DestaqueDoCarrossel | null) =>
      d === DestaqueDoCarrossel.ESQUERDA ? 0 : d === DestaqueDoCarrossel.DIREITA ? 1 : 2

    return projetos
      .slice()
      .sort((a, b) => posicao(a.destaque) - posicao(b.destaque))
      .map((p) => ({
        slug: p.slug,
        nome: p.name,
        tagline: p.tagline,
        capa: p.coverUrl,
        // Quantas casas tem a grade deste projeto, e se são letras ou números.
        sequencia: p.sequencia,
        blocos: p.sequencia === SequenciaDoProjeto.LETRAS ? 26 : p.blocos,
        capaLargura: (p.coverUrl && medidas.get(p.coverUrl)?.width) || null,
        capaAltura: (p.coverUrl && medidas.get(p.coverUrl)?.height) || null,
        destaque: p.destaque,
        publicado: p.status === ProjectStatus.ACTIVE,
        /**
         * Os números vão em bruto para o navegador, e é lá que viram 1,5K.
         *
         * Formatar no servidor obrigaria a repetir a regra em cada rota que os
         * devolvesse, e o dia em que uma delas ficasse para trás mostraria dois
         * formatos na mesma página.
         */
        numeros: contagens.get(p.id) ?? { views: 0, likes: 0, comments: 0, shares: 0 },
      }))
  }

  /**
   * Põe um projeto num dos dois destaques, ou tira-o de lá.
   *
   * A base tem `@unique` no campo, por isso não pode haver dois na mesma casa.
   * Limpar quem lá estava ANTES de escrever é o que evita bater nesse índice —
   * e as duas escritas vão numa transação, senão uma falha a meio deixava a
   * casa vazia e o cliente a pensar que o painel não funcionou.
   */
  async definirDestaque(projectSlug: string, destaque: DestaqueDoCarrossel | null) {
    const projeto = await this.prisma.project.findUnique({ where: { slug: projectSlug } })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')

    await this.prisma.$transaction(async (tx) => {
      if (destaque) {
        await tx.project.updateMany({
          where: { destaque, NOT: { id: projeto.id } },
          data: { destaque: null },
        })
      }
      await tx.project.update({ where: { id: projeto.id }, data: { destaque } })
    })

    return this.listar(true)
  }

  /**
   * `publicado` põe o projeto no site ou tira-o de lá.
   *
   * Pedido dele em 19/09: o "31 Atributos de Deus" ainda não está feito e não
   * deve aparecer. Tirado do site, o projeto sai da lista da página inicial,
   * mas o endereço dele continua a abrir — os QR Codes que já existam não
   * partem, e ele continua a trabalhar no projeto pelo painel.
   *
   * Arquivado é outra coisa e não passa por aqui: esse fecha a página toda.
   */
  async actualizarCartao(
    projectSlug: string,
    dados: {
      tagline?: string | null
      coverUrl?: string | null
      ordemNoCarrossel?: number
      publicado?: boolean
    },
  ) {
    const projeto = await this.prisma.project.findUnique({ where: { slug: projectSlug } })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')
    if (dados.publicado !== undefined && projeto.status === ProjectStatus.ARCHIVED) {
      throw new BadRequestException('Este projeto está arquivado.')
    }

    await this.prisma.project.update({
      where: { id: projeto.id },
      data: {
        ...(dados.tagline !== undefined ? { tagline: dados.tagline } : {}),
        ...(dados.coverUrl !== undefined ? { coverUrl: dados.coverUrl } : {}),
        ...(dados.ordemNoCarrossel !== undefined
          ? { ordemNoCarrossel: dados.ordemNoCarrossel }
          : {}),
        ...(dados.publicado !== undefined
          ? { status: dados.publicado ? ProjectStatus.ACTIVE : ProjectStatus.DRAFT }
          : {}),
      },
    })

    return this.listar(true)
  }

  /**
   * A ordem inteira da lista, de uma vez.
   *
   * Os dois "destaques" nasceram para o carrossel lado a lado, com um projeto à
   * esquerda e outro à direita. Em 19/09 ele passou a lista para um projeto
   * por linha, e aí esquerda e direita deixam de querer dizer alguma coisa: o
   * que existe é primeiro, segundo, terceiro. Ordenar limpa os destaques, e a
   * partir daí manda só `ordemNoCarrossel`.
   *
   * Até ele reordenar pela primeira vez, a ordem continua a que já estava no ar
   * (os destaques primeiro), e nada muda sozinho no dia da publicação.
   */
  async ordenar(slugs: string[]) {
    const projetos = await this.prisma.project.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    })
    if (projetos.length !== slugs.length) {
      throw new BadRequestException('A lista de projetos mudou. Recarregue a página.')
    }
    const porSlug = new Map(projetos.map((p) => [p.slug, p.id]))
    await this.prisma.$transaction(
      slugs.map((slug, i) =>
        this.prisma.project.update({
          where: { id: porSlug.get(slug)! },
          data: { ordemNoCarrossel: i, destaque: null },
        }),
      ),
    )
    return this.listar(true)
  }

  /**
   * Quantos blocos este projeto tem, decidido por ele no painel.
   *
   * Ponto dele em 19/09: "não quero que a quantidade fique fixa no código". Põe
   * 7 e ficam sete casas; põe 31 e ficam trinta e uma.
   *
   * CRESCER CRIA. ENCOLHER NÃO APAGA NADA — esconde.
   *
   * A primeira versão disto apagava as casas a mais quando estivessem vazias, e
   * estava errada por duas razões. A primeira: cada bloco nasce com um QR Code,
   * que ele pode ter mandado imprimir antes de preencher o conteúdo — apagar o
   * bloco transformava um QR impresso numa página de erro, e um QR impresso não
   * se corrige. A segunda: um número escrito por engano no painel não pode ser
   * uma ordem de apagar trabalho.
   *
   * Então reduzir muda só o tamanho da grade. Os blocos a mais saem da página,
   * continuam a abrir pelo endereço e pelo QR, e voltam à grade inteiros se ele
   * aumentar outra vez. Nada se perde, e nada fica escondido por acidente sem
   * ele poder desfazer.
   *
   * Os alfabetos não passam por aqui: 26 letras são 26 letras.
   */
  async definirBlocos(projectSlug: string, quantidade: number) {
    if (quantidade < 0 || quantidade > 200) {
      throw new BadRequestException('A quantidade de blocos tem de ficar entre 0 e 200.')
    }
    const projeto = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true, sequencia: true, blocos: true },
    })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')
    if (projeto.sequencia === SequenciaDoProjeto.LETRAS) {
      throw new BadRequestException('Este projeto é um alfabeto: são sempre 26 letras.')
    }

    const existentes = await this.prisma.content.findMany({
      where: { projectId: projeto.id, ordinal: { not: null } },
      select: { id: true, ordinal: true },
    })
    const porNumero = new Map(existentes.map((c) => [c.ordinal!, c]))

    const novos: { id: string; slug: string }[] = []
    await this.prisma.$transaction(async (tx) => {
      for (let n = 1; n <= quantidade; n++) {
        if (porNumero.has(n)) continue
        const criado = await tx.content.create({
          data: {
            projectId: projeto.id,
            slug: String(n),
            title: `Bloco ${n}`,
            position: n,
            ordinal: n,
            blocks: { create: casasEmBranco() },
          },
          select: { id: true, slug: true },
        })
        novos.push(criado)
      }
      await tx.project.update({ where: { id: projeto.id }, data: { blocos: quantidade } })
    })

    // Fora da transacção: o QR é uma escrita noutra tabela e, se falhar, não
    // pode desfazer os blocos que ele acabou de criar. Repetir a operação
    // volta a tentar, porque `criarQrDeConteudo` devolve o que já existir.
    await this.garantirQr({ id: projeto.id, slug: projectSlug }, novos)

    return this.listar(true)
  }

  /**
   * Cria um projeto novo com a quantidade de blocos que ele escolher.
   *
   * Ponto 3 do documento dele: informar o nome e quantos blocos quer, e o
   * sistema cria-os. Sete, vinte, vinte e seis — o número é dele.
   *
   * Os blocos nascem como `Content` em rascunho, que é o que já são no resto da
   * plataforma: uma letra é um Content, e está escrito na primeira linha do
   * schema que nada aqui sabe o que é uma letra. Um projeto de vinte blocos usa
   * a mesma engrenagem das vinte e seis letras, sem uma linha de código nova —
   * e é por isso que o próximo projeto dele não me vai precisar.
   */
  async criarProjeto(dados: { slug: string; nome: string; blocos: number; tagline?: string }) {
    const slug = dados.slug
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!slug) throw new BadRequestException('O endereço do projeto ficou vazio.')
    if (dados.blocos < 1 || dados.blocos > 200) {
      throw new BadRequestException('A quantidade de blocos tem de ficar entre 1 e 200.')
    }

    const jaExiste = await this.prisma.project.findUnique({ where: { slug } })
    if (jaExiste) throw new BadRequestException(`Já existe um projeto no endereço "${slug}".`)

    const ultimo = await this.prisma.project.findFirst({
      orderBy: { ordemNoCarrossel: 'desc' },
      select: { ordemNoCarrossel: true },
    })

    const projeto = await this.prisma.project.create({
      data: {
        slug,
        name: dados.nome.trim(),
        tagline: dados.tagline?.trim() || null,
        status: ProjectStatus.DRAFT,
        ordemNoCarrossel: (ultimo?.ordemNoCarrossel ?? 0) + 1,
        sequencia: SequenciaDoProjeto.NUMEROS,
        blocos: dados.blocos,
        contents: {
          create: Array.from({ length: dados.blocos }, (_, i) => ({
            slug: String(i + 1),
            title: `Bloco ${i + 1}`,
            position: i + 1,
            // A casa da grade. É o que a `letra` é no alfabeto.
            ordinal: i + 1,
            blocks: { create: casasEmBranco() },
          })),
        },
      },
      include: {
        _count: { select: { contents: true } },
        contents: { select: { id: true, slug: true } },
      },
    })

    // Os blocos novos nascem com QR, como as letras. Ver `garantirQr`.
    await this.garantirQr(projeto, projeto.contents)

    return {
      slug: projeto.slug,
      nome: projeto.name,
      blocos: projeto._count.contents,
    }
  }
}

/**
 * As quatro casas em branco de um bloco, iguais às de uma letra.
 *
 * Um bloco de um projeto novo tem a mesma estrutura de uma letra do alfabeto —
 * foi o que ele pediu em 19/09: "usando o mesmo player e a mesma lógica que já
 * estão funcionando". Nascem vazias, e uma casa vazia não aparece na página a
 * ninguém: só se mostra quando ele lhe puser alguma coisa dentro.
 *
 * Os nomes são os mesmos do alfabeto (`vagoes-do-alfabeto.ts`) e são internos:
 * a regra dele de 23/08 é que o nome da casa não aparece na página.
 */
function casasEmBranco() {
  return ['Explicação', 'Música', 'Repetição do versículo', 'Oração'].map((nome, i) => ({
    type: BlockType.AUDIO,
    papel: CardPapel.CARTAO,
    estado: CardEstado.RASCUNHO,
    slot: i + 1,
    label: nome,
    position: i + 1,
  }))
}
