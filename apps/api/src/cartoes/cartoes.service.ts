import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EstadoDoPedido, MeioDePagamento, type Prisma } from '@pv/db'
import {
  avaliarFoto,
  calcularPreco,
  DPI_DE_IMPRESSAO,
  minimoDePixeis,
  type Ajuste,
} from '@pv/cartoes'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../admin/storage.service'
import { ArmazenamentoDeCartoesService } from './armazenamento-de-cartoes.service'
import { comporCartao } from './desenho-do-cartao'
import { montarPdf, type FolhaDoPdf } from './pdf-dos-cartoes'
import { ProvedorDePagamento, type AvisoDePagamento } from './pagamentos/provedor'
import { criarFicha, lerFicha } from './ligacao-de-partilha'
import { MailService } from '../common/mail/mail.service'

/** O máximo de crianças num pedido. Acima disto é gráfica, não é família. */
const MAXIMO_DE_CRIANCAS = 10

@Injectable()
export class CartoesService {
  private readonly logger = new Logger(CartoesService.name)
  private readonly diasAteExpurgo: number
  private readonly horasAteAbandono: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly armazenamento: ArmazenamentoDeCartoesService,
    private readonly storage: StorageService,
    private readonly provedor: ProvedorDePagamento,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.diasAteExpurgo = this.config.get<number>('CARTOES_DIAS_ATE_EXPURGO') ?? 7
    this.horasAteAbandono = this.config.get<number>('CARTOES_HORAS_ATE_ABANDONO') ?? 48
  }

  // ─────────────────────────────────────────────────────────────────
  // MODELOS E PREÇO
  // ─────────────────────────────────────────────────────────────────

  async modelos(projectSlug: string) {
    const projeto = await this.projeto(projectSlug)
    const modelos = await this.prisma.modeloDeCartao.findMany({
      where: { projectId: projeto.id, ativo: true },
      orderBy: [{ ordem: 'asc' }, { dia: 'asc' }],
    })

    return modelos.map((m) => ({
      id: m.id,
      slug: m.slug,
      dia: m.dia,
      nome: m.nome,
      arteUrl: m.arteUrl,
      /**
       * A geometria vai para o navegador de propósito.
       *
       * É com ela que a prévia desenha a moldura no sítio exacto e avalia a
       * qualidade enquanto a mãe arrasta, sem ida ao servidor a cada pixel. A
       * mesma geometria, os mesmos milímetros, a mesma conta dos dois lados.
       */
      moldura: {
        x: m.fotoX,
        y: m.fotoY,
        largura: m.fotoLargura,
        altura: m.fotoAltura,
        formato: m.fotoFormato,
      },
      nomeCaixa: {
        x: m.nomeX,
        y: m.nomeY,
        largura: m.nomeLargura,
        altura: m.nomeAltura,
        corHex: m.nomeCorHex,
        corpoMinimo: m.nomeCorpoMinimo,
        corpoMaximo: m.nomeCorpoMaximo,
        maiusculas: m.nomeMaiusculas,
      },
    }))
  }

  async tabelaDePrecos(projectSlug: string) {
    const projeto = await this.projeto(projectSlug)
    return this.precoDoProjeto(projeto.id)
  }

  private async precoDoProjeto(projectId: string) {
    const existente = await this.prisma.precoDeCartoes.findUnique({ where: { projectId } })
    if (existente) return existente
    // Nasce com os valores que o cliente escreveu, para o painel nunca abrir
    // vazio e ninguém vender a zero por esquecimento.
    return this.prisma.precoDeCartoes.create({ data: { projectId } })
  }

  // ─────────────────────────────────────────────────────────────────
  // O PEDIDO
  // ─────────────────────────────────────────────────────────────────

  async criarPedido(projectSlug: string, quantidadeDeCriancas: number, userId?: string) {
    if (quantidadeDeCriancas < 1 || quantidadeDeCriancas > MAXIMO_DE_CRIANCAS) {
      throw new BadRequestException(`Escolha entre 1 e ${MAXIMO_DE_CRIANCAS} crianças.`)
    }

    const projeto = await this.projeto(projectSlug)
    const preco = await this.precoDoProjeto(projeto.id)

    const modelos = await this.prisma.modeloDeCartao.count({
      where: { projectId: projeto.id, ativo: true },
    })
    if (modelos === 0) {
      throw new BadRequestException(
        'Este projeto ainda não tem modelos de cartão cadastrados no painel.',
      )
    }

    const pedido = await this.prisma.pedidoDeCartoes.create({
      data: {
        projectId: projeto.id,
        userId: userId ?? null,
        precoUnitarioCent: preco.precoUnitarioCent,
        descontoPercentagem: preco.descontoPercentagem,
        moeda: preco.moeda,
        expiraEm: this.daquiAHoras(this.horasAteAbandono),
        criancas: {
          create: Array.from({ length: quantidadeDeCriancas }, (_, i) => ({ ordem: i + 1 })),
        },
      },
      include: { criancas: { orderBy: { ordem: 'asc' } } },
    })

    return this.paraEcra(pedido.id)
  }

  /**
   * O pedido como o ecrã precisa dele.
   *
   * Nunca devolve `fotoPath`. O caminho do ficheiro é assunto do servidor; o
   * navegador recebe um endereço de rota que confere quem pergunta.
   */
  async paraEcra(pedidoId: string) {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({
      where: { id: pedidoId },
      include: {
        criancas: { orderBy: { ordem: 'asc' } },
        project: { select: { slug: true } },
      },
    })
    if (!pedido) throw new NotFoundException('Pedido não encontrado.')

    const preco = calcularPreco(pedido.criancas.filter((c) => c.selecionada).length, {
      precoUnitarioCent: pedido.precoUnitarioCent,
      descontoPercentagem: pedido.descontoPercentagem,
      descontoAPartirDe: 2,
    })

    return {
      id: pedido.id,
      projectSlug: pedido.project.slug,
      estado: pedido.estado,
      moeda: pedido.moeda,
      preco,
      meio: pedido.meio,
      pixCopiaECola: pedido.pixCopiaECola,
      pixQrSvg: pedido.pixQrSvg,
      pagoEm: pedido.pagoEm,
      expiraEm: pedido.expiraEm,
      criancas: pedido.criancas.map((c) => ({
        id: c.id,
        ordem: c.ordem,
        nome: c.nome,
        temFoto: Boolean(c.fotoPath),
        fotoLargura: c.fotoLargura,
        fotoAltura: c.fotoAltura,
        ajuste: { escala: c.escala, deslocX: c.deslocX, deslocY: c.deslocY } satisfies Ajuste,
        tamanhoDoNome: c.tamanhoDoNome,
        dpi: c.dpi,
        nivel: c.nivel,
        aprovada: c.aprovada,
        selecionada: c.selecionada,
        confirmada: c.confirmada,
        temPdf: Boolean(c.pdfPath),
      })),
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // A FOTOGRAFIA
  // ─────────────────────────────────────────────────────────────────

  /**
   * Recebe a fotografia e dá o veredicto na hora.
   *
   * A peneira aqui é a GROSSA: a fotografia é medida contra a moldura sem zoom
   * nenhum, que é o melhor que ela pode dar. Recusa-se já o que nunca vai
   * servir, para a mãe não enquadrar em vão. A peneira fina corre a cada
   * ajuste, sobre o recorte, e é a que o cliente pediu em 08/09.
   */
  async enviarFoto(pedidoId: string, criancaId: string, ficheiro: Express.Multer.File) {
    const { pedido, crianca } = await this.criancaEditavel(pedidoId, criancaId)

    const moldura = await this.molduraDeReferencia(pedido.projectId)
    const guardada = await this.armazenamento.guardarFoto(pedidoId, criancaId, ficheiro)

    const veredicto = avaliarFoto(
      { largura: moldura.fotoLargura, altura: moldura.fotoAltura },
      { largura: guardada.largura, altura: guardada.altura },
      null,
    )

    if (!veredicto.aprovada) {
      // Recusada não fica em disco. Não há razão para guardar a fotografia de
      // uma criança que o sistema já disse que não vai usar.
      await this.armazenamento.apagar(guardada.caminho)
      const minimo = minimoDePixeis({
        largura: moldura.fotoLargura,
        altura: moldura.fotoAltura,
      })
      return {
        ...veredicto,
        minimo,
        crianca: await this.criancaParaEcra(criancaId),
      }
    }

    await this.armazenamento.apagar(crianca.fotoPath)

    await this.prisma.criancaDoPedido.update({
      where: { id: criancaId },
      data: {
        fotoPath: guardada.caminho,
        fotoLargura: guardada.largura,
        fotoAltura: guardada.altura,
        escala: 1,
        deslocX: 0,
        deslocY: 0,
        dpi: veredicto.dpi,
        nivel: veredicto.nivel,
        aprovada: true,
        // Uma fotografia nova invalida a confirmação anterior: o que ela
        // aprovou já não é o que está lá.
        confirmada: false,
        pdfPath: null,
      },
    })

    return {
      ...veredicto,
      minimo: minimoDePixeis({ largura: moldura.fotoLargura, altura: moldura.fotoAltura }),
      crianca: await this.criancaParaEcra(criancaId),
    }
  }

  async removerFoto(pedidoId: string, criancaId: string) {
    const { crianca } = await this.criancaEditavel(pedidoId, criancaId)
    await this.armazenamento.apagar(crianca.fotoPath)
    await this.armazenamento.apagar(crianca.pdfPath)

    await this.prisma.criancaDoPedido.update({
      where: { id: criancaId },
      data: {
        fotoPath: null,
        fotoLargura: null,
        fotoAltura: null,
        dpi: null,
        nivel: null,
        aprovada: false,
        selecionada: false,
        confirmada: false,
        pdfPath: null,
      },
    })

    return this.paraEcra(pedidoId)
  }

  // ─────────────────────────────────────────────────────────────────
  // O ENQUADRAMENTO E O NOME
  // ─────────────────────────────────────────────────────────────────

  async actualizarCrianca(
    pedidoId: string,
    criancaId: string,
    dados: {
      nome?: string
      escala?: number
      deslocX?: number
      deslocY?: number
      tamanhoDoNome?: number
      selecionada?: boolean
      confirmada?: boolean
    },
  ) {
    const { pedido, crianca } = await this.criancaEditavel(pedidoId, criancaId)

    const alteracoes: Prisma.CriancaDoPedidoUpdateInput = {}

    /**
     * O nome fica numa variável antes de entrar em `alteracoes`.
     *
     * O tipo do Prisma para um campo actualizável é `string | { set: string }`,
     * por isso relê-lo de dentro do objecto obriga a desembrulhar uma união
     * para chamar `.trim()`. Guardar o valor já tratado é mais curto e não tem
     * ramo nenhum para correr mal.
     */
    const nomeFinal = dados.nome !== undefined ? dados.nome.trim().slice(0, 40) : crianca.nome
    if (dados.nome !== undefined) alteracoes.nome = nomeFinal
    if (dados.escala !== undefined) alteracoes.escala = Math.min(6, Math.max(1, dados.escala))
    if (dados.deslocX !== undefined) alteracoes.deslocX = Math.min(1, Math.max(-1, dados.deslocX))
    if (dados.deslocY !== undefined) alteracoes.deslocY = Math.min(1, Math.max(-1, dados.deslocY))
    if (dados.tamanhoDoNome !== undefined) {
      alteracoes.tamanhoDoNome = Math.min(1, Math.max(0, dados.tamanhoDoNome))
    }

    if (dados.selecionada !== undefined) {
      if (dados.selecionada && !crianca.aprovada) {
        throw new BadRequestException(
          'Esta foto ainda não foi aprovada. Envie outra antes de a incluir na compra.',
        )
      }
      if (pedido.estado !== EstadoDoPedido.RASCUNHO) {
        throw new BadRequestException(
          'A seleção já não pode mudar: o pagamento deste pedido já foi iniciado.',
        )
      }
      alteracoes.selecionada = dados.selecionada
    }

    /**
     * O enquadramento novo obriga a reavaliar, e é este o momento que o cliente
     * descreveu: se o recorte final não tiver pixéis para os 300 dpi, avisa-se
     * agora, com a mãe ainda no editor a poder afastar o zoom — e não na
     * gráfica, quando já não há nada a fazer.
     */
    const mexeuNoEnquadramento =
      dados.escala !== undefined || dados.deslocX !== undefined || dados.deslocY !== undefined

    if (mexeuNoEnquadramento && crianca.fotoLargura && crianca.fotoAltura) {
      const moldura = await this.molduraDeReferencia(pedido.projectId)
      const veredicto = avaliarFoto(
        { largura: moldura.fotoLargura, altura: moldura.fotoAltura },
        { largura: crianca.fotoLargura, altura: crianca.fotoAltura },
        {
          escala: (alteracoes.escala as number) ?? crianca.escala,
          deslocX: (alteracoes.deslocX as number) ?? crianca.deslocX,
          deslocY: (alteracoes.deslocY as number) ?? crianca.deslocY,
        },
      )
      alteracoes.dpi = veredicto.dpi
      alteracoes.nivel = veredicto.nivel
    }

    if (dados.confirmada !== undefined) {
      if (dados.confirmada) {
        if (!crianca.aprovada) {
          throw new BadRequestException('Não é possível aprovar sem uma foto aprovada.')
        }
        if (!nomeFinal.trim()) {
          throw new BadRequestException('Escreva o nome da criança antes de aprovar.')
        }
      }
      alteracoes.confirmada = dados.confirmada
    }

    // Qualquer mexida invalida o PDF que já tenha sido gerado.
    if (Object.keys(alteracoes).length > 0) {
      await this.armazenamento.apagar(crianca.pdfPath)
      alteracoes.pdfPath = null
      await this.prisma.criancaDoPedido.update({ where: { id: criancaId }, data: alteracoes })
    }

    if (dados.selecionada !== undefined) await this.recalcularTotais(pedidoId)

    // Mexer apaga o PDF, por isso o pedido pode ter deixado de estar pronto.
    if (Object.keys(alteracoes).length > 0) await this.marcarProntoSePuder(pedidoId)

    // Já paga e agora aprovada: o ficheiro pode nascer.
    if (dados.confirmada === true && pedido.estado === EstadoDoPedido.PAGO) {
      await this.gerarPdfDaCrianca(criancaId).catch((erro) =>
        this.logger.error(`Falha ao gerar PDF de ${criancaId}: ${String(erro)}`),
      )
    }

    return this.paraEcra(pedidoId)
  }

  private async recalcularTotais(pedidoId: string) {
    const pedido = await this.prisma.pedidoDeCartoes.findUniqueOrThrow({
      where: { id: pedidoId },
      include: { criancas: true },
    })

    const preco = calcularPreco(pedido.criancas.filter((c) => c.selecionada).length, {
      precoUnitarioCent: pedido.precoUnitarioCent,
      descontoPercentagem: pedido.descontoPercentagem,
      descontoAPartirDe: 2,
    })

    await this.prisma.pedidoDeCartoes.update({
      where: { id: pedidoId },
      data: {
        subtotalCent: preco.subtotalCent,
        descontoCent: preco.descontoCent,
        totalCent: preco.totalCent,
      },
    })
  }

  // ─────────────────────────────────────────────────────────────────
  // PAGAMENTO
  // ─────────────────────────────────────────────────────────────────

  async iniciarPagamento(pedidoId: string, meio: MeioDePagamento) {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({
      where: { id: pedidoId },
      include: { criancas: true },
    })
    if (!pedido) throw new NotFoundException('Pedido não encontrado.')
    if (pedido.estado === EstadoDoPedido.PAGO || pedido.estado === EstadoDoPedido.PRONTO) {
      throw new BadRequestException('Este pedido já está pago.')
    }

    const escolhidas = pedido.criancas.filter((c) => c.selecionada && c.aprovada)
    if (escolhidas.length === 0) {
      throw new BadRequestException('Escolha pelo menos uma criança aprovada antes de pagar.')
    }

    await this.recalcularTotais(pedidoId)
    const actualizado = await this.prisma.pedidoDeCartoes.findUniqueOrThrow({
      where: { id: pedidoId },
    })

    const cobranca = await this.provedor.criarCobranca({
      pedidoId,
      totalCent: actualizado.totalCent,
      moeda: actualizado.moeda,
      meio,
      descricao: `Cartões personalizados — ${escolhidas.length} conjunto(s)`,
    })

    await this.prisma.pedidoDeCartoes.update({
      where: { id: pedidoId },
      data: {
        estado: EstadoDoPedido.AGUARDANDO_PAGAMENTO,
        meio,
        referenciaExterna: cobranca.referenciaExterna,
        pixCopiaECola: cobranca.pixCopiaECola ?? null,
        pixQrSvg: cobranca.pixQrSvg ?? null,
      },
    })

    return {
      ...(await this.paraEcra(pedidoId)),
      urlDeRedireccionamento: cobranca.urlDeRedireccionamento ?? null,
    }
  }

  /**
   * O aviso do provedor. É AQUI que o dinheiro passa a ser verdade.
   *
   * `idExterno` é único na base, por isso o segundo aviso igual bate no índice
   * e sai por aqui sem fazer nada. Os provedores reenviam quando não recebem
   * resposta a tempo, e um pedido que muda de estado duas vezes pelo mesmo
   * pagamento é a avaria que só aparece no extracto do cliente.
   */
  async registarAviso(aviso: AvisoDePagamento) {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({
      where: { referenciaExterna: aviso.referenciaExterna },
    })
    if (!pedido) {
      this.logger.warn(`Aviso para referência desconhecida: ${aviso.referenciaExterna}`)
      return { ignorado: true }
    }

    const jaVisto = await this.prisma.eventoDePagamento.findUnique({
      where: { idExterno: aviso.idExterno },
    })
    if (jaVisto) return { repetido: true }

    await this.prisma.eventoDePagamento.create({
      data: {
        pedidoId: pedido.id,
        idExterno: aviso.idExterno,
        tipo: aviso.tipo,
        bruto: aviso.bruto as Prisma.InputJsonValue,
      },
    })

    if (!aviso.pago) return { registado: true }
    if (pedido.estado === EstadoDoPedido.PAGO || pedido.estado === EstadoDoPedido.PRONTO) {
      return { repetido: true }
    }

    await this.prisma.pedidoDeCartoes.update({
      where: { id: pedido.id },
      data: {
        estado: EstadoDoPedido.PAGO,
        pagoEm: new Date(),
        // A partir daqui vale o prazo de entrega, não o de abandono.
        expiraEm: this.daquiADias(this.diasAteExpurgo),
      },
    })

    await this.gerarPdfsConfirmados(pedido.id)
    return { pago: true }
  }

  // ─────────────────────────────────────────────────────────────────
  // GERAÇÃO DO PDF
  // ─────────────────────────────────────────────────────────────────

  private async gerarPdfsConfirmados(pedidoId: string) {
    const criancas = await this.prisma.criancaDoPedido.findMany({
      where: { pedidoId, selecionada: true, confirmada: true, aprovada: true },
    })
    for (const c of criancas) {
      await this.gerarPdfDaCrianca(c.id).catch((erro) =>
        this.logger.error(`Falha ao gerar PDF de ${c.id}: ${String(erro)}`),
      )
    }
    await this.marcarProntoSePuder(pedidoId)
  }

  /**
   * Os 7 cartões de uma criança, num PDF.
   *
   * Uma fotografia, um nome, um enquadramento — e sete folhas. É literalmente o
   * que o cliente descreveu no passo 9 do documento dele, e o ciclo aqui em
   * baixo é essa frase escrita em código: o mesmo `ajuste` entra em todos os
   * modelos.
   */
  async gerarPdfDaCrianca(criancaId: string): Promise<void> {
    const crianca = await this.prisma.criancaDoPedido.findUnique({
      where: { id: criancaId },
      include: { pedido: true },
    })
    if (!crianca) throw new NotFoundException('Criança não encontrada.')
    /**
     * PAGO **ou** PRONTO, e a diferença já custou um defeito.
     *
     * `PRONTO` é o estado a que o pedido chega quando todos os ficheiros
     * saíram. Aceitar só `PAGO` parecia certo e partia exactamente o percurso
     * que o cliente descreveu no ponto 7: a mãe aprova, confere, carrega em
     * VOLTAR PARA CORRIGIR, muda o enquadramento e aprova outra vez. Nessa
     * altura o pedido já está em `PRONTO`, e a nova geração era recusada com
     * "o ficheiro só é gerado depois do pagamento" — a uma pessoa que tinha
     * pago minutos antes.
     *
     * O que esta linha guarda é uma coisa só: que ninguém recebe ficheiro sem
     * ter pago. Os dois estados significam pago.
     */
    const pago =
      crianca.pedido.estado === EstadoDoPedido.PAGO ||
      crianca.pedido.estado === EstadoDoPedido.PRONTO
    if (!pago) {
      throw new ForbiddenException('O ficheiro só é gerado depois do pagamento confirmado.')
    }
    if (!crianca.fotoPath || !crianca.fotoLargura || !crianca.fotoAltura) {
      throw new BadRequestException('Esta criança ainda não tem foto.')
    }

    const foto = await this.armazenamento.ler(crianca.fotoPath)
    if (!foto) throw new NotFoundException('A foto já não está disponível.')

    const modelos = await this.prisma.modeloDeCartao.findMany({
      where: { projectId: crianca.pedido.projectId, ativo: true },
      orderBy: [{ ordem: 'asc' }, { dia: 'asc' }],
    })

    const ajuste: Ajuste = {
      escala: crianca.escala,
      deslocX: crianca.deslocX,
      deslocY: crianca.deslocY,
    }

    const folhas: FolhaDoPdf[] = []
    for (const modelo of modelos) {
      const arte = await this.storage.lerParaImpressao(modelo.arteImpressaoUrl ?? modelo.arteUrl)
      if (!arte) {
        this.logger.warn(`Modelo ${modelo.slug} sem arte carregada; folha ignorada.`)
        continue
      }

      const imagem = await comporCartao({
        arte,
        foto,
        fotoLargura: crianca.fotoLargura,
        fotoAltura: crianca.fotoAltura,
        moldura: {
          fotoX: modelo.fotoX,
          fotoY: modelo.fotoY,
          fotoLargura: modelo.fotoLargura,
          fotoAltura: modelo.fotoAltura,
          fotoFormato: modelo.fotoFormato,
        },
        ajuste,
        dpi: DPI_DE_IMPRESSAO,
      })

      folhas.push({
        imagem,
        nome: crianca.nome,
        tamanhoDoNome: crianca.tamanhoDoNome,
        caixa: {
          nomeX: modelo.nomeX,
          nomeY: modelo.nomeY,
          nomeLargura: modelo.nomeLargura,
          nomeAltura: modelo.nomeAltura,
          nomeCorHex: modelo.nomeCorHex,
          nomeCorpoMinimo: modelo.nomeCorpoMinimo,
          nomeCorpoMaximo: modelo.nomeCorpoMaximo,
          nomeMaiusculas: modelo.nomeMaiusculas,
        },
      })
    }

    if (folhas.length === 0) {
      throw new BadRequestException('Nenhum modelo tem arte carregada. Cadastre as artes no painel.')
    }

    const pdf = await montarPdf(folhas)
    const caminho = await this.armazenamento.guardarPdf(crianca.pedidoId, criancaId, pdf)

    await this.prisma.criancaDoPedido.update({
      where: { id: criancaId },
      data: { pdfPath: caminho },
    })

    await this.marcarProntoSePuder(crianca.pedidoId)
  }

  private async marcarProntoSePuder(pedidoId: string) {
    const emFalta = await this.prisma.criancaDoPedido.count({
      where: { pedidoId, selecionada: true, confirmada: true, pdfPath: null },
    })
    const prontas = await this.prisma.criancaDoPedido.count({
      where: { pedidoId, selecionada: true, pdfPath: { not: null } },
    })

    const pedido = await this.prisma.pedidoDeCartoes.findUniqueOrThrow({
      where: { id: pedidoId },
      select: { estado: true },
    })
    if (pedido.estado !== EstadoDoPedido.PAGO && pedido.estado !== EstadoDoPedido.PRONTO) return

    /**
     * O estado anda nos dois sentidos.
     *
     * Voltar a `PAGO` quando falta um ficheiro é o que mantém a palavra
     * "pronto" verdadeira: a mãe que carrega em corrigir tem um cartão por
     * gerar outra vez, e o ecrã não lhe pode dizer que está tudo pronto.
     */
    const alvo = emFalta === 0 && prontas > 0 ? EstadoDoPedido.PRONTO : EstadoDoPedido.PAGO
    if (alvo !== pedido.estado) {
      await this.prisma.pedidoDeCartoes.update({
        where: { id: pedidoId },
        data: {
          estado: alvo,
          ...(alvo === EstadoDoPedido.PRONTO ? { prontoEm: new Date() } : {}),
        },
      })
    }
  }

  /**
   * O PDF, só depois de pago.
   *
   * A verificação está aqui, no serviço, e não no ecrã: o botão desenhado a
   * cinzento não impede ninguém de escrever o endereço à mão.
   */
  async pdfDaCrianca(pedidoId: string, criancaId: string): Promise<{ nome: string; conteudo: Buffer }> {
    const crianca = await this.prisma.criancaDoPedido.findFirst({
      where: { id: criancaId, pedidoId },
      include: { pedido: true },
    })
    if (!crianca) throw new NotFoundException('Cartões não encontrados.')

    const pago =
      crianca.pedido.estado === EstadoDoPedido.PAGO ||
      crianca.pedido.estado === EstadoDoPedido.PRONTO
    if (!pago) {
      throw new ForbiddenException('Os cartões ficam disponíveis assim que o pagamento for confirmado.')
    }

    if (!crianca.pdfPath) await this.gerarPdfDaCrianca(criancaId)

    const actual = await this.prisma.criancaDoPedido.findUniqueOrThrow({ where: { id: criancaId } })
    const conteudo = await this.armazenamento.ler(actual.pdfPath)
    if (!conteudo) {
      throw new NotFoundException(
        'Este ficheiro já foi apagado. O prazo de download terminou.',
      )
    }

    /**
     * O nome do ficheiro, sem acentos e sem os deixar virar traços.
     *
     * O `NFD` separa a letra do acento — "ã" passa a "a" + "~" — e é preciso
     * APAGAR os acentos soltos antes de trocar o resto por traços. Sem essa
     * linha do meio, "João Ção" saía como "joa-o-c-a-o": o til contava como
     * caractere estranho e partia a palavra ao meio. Nomes brasileiros levam
     * acentos quase sempre, por isso este é o caso normal e não a excepção.
     */
    const limpo = (crianca.nome || 'cartoes')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
    return { nome: `cartoes-${limpo || 'crianca'}.pdf`, conteudo }
  }

  /**
   * Uma prévia gerada pelo servidor, em baixa resolução.
   *
   * Não é o que a mãe vê enquanto arrasta — isso é o navegador, e tem de ser,
   * senão o editor fica lento. Serve para conferir, a partir do painel, que a
   * conta do servidor e a do navegador dão o mesmo. No dia em que divergirem,
   * é aqui que se vê.
   */
  async previa(pedidoId: string, criancaId: string, modeloId: string): Promise<Buffer> {
    const crianca = await this.prisma.criancaDoPedido.findFirst({
      where: { id: criancaId, pedidoId },
    })
    if (!crianca?.fotoPath || !crianca.fotoLargura || !crianca.fotoAltura) {
      throw new NotFoundException('Esta criança ainda não tem foto.')
    }

    const modelo = await this.prisma.modeloDeCartao.findUnique({ where: { id: modeloId } })
    if (!modelo) throw new NotFoundException('Modelo não encontrado.')

    const [arte, foto] = await Promise.all([
      this.storage.lerPelaUrl(modelo.arteUrl ?? modelo.arteImpressaoUrl),
      this.armazenamento.ler(crianca.fotoPath),
    ])
    if (!arte) throw new NotFoundException('Este modelo ainda não tem arte carregada.')

    return comporCartao({
      arte,
      foto,
      fotoLargura: crianca.fotoLargura,
      fotoAltura: crianca.fotoAltura,
      moldura: {
        fotoX: modelo.fotoX,
        fotoY: modelo.fotoY,
        fotoLargura: modelo.fotoLargura,
        fotoAltura: modelo.fotoAltura,
        fotoFormato: modelo.fotoFormato,
      },
      ajuste: { escala: crianca.escala, deslocX: crianca.deslocX, deslocY: crianca.deslocY },
      dpi: 96,
    })
  }

  // ─────────────────────────────────────────────────────────────────
  // PARTILHA: WHATSAPP, E-MAIL, IMPRESSÃO
  // ─────────────────────────────────────────────────────────────────

  /**
   * O endereço que a mãe envia a quem quiser.
   *
   * O prazo é o do próprio pedido, e não um prazo à parte. Uma ligação que
   * durasse mais do que o ficheiro abriria numa página de erro na gráfica; uma
   * que durasse menos tirar-lhe-ia dias que lhe foram prometidos.
   */
  async ligacaoDePartilha(pedidoId: string, criancaId: string) {
    const crianca = await this.prisma.criancaDoPedido.findFirst({
      where: { id: criancaId, pedidoId },
      include: { pedido: { include: { project: { select: { slug: true } } } } },
    })
    if (!crianca) throw new NotFoundException('Cartões não encontrados.')

    const pago =
      crianca.pedido.estado === EstadoDoPedido.PAGO ||
      crianca.pedido.estado === EstadoDoPedido.PRONTO
    if (!pago) {
      throw new ForbiddenException('A partilha fica disponível depois do pagamento confirmado.')
    }

    const ficha = criarFicha(this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), {
      pedidoId,
      criancaId,
      expiraEm: Math.floor(crianca.pedido.expiraEm.getTime() / 1000),
    })

    const base = this.config.getOrThrow<string>('PUBLIC_API_URL').replace(/\/$/, '')
    const url = `${base}/api/cartoes/partilha/${ficha}`

    return {
      url,
      expiraEm: crianca.pedido.expiraEm,
      nome: crianca.nome,
      /**
       * O texto do WhatsApp vai daqui e não do navegador.
       *
       * O ecrã só monta `wa.me/?text=`. Escrever a frase aqui é o que impede
       * que o botão do WhatsApp e o corpo do e-mail digam coisas diferentes
       * sobre o mesmo ficheiro — e que só um deles avise do prazo.
       */
      textoParaWhatsApp:
        `Os cartões personalizados de ${crianca.nome || 'nossa criança'} estão prontos! ` +
        `Baixe o PDF para imprimir: ${url}`,
    }
  }

  /** Serve o PDF a quem tiver uma ficha válida. Sem sessão nenhuma. */
  async pdfPorFicha(ficha: string) {
    const conteudo = lerFicha(this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), ficha)
    if (!conteudo) {
      throw new NotFoundException(
        'Este link não é válido ou o prazo terminou. Peça um novo a quem o enviou.',
      )
    }
    return this.pdfDaCrianca(conteudo.pedidoId, conteudo.criancaId)
  }

  /**
   * Envia a ligação por e-mail.
   *
   * O ficheiro NÃO vai anexado, e é decisão e não limitação: um PDF de impressão
   * passa facilmente do que muitos servidores aceitam, e um anexo é uma cópia a
   * mais da fotografia de uma criança — numa caixa de correio, fora do nosso
   * prazo de expurgo, para sempre. A ligação morre com o ficheiro; o anexo não
   * morre nunca.
   */
  async enviarPorEmail(pedidoId: string, criancaId: string, para: string) {
    const ligacao = await this.ligacaoDePartilha(pedidoId, criancaId)

    if (!this.mail.activo) {
      // Sem serviço de e-mail configurado, devolve-se a ligação para o ecrã a
      // mostrar. Falhar em silêncio seria pior: ela ficaria à espera de um
      // e-mail que nunca ia chegar.
      this.logger.warn('Sem BREVO_API_KEY: a ligação foi devolvida ao ecrã em vez de enviada.')
      return { enviado: false, url: ligacao.url, motivo: 'sem-servico-de-email' as const }
    }

    const quando = ligacao.expiraEm.toLocaleDateString('pt-BR')
    await this.mail.enviar({
      para,
      assunto: `Os cartões de ${ligacao.nome || 'sua criança'} estão prontos`,
      texto:
        `Os cartões personalizados estão prontos para imprimir.\n\n${ligacao.url}\n\n` +
        `O arquivo fica disponível até ${quando}. Depois disso é apagado dos nossos servidores.`,
      html:
        `<p>Os cartões personalizados de <strong>${ligacao.nome}</strong> estão prontos para imprimir.</p>` +
        `<p><a href="${ligacao.url}">Baixar o PDF com os cartões</a></p>` +
        `<p style="color:#666;font-size:14px">O arquivo fica disponível até ${quando}. ` +
        `Depois disso é apagado dos nossos servidores.</p>`,
    })

    return { enviado: true, url: ligacao.url }
  }

  /** A fotografia que a mãe enviou, para o editor a desenhar. */
  async fotoDaCrianca(pedidoId: string, criancaId: string): Promise<Buffer> {
    const crianca = await this.prisma.criancaDoPedido.findFirst({
      where: { id: criancaId, pedidoId },
    })
    const conteudo = await this.armazenamento.ler(crianca?.fotoPath)
    if (!conteudo) throw new NotFoundException('Foto não encontrada.')
    return conteudo
  }

  // ─────────────────────────────────────────────────────────────────
  // AUXILIARES
  // ─────────────────────────────────────────────────────────────────

  private async projeto(slug: string) {
    const projeto = await this.prisma.project.findUnique({ where: { slug } })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')
    return projeto
  }

  /**
   * A moldura contra a qual a qualidade é medida.
   *
   * O cliente garantiu que os 7 modelos têm exactamente o mesmo espaço para a
   * fotografia, e é por isso que um enquadramento serve os sete. Mas garantir
   * não é impedir: se um dia um modelo entrar com a moldura maior, medir contra
   * a menor aprovaria uma fotografia que sai borrada nesse. Por isso mede-se
   * contra a MAIOR moldura activa — a mais exigente — e o veredicto vale para
   * todos.
   */
  private async molduraDeReferencia(projectId: string) {
    const modelos = await this.prisma.modeloDeCartao.findMany({
      where: { projectId, ativo: true },
      select: { fotoLargura: true, fotoAltura: true },
    })
    if (modelos.length === 0) {
      throw new BadRequestException('Este projeto ainda não tem modelos de cartão.')
    }
    return {
      fotoLargura: Math.max(...modelos.map((m) => m.fotoLargura)),
      fotoAltura: Math.max(...modelos.map((m) => m.fotoAltura)),
    }
  }

  private async criancaEditavel(pedidoId: string, criancaId: string) {
    const crianca = await this.prisma.criancaDoPedido.findFirst({
      where: { id: criancaId, pedidoId },
      include: { pedido: true },
    })
    if (!crianca) throw new NotFoundException('Criança não encontrada neste pedido.')
    if (crianca.pedido.estado === EstadoDoPedido.EXPIRADO) {
      throw new ForbiddenException('Este pedido expirou.')
    }
    return { pedido: crianca.pedido, crianca }
  }

  private async criancaParaEcra(criancaId: string) {
    const c = await this.prisma.criancaDoPedido.findUniqueOrThrow({ where: { id: criancaId } })
    return {
      id: c.id,
      ordem: c.ordem,
      nome: c.nome,
      temFoto: Boolean(c.fotoPath),
      fotoLargura: c.fotoLargura,
      fotoAltura: c.fotoAltura,
      ajuste: { escala: c.escala, deslocX: c.deslocX, deslocY: c.deslocY },
      tamanhoDoNome: c.tamanhoDoNome,
      dpi: c.dpi,
      nivel: c.nivel,
      aprovada: c.aprovada,
      selecionada: c.selecionada,
      confirmada: c.confirmada,
      temPdf: Boolean(c.pdfPath),
    }
  }

  private daquiAHoras(horas: number): Date {
    return new Date(Date.now() + horas * 60 * 60 * 1000)
  }

  private daquiADias(dias: number): Date {
    return new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
  }
}
