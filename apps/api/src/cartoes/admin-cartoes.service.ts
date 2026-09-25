import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { FormatoDaMoldura } from '@pv/db'
import { A4_MM, DPI_BOM, mmParaPx } from '@pv/cartoes'
import { PrismaService } from '../prisma/prisma.service'
import { CartoesService } from './cartoes.service'
import { StorageService, type ArquivoSalvo } from '../admin/storage.service'
import { conferirPdf, DPI_DA_LUPA, rasterizarPrimeiraPagina } from './arte-em-pdf'

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
  categoriaId?: string
}

/** Os campos que o painel pode mexer numa categoria. */
export interface CamposDaCategoria {
  nome?: string
  slug?: string
  descricao?: string | null
  capaUrl?: string | null
  ofertaEmBreve?: boolean
  ofertaAudioUrl?: string | null
  rotuloSingular?: string
  rotuloPlural?: string
  ativo?: boolean
  ordem?: number
  precoUnitarioCent?: number | null
  precoDeTabelaCent?: number | null
  descontoPercentagem?: number | null
  descontoAPartirDe?: number | null
}

/** "Crianças Pequenas" -> "criancas-pequenas". */
function paraSlug(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

  // ── Categorias ────────────────────────────────────────────────────

  async listarCategorias(projectSlug: string) {
    const projeto = await this.projeto(projectSlug)
    const categorias = await this.prisma.categoriaDeCartoes.findMany({
      where: { projectId: projeto.id },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      include: { _count: { select: { modelos: true, pedidos: true } } },
    })
    return categorias.map(({ _count, ...c }) => ({
      ...c,
      modelos: _count.modelos,
      pedidos: _count.pedidos,
    }))
  }

  /**
   * Uma categoria nova.
   *
   * Os rótulos por omissão são "pessoa" e "pessoas", e não "criança". Uma
   * categoria nova é quase de certeza para outro público — os Adultos foram a
   * primeira — e o rótulo neutro nunca soa errado, enquanto "Quantas crianças?"
   * num cartão para casais soa.
   */
  async criarCategoria(projectSlug: string, dados: CamposDaCategoria) {
    const projeto = await this.projeto(projectSlug)
    const nome = dados.nome?.trim()
    if (!nome) throw new BadRequestException('Dê um nome à categoria.')

    const slug = paraSlug(dados.slug ?? nome)
    if (!slug) throw new BadRequestException('O nome precisa de ter pelo menos uma letra.')

    const existente = await this.prisma.categoriaDeCartoes.findUnique({
      where: { projectId_slug: { projectId: projeto.id, slug } },
    })
    if (existente) {
      throw new BadRequestException(`Já existe a categoria "${existente.nome}" neste projeto.`)
    }

    const ultima = await this.prisma.categoriaDeCartoes.findFirst({
      where: { projectId: projeto.id },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    })

    return this.prisma.categoriaDeCartoes.create({
      data: {
        projectId: projeto.id,
        slug,
        nome,
        descricao: dados.descricao ?? null,
        capaUrl: dados.capaUrl ?? null,
        rotuloSingular: dados.rotuloSingular?.trim() || 'pessoa',
        rotuloPlural: dados.rotuloPlural?.trim() || 'pessoas',
        ativo: dados.ativo ?? true,
        ordem: dados.ordem ?? (ultima?.ordem ?? 0) + 1,
        precoUnitarioCent: dados.precoUnitarioCent ?? null,
        precoDeTabelaCent: dados.precoDeTabelaCent ?? null,
        descontoPercentagem: dados.descontoPercentagem ?? null,
        descontoAPartirDe: dados.descontoAPartirDe ?? null,
      },
    })
  }

  /**
   * Muda uma categoria. O slug NÃO muda, de propósito: vai no endereço do
   * editor, e um endereço partilhado no WhatsApp tem de continuar a abrir.
   *
   * O preço aceita `null` para voltar a usar o do projeto.
   */
  async actualizarCategoria(id: string, dados: CamposDaCategoria) {
    const categoria = await this.prisma.categoriaDeCartoes.findUnique({ where: { id } })
    if (!categoria) throw new NotFoundException('Categoria não encontrada.')

    const campos = [
      'nome', 'descricao', 'capaUrl', 'ofertaEmBreve', 'ofertaAudioUrl',
      'rotuloSingular', 'rotuloPlural', 'ativo', 'ordem',
      'precoUnitarioCent', 'precoDeTabelaCent', 'descontoPercentagem', 'descontoAPartirDe',
    ] as const
    const alteracoes: Record<string, unknown> = {}
    for (const campo of campos) {
      if (dados[campo] !== undefined) alteracoes[campo] = dados[campo]
    }
    if (typeof alteracoes.nome === 'string' && !alteracoes.nome.trim()) {
      throw new BadRequestException('O nome da categoria não pode ficar vazio.')
    }

    return this.prisma.categoriaDeCartoes.update({ where: { id }, data: alteracoes })
  }

  /**
   * Apagar só quando está vazia.
   *
   * Apagar em cascata levaria os cartões e as artes todas de uma vez, com um
   * clique. Desactivar esconde a categoria sem perder nada, e é quase sempre o
   * que se quer — a mensagem di-lo.
   */
  async removerCategoria(id: string) {
    const categoria = await this.prisma.categoriaDeCartoes.findUnique({
      where: { id },
      include: { _count: { select: { modelos: true } } },
    })
    if (!categoria) throw new NotFoundException('Categoria não encontrada.')
    if (categoria._count.modelos > 0) {
      throw new BadRequestException(
        `A categoria "${categoria.nome}" ainda tem ${categoria._count.modelos} cartão(ões). ` +
          `Apague-os primeiro, ou desative a categoria para escondê-la sem perder nada.`,
      )
    }
    await this.prisma.categoriaDeCartoes.delete({ where: { id } })
    return { removida: true }
  }

  // ── Modelos ───────────────────────────────────────────────────────

  async listarModelos(projectSlug: string) {
    const projeto = await this.projeto(projectSlug)
    const modelos = await this.prisma.modeloDeCartao.findMany({
      where: { projectId: projeto.id },
      orderBy: [{ ordem: 'asc' }, { dia: 'asc' }],
    })
    return modelos.map((m) => ({ ...m, aviso: this.avisoDaArte(m.arteImpressaoUrl, m.fotoLargura) }))
  }

  /**
   * Em que projetos é que os cartões estão mesmo.
   *
   * A entrada "Cartões personalizados" aparece no painel de TODOS os projetos,
   * porque qualquer projeto pode ter cartões. Mas os que existem hoje estão num
   * só, e quem abrisse a entrada a partir de outro encontrava um ecrã vazio a
   * convidá-lo a criar categorias — ou seja, a construir um segundo conjunto
   * paralelo ao que já tem.
   *
   * Foi o que aconteceu: ele procurou a arte no projeto onde passa os dias e
   * não a encontrou. O ecrã vazio passa a apontar para onde ela está.
   */
  async ondeEstaoOsCartoes() {
    const projetos = await this.prisma.project.findMany({
      where: { modelosDeCartao: { some: {} } },
      orderBy: { name: 'asc' },
      select: {
        slug: true,
        name: true,
        _count: { select: { modelosDeCartao: true } },
      },
    })
    return projetos.map(({ _count, ...p }) => ({ ...p, modelos: _count.modelosDeCartao }))
  }

  async criarModelo(projectSlug: string, dados: CamposDoModelo) {
    const projeto = await this.projeto(projectSlug)
    const categoria = await this.categoriaDoModelo(projeto.id, dados.categoriaId)

    const dia = dados.dia ?? (await this.proximoDia(categoria.id))
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
        categoriaId: categoria.id,
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
    const daLupa = await rasterizarPrimeiraPagina(ficheiro.buffer, {
      dpi: DPI_DA_LUPA,
      qualidade: 92,
    })

    const pdfSalvo = await this.storage.salvar(ficheiro)
    const imagemSalva = await this.storage.salvar({
      ...ficheiro,
      originalname: ficheiro.originalname.replace(/\.pdf$/i, '') + '-ecra.jpg',
      mimetype: 'image/jpeg',
      buffer: previa,
      size: previa.length,
    } as Express.Multer.File)
    const lupaSalva = await this.storage.salvar({
      ...ficheiro,
      originalname: ficheiro.originalname.replace(/\.pdf$/i, '') + '-lupa.jpg',
      mimetype: 'image/jpeg',
      buffer: daLupa,
      size: daLupa.length,
    } as Express.Multer.File)

    const actualizado = await this.prisma.modeloDeCartao.update({
      where: { id },
      data: {
        // De ecrã é a rasterizada; de impressão é o PDF original; a da lupa é
        // a rasterizada a 300 dpi, para conferir o texto de perto.
        arteUrl: imagemSalva.url,
        arteImpressaoUrl: pdfSalvo.url,
        arteLupaUrl: lupaSalva.url,
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
      precoDeTabelaCent?: number | null
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

  /**
   * A categoria de um cartão novo. Tem de ser do mesmo projeto — sem esta
   * conferência, um identificador trocado no painel punha um cartão das
   * Crianças dentro de uma categoria de outro projeto.
   */
  private async categoriaDoModelo(projectId: string, categoriaId?: string) {
    if (categoriaId) {
      const categoria = await this.prisma.categoriaDeCartoes.findFirst({
        where: { id: categoriaId, projectId },
      })
      if (!categoria) throw new BadRequestException('Esta categoria não pertence a este projeto.')
      return categoria
    }
    const primeira = await this.prisma.categoriaDeCartoes.findFirst({
      where: { projectId },
      orderBy: { ordem: 'asc' },
    })
    if (!primeira) throw new BadRequestException('Crie uma categoria antes de cadastrar cartões.')
    return primeira
  }

  /** O próximo "Dia N" DENTRO da categoria: os Adultos começam no Dia 1. */
  private async proximoDia(categoriaId: string) {
    const ultimo = await this.prisma.modeloDeCartao.findFirst({
      where: { categoriaId },
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
