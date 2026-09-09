import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DestaqueDoCarrossel, ProjectStatus } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { ContagensService } from '../social/contagens.service'

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
  ) {}

  async listar() {
    const projetos = await this.prisma.project.findMany({
      where: { status: ProjectStatus.ACTIVE },
      orderBy: [{ ordemNoCarrossel: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        coverUrl: true,
        destaque: true,
        ordemNoCarrossel: true,
      },
    })

    const contagens = await this.contagens.deProjectos(projetos.map((p) => p.id))

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
        destaque: p.destaque,
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

    return this.listar()
  }

  async actualizarCartao(
    projectSlug: string,
    dados: { tagline?: string | null; coverUrl?: string | null; ordemNoCarrossel?: number },
  ) {
    const projeto = await this.prisma.project.findUnique({ where: { slug: projectSlug } })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')

    await this.prisma.project.update({
      where: { id: projeto.id },
      data: {
        ...(dados.tagline !== undefined ? { tagline: dados.tagline } : {}),
        ...(dados.coverUrl !== undefined ? { coverUrl: dados.coverUrl } : {}),
        ...(dados.ordemNoCarrossel !== undefined
          ? { ordemNoCarrossel: dados.ordemNoCarrossel }
          : {}),
      },
    })

    return this.listar()
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
        contents: {
          create: Array.from({ length: dados.blocos }, (_, i) => ({
            slug: String(i + 1),
            title: `Bloco ${i + 1}`,
            position: i + 1,
          })),
        },
      },
      include: { _count: { select: { contents: true } } },
    })

    return {
      slug: projeto.slug,
      nome: projeto.name,
      blocos: projeto._count.contents,
    }
  }
}
