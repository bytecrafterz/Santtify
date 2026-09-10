import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { FormatoDaMoldura } from '@pv/db'
import { A4_MM, DPI_BOM, mmParaPx } from '@pv/cartoes'
import { PrismaService } from '../prisma/prisma.service'
import { CartoesService } from './cartoes.service'
import { StorageService, type ArquivoSalvo } from '../admin/storage.service'
import { conferirPdf, rasterizarPrimeiraPagina } from './arte-em-pdf'

/**
 * Os campos que o painel pode mexer num modelo.
 *
 * Escrito por extenso e não `Record<string, unknown>`: o compilador é a única
 * coisa que impede o painel de enviar um campo com outro nome e a alteração
 * desaparecer em silêncio, que é o género de avaria que só se descobre quando
 * o cliente diz que mudou a medida e nada mudou.
 */
export interface CamposDoModelo {
  slug?: string
  dia?: number
  nome?: string
  ativo?: boolean
  ordem?: number
  fotoX?: number
  fotoY?: number
  fotoLargura?: number
  fotoAltura?: number
  fotoFormato?: FormatoDaMoldura
  nomeX?: number
  nomeY?: number
  nomeLargura?: number
  nomeAltura?: number
  nomeCorHex?: string
  nomeCorpoMinimo?: number
  nomeCorpoMaximo?: number
  nomeMaiusculas?: boolean
  idioma?: string
}

/**
 * O lado do painel: modelos, preço e a conferência das artes.
 *
 * A medida da moldura em milímetros é o número mais importante desta
 * funcionalidade inteira, e é aqui que ele é escrito. Sem ele a validação de
 * qualidade não tem régua: recusaria fotografias boas ou aprovaria fotografias
 * más, e nos dois casos só se saberia na gráfica.
 */
@Injectable()
export class AdminCartoesService {
  private readonly logger = new Logger(AdminCartoesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartoes: CartoesService,
    private readonly storage: StorageService,
  ) {}

  async listarModelos(projectSlug: string) {
    const projeto = await this.projeto(projectSlug)
    const modelos = await this.prisma.modeloDeCartao.findMany({
      where: { projectId: projeto.id },
      orderBy: [{ ordem: 'asc' }, { dia: 'asc' }],
    })
    return modelos.map((m) => ({ ...m, aviso: this.avisoDaArte(m.arteImpressaoUrl, m.fotoLargura) }))
  }

  async criarModelo(projectSlug: string, dados: CamposDoModelo) {
    const projeto = await this.projeto(projectSlug)

    const dia = dados.dia ?? (await this.proximoDia(projeto.id))
    /**
     * O slug leva o idioma quando não é o principal.
     *
     * `@@unique([projectId, slug])` não deixa dois modelos com o mesmo slug no
     * mesmo projeto, e o Dia 1 em inglês é um modelo diferente do Dia 1 em
     * português. Sem isto, cadastrar a versão inglesa rebentava contra o
     * índice com um erro que não explicava nada.
     */
    const idioma = dados.idioma ?? 'pt-BR'
    const slug = (
      dados.slug ?? (idioma === 'pt-BR' ? `dia-${dia}` : `dia-${dia}-${idioma.toLowerCase()}`)
    )
      .trim()
      .toLowerCase()

    /**
     * As medidas por omissão vêm das artes que ele mandou: a moldura oval no
     * meio da folha, o nome logo por baixo. São um ponto de partida honesto e
     * não uma adivinhação disfarçada — o painel mostra-as e ele corrige-as
     * modelo a modelo com a régua do designer.
     */
    return this.prisma.modeloDeCartao.create({
      data: {
        projectId: projeto.id,
        slug,
        dia,
        nome: dados.nome ?? `Dia ${dia}`,
        ordem: dados.ordem ?? dia,
        fotoX: dados.fotoX ?? 68,
        fotoY: dados.fotoY ?? 92,
        fotoLargura: dados.fotoLargura ?? 74,
        fotoAltura: dados.fotoAltura ?? 92,
        fotoFormato: dados.fotoFormato ?? FormatoDaMoldura.ELIPSE,
        nomeX: dados.nomeX ?? 55,
        nomeY: dados.nomeY ?? 190,
        nomeLargura: dados.nomeLargura ?? 100,
        nomeAltura: dados.nomeAltura ?? 16,
        nomeCorHex: dados.nomeCorHex ?? '#12356B',
        nomeCorpoMinimo: dados.nomeCorpoMinimo ?? 8,
        nomeCorpoMaximo: dados.nomeCorpoMaximo ?? 20,
        nomeMaiusculas: dados.nomeMaiusculas ?? true,
        idioma,
      },
    })
  }

  async actualizarModelo(id: string, dados: CamposDoModelo) {
    const modelo = await this.prisma.modeloDeCartao.findUnique({ where: { id } })
    if (!modelo) throw new NotFoundException('Modelo não encontrado.')

    const permitidos = [
      'slug', 'dia', 'nome', 'ativo', 'ordem',
      'fotoX', 'fotoY', 'fotoLargura', 'fotoAltura', 'fotoFormato',
      'nomeX', 'nomeY', 'nomeLargura', 'nomeAltura', 'nomeCorHex',
      'nomeCorpoMinimo', 'nomeCorpoMaximo', 'nomeMaiusculas', 'idioma',
    ]
    const alteracoes: Record<string, unknown> = {}
    const entrada = dados as Record<string, unknown>
    for (const campo of permitidos) {
      if (entrada[campo] !== undefined) alteracoes[campo] = entrada[campo]
    }

    const x = (alteracoes.fotoX ?? modelo.fotoX) as number
    const largura = (alteracoes.fotoLargura ?? modelo.fotoLargura) as number
    const y = (alteracoes.fotoY ?? modelo.fotoY) as number
    const altura = (alteracoes.fotoAltura ?? modelo.fotoAltura) as number

    // A moldura tem de caber na folha. Uma moldura que transborda não dá erro
    // nenhum ao compor: dá um cartão com a fotografia cortada pela margem.
    if (x + largura > A4_MM.largura + 0.5 || y + altura > A4_MM.altura + 0.5) {
      throw new BadRequestException(
        `A moldura da foto sai da folha A4 (${A4_MM.largura}x${A4_MM.altura} mm). ` +
          `Confira a posição e o tamanho.`,
      )
    }

    return this.prisma.modeloDeCartao.update({ where: { id }, data: alteracoes })
  }

  async removerModelo(id: string) {
    await this.prisma.modeloDeCartao.delete({ where: { id } })
    return { removido: true }
  }

  /**
   * Guarda a arte de um modelo.
   *
   * `larguraOriginal` VEM DE FORA e é medida no ficheiro que o designer
   * enviou. Não se pode usar `salvo.largura`: o `StorageService` devolve as
   * medidas da cópia de ECRÃ, limitada a 1200px, por isso uma arte perfeita de
   * 2480px voltaria de lá como 1200 e o aviso dispararia sempre. Um aviso que
   * grita em todas as artes é um aviso que se aprende a ignorar — e depois
   * cala-se justamente na que estava mesmo pequena.
   *
   * `arteImpressaoUrl` leva o mesmo endereço da de ecrã de propósito: é a
   * partir dele que `lerParaImpressao` deriva o nome da cópia de 2480px, e é
   * ela que o PDF usa. Guardar o endereço derivado seria guardar duas vezes a
   * mesma informação, com um sítio a mais para ficar desactualizado.
   */
  async definirArte(id: string, salvo: ArquivoSalvo, larguraOriginal: number) {
    const modelo = await this.prisma.modeloDeCartao.findUnique({ where: { id } })
    if (!modelo) throw new NotFoundException('Modelo não encontrado.')

    const actualizado = await this.prisma.modeloDeCartao.update({
      where: { id },
      data: { arteUrl: salvo.url, arteImpressaoUrl: salvo.url },
    })

    return {
      ...actualizado,
      largura: larguraOriginal,
      altura: salvo.altura,
      aviso: this.avisoDaLargura(larguraOriginal),
    }
  }

  /**
   * A arte em PDF vectorial — o formato que o designer entrega.
   *
   * O PDF fica como está e é ele que entra no ficheiro de impressão. A cópia de
   * ecrã é rasterizada a partir dele, e serve só para o editor desenhar a folha
   * enquanto a mãe enquadra a fotografia.
   *
   * A conferência das medidas é feita ANTES de guardar. Uma arte que não é A4
   * não dá erro nenhum ao ser embutida: sai esticada ou cortada, e isso só
   * aparece no papel, depois de impresso.
   */
  async definirArteEmPdf(id: string, ficheiro: Express.Multer.File) {
    const modelo = await this.prisma.modeloDeCartao.findUnique({ where: { id } })
    if (!modelo) throw new NotFoundException('Modelo não encontrado.')

    const conferido = await conferirPdf(ficheiro.buffer)
    const previa = await rasterizarPrimeiraPagina(ficheiro.buffer)

    const pdfSalvo = await this.storage.salvar(ficheiro)
    const imagemSalva = await this.storage.salvar({
      ...ficheiro,
      originalname: ficheiro.originalname.replace(/\.pdf$/i, '') + '-ecra.jpg',
      mimetype: 'image/jpeg',
      buffer: previa,
      size: previa.length,
    } as Express.Multer.File)

    const actualizado = await this.prisma.modeloDeCartao.update({
      where: { id },
      data: {
        // De ecrã é a rasterizada; de impressão é o PDF original.
        arteUrl: imagemSalva.url,
        arteImpressaoUrl: pdfSalvo.url,
      },
    })

    const avisos: string[] = []
    if (!conferido.ehA4) {
      avisos.push(
        `Esta arte tem ${conferido.larguraMm} x ${conferido.alturaMm} mm e não é A4 ` +
          `(${A4_MM.largura} x ${A4_MM.altura} mm). Ela vai ser esticada para caber. ` +
          `Peça ao designer para exportar em A4.`,
      )
    }
    if (conferido.paginas > 1) {
      avisos.push(
        `O arquivo tem ${conferido.paginas} páginas e só a primeira é usada. ` +
          `Se cada modelo for uma página, envie um arquivo por modelo.`,
      )
    }

    return {
      ...actualizado,
      vectorial: true,
      larguraMm: conferido.larguraMm,
      alturaMm: conferido.alturaMm,
      aviso: avisos.length ? avisos.join(' ') : null,
    }
  }

  async actualizarPreco(
    projectSlug: string,
    dados: {
      precoUnitarioCent?: number
      moeda?: string
      descontoPercentagem?: number
      descontoAPartirDe?: number
    },
  ) {
    const projeto = await this.projeto(projectSlug)
    return this.prisma.precoDeCartoes.upsert({
      where: { projectId: projeto.id },
      create: { projectId: projeto.id, ...dados },
      update: dados,
    })
  }

  async listarPedidos() {
    const pedidos = await this.prisma.pedidoDeCartoes.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 100,
      include: {
        criancas: { select: { id: true, nome: true, selecionada: true, confirmada: true } },
        project: { select: { slug: true, name: true } },
      },
    })

    return pedidos.map((p) => ({
      id: p.id,
      projeto: p.project.name,
      projectSlug: p.project.slug,
      estado: p.estado,
      meio: p.meio,
      referenciaExterna: p.referenciaExterna,
      totalCent: p.totalCent,
      moeda: p.moeda,
      criadoEm: p.criadoEm,
      pagoEm: p.pagoEm,
      expiraEm: p.expiraEm,
      conjuntos: p.criancas.filter((c) => c.selecionada).length,
      criancas: p.criancas.map((c) => ({ nome: c.nome, confirmada: c.confirmada })),
    }))
  }

  /**
   * Confirma um pagamento à mão, pela mesma porta do webhook.
   *
   * `idExterno` leva a marca de que veio do painel e a referência do pedido, o
   * que faz dele único e, portanto, idempotente como os outros: carregar duas
   * vezes no botão não paga o pedido duas vezes.
   */
  async confirmarPagamentoManual(pedidoId: string, referencia: string) {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({ where: { id: pedidoId } })
    if (!pedido) throw new NotFoundException('Pedido não encontrado.')
    if (!pedido.referenciaExterna) {
      throw new BadRequestException('Este pedido ainda não tem cobrança criada.')
    }

    this.logger.warn(`Pagamento do pedido ${pedidoId} confirmado à mão pelo painel.`)

    return this.cartoes.registarAviso({
      idExterno: `painel_${pedido.referenciaExterna}`,
      referenciaExterna: pedido.referenciaExterna,
      tipo: 'confirmacao_manual',
      pago: true,
      bruto: { origem: 'painel', referenciaInformada: referencia },
    })
  }

  // ── Auxiliares ────────────────────────────────────────────────────

  private async projeto(slug: string) {
    const projeto = await this.prisma.project.findUnique({ where: { slug } })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')
    return projeto
  }

  private async proximoDia(projectId: string) {
    const ultimo = await this.prisma.modeloDeCartao.findFirst({
      where: { projectId },
      orderBy: { dia: 'desc' },
      select: { dia: true },
    })
    return (ultimo?.dia ?? 0) + 1
  }

  /**
   * O aviso que o painel mostra ao lado da arte.
   *
   * A conta é a mesma que está no ENTREGA.md desde o início: uma folha A4 a
   * 300 dpi tem 2480px de largura, e uma arte de 1000px sai a cerca de 124 dpi.
   * Dizê-lo no painel, no momento do carregamento, é o que evita descobri-lo na
   * gráfica.
   */
  private avisoDaLargura(largura: number): string | null {
    const necessaria = Math.round(mmParaPx(A4_MM.largura, DPI_BOM))
    if (largura >= necessaria) return null
    const dpi = Math.round((largura / (A4_MM.largura / 25.4)))
    return (
      `Esta arte tem ${largura}px de largura e sai a cerca de ${dpi} dpi em A4. ` +
      `Para os 300 dpi de impressão são precisos ${necessaria}px. Peça ao designer ` +
      `uma exportação maior.`
    )
  }

  private avisoDaArte(arte: string | null, _fotoLargura: number): string | null {
    if (!arte) return 'Este modelo ainda não tem arte carregada.'
    return null
  }
}
