import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomInt, timingSafeEqual } from 'node:crypto'
import { access } from 'node:fs/promises'
import { EstadoDoPedido, MeioDePagamento, type Prisma } from '@pv/db'
import { calcularPreco } from '@pv/cartoes'
import { PrismaService } from '../prisma/prisma.service'
import { nomeParaImpressao, StorageService } from '../admin/storage.service'
import {
  ProvedorDePagamento,
  type AvisoDePagamento,
  type CartaoTokenizado,
  type CobrancaPedida,
} from './pagamentos/provedor'
import { MailService } from '../common/mail/mail.service'
import { AfiliadosService } from '../afiliados/afiliados.service'
import { MosaicoDaArteService } from './mosaico-da-arte.service'

/** O máximo de crianças num pedido. Acima disto é gráfica, não é família. */
const MAXIMO_DE_CRIANCAS = 10

/**
 * A frase que o cliente aceita antes de pagar, guardada tal e qual no pedido.
 * É a mesma que o ecrã mostra; se um dia mudar, os pedidos antigos continuam a
 * dizer o que foi aceite na altura.
 */
const TEXTO_DA_APROVACAO =
  'Confirmo que revisei e aprovei o nome e a foto dos meus cartões. ' +
  'Produto personalizado. Não há devolução após o pagamento.'

/** A caixa do responsável (LGPD, art. 14), igual à do ecrã — ver `ConfirmarPersonalizacao`. */
const TEXTO_DO_CONSENTIMENTO =
  'Sou o pai, a mãe ou o responsável legal pela criança e autorizo usar a foto dela apenas ' +
  'para gerar este PDF, neste aparelho.'

/** As letras do código de liberação: sem 0/O, 1/I/L, que se confundem ao ditar. */
const ALFABETO_DO_CODIGO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Um id de pedido, antes de o levar à base: o `external_reference` vem de fora. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** "k7qm 2xpa", "K7QM2XPA" → "K7QM-2XPA". */
function normalizarCodigo(codigo: string): string {
  const limpo = (codigo ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  return limpo.length === 8 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : limpo
}

@Injectable()
export class CartoesService {
  private readonly logger = new Logger(CartoesService.name)
  private readonly diasAteExpurgo: number
  private readonly horasAteAbandono: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly provedor: ProvedorDePagamento,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly afiliados: AfiliadosService,
    private readonly mosaicos: MosaicoDaArteService,
  ) {
    this.diasAteExpurgo = this.config.get<number>('CARTOES_DIAS_ATE_EXPURGO') ?? 7
    this.horasAteAbandono = this.config.get<number>('CARTOES_HORAS_ATE_ABANDONO') ?? 48
  }

  // ─────────────────────────────────────────────────────────────────
  // MODELOS E PREÇO
  // ─────────────────────────────────────────────────────────────────

  /**
   * Os modelos activos de um idioma.
   *
   * `pt-BR` por omissão porque é a primeira versão. Quando as artes noutras
   * línguas entrarem, é este parâmetro que escolhe o conjunto — sem tocar em
   * mais nada.
   */
  async modelos(projectSlug: string, idioma = 'pt-BR', categoriaSlug?: string) {
    const projeto = await this.projeto(projectSlug)
    const categoria = await this.categoriaEscolhida(projeto.id, categoriaSlug, idioma).catch(
      () => null,
    )
    if (!categoria) return []
    const modelos = await this.prisma.modeloDeCartao.findMany({
      where: { projectId: projeto.id, categoriaId: categoria.id, ativo: true, idioma },
      orderBy: [{ ordem: 'asc' }, { dia: 'asc' }],
    })

    return modelos.map((m) => ({
      id: m.id,
      slug: m.slug,
      dia: m.dia,
      nome: m.nome,
      idioma: m.idioma,
      arteUrl: m.arteUrl,
      arteLupaUrl: m.arteLupaUrl,
      /**
       * O PDF do designer, para o ecrã o desenhar tal como é (ver `ArteEmPdf`
       * no site). Só quando a arte veio em PDF: nas carregadas como imagem, a
       * "de impressão" é a própria imagem, e já está em `arteUrl`.
       */
      artePdfUrl: m.arteImpressaoUrl && /\.pdf$/i.test(m.arteImpressaoUrl) ? m.arteImpressaoUrl : null,
      /**
       * O mesmo PDF desenhado no servidor, em ladrilhos, para a lupa (ver
       * `MosaicoDaArteService`). Nulo até estarem prontos.
       */
      arteMosaico: this.mosaicos.de(m.arteImpressaoUrl),
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

  /**
   * As categorias que o editor oferece: Crianças, Adultos, e as que vierem.
   *
   * Só aparecem as activas QUE TÊM pelo menos um cartão activo no idioma. É
   * isso que permite ao cliente criar a categoria "Adultos" hoje, sem artes
   * ainda: ela fica escondida até o primeiro cartão entrar, e aparece sozinha
   * nesse dia. Uma categoria vazia no ecrã seria uma porta para lado nenhum.
   */
  async categorias(projectSlug: string, idioma = 'pt-BR') {
    const projeto = await this.projeto(projectSlug)
    const precoDoProjeto = await this.precoDoProjeto(projeto.id)
    const categorias = await this.prisma.categoriaDeCartoes.findMany({
      where: { projectId: projeto.id, ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      include: { _count: { select: { modelos: { where: { ativo: true, idioma } } } } },
    })

    return categorias
      .filter((c) => c._count.modelos > 0)
      .map((c) => ({
        slug: c.slug,
        nome: c.nome,
        descricao: c.descricao,
        capaUrl: c.capaUrl,
        // A porta fechada e a voz dele. Ver `ofertaEmBreve` no schema.
        emBreve: c.ofertaEmBreve,
        audioUrl: c.ofertaAudioUrl,
        rotuloSingular: c.rotuloSingular,
        rotuloPlural: c.rotuloPlural,
        cartoes: c._count.modelos,
        preco: this.precoEfetivo(c, precoDoProjeto),
      }))
  }

  /**
   * A categoria de um pedido novo.
   *
   * Sem slug, vale a primeira categoria com cartões — é o que mantém a
   * funcionar tudo o que foi escrito antes de haver categorias, incluindo os
   * percursos de verificação.
   */
  private async categoriaEscolhida(projectId: string, slug: string | undefined, idioma: string) {
    const categorias = await this.prisma.categoriaDeCartoes.findMany({
      where: { projectId, ativo: true, ...(slug ? { slug } : {}) },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      include: { _count: { select: { modelos: { where: { ativo: true, idioma } } } } },
    })
    const comCartoes = categorias.find((c) => c._count.modelos > 0)
    if (!comCartoes) {
      throw new BadRequestException(
        slug
          ? 'Esta categoria ainda não tem cartões disponíveis.'
          : 'Este projeto ainda não tem cartões cadastrados no painel.',
      )
    }
    return comCartoes
  }

  /**
   * O preço de uma categoria: o dela, se o tiver, senão o do projeto.
   *
   * Campo a campo, e não tudo ou nada. Os cartões de adultos podem ter outro
   * preço e o mesmo desconto, e obrigar a repetir o desconto só para mudar o
   * preço seria mais um sítio para os dois ficarem diferentes sem querer.
   */
  private precoEfetivo(
    categoria: {
      precoUnitarioCent: number | null
      descontoPercentagem: number | null
      descontoAPartirDe: number | null
      precoDeTabelaCent: number | null
    },
    projeto: {
      precoUnitarioCent: number
      descontoPercentagem: number
      descontoAPartirDe: number
      precoDeTabelaCent: number | null
      moeda: string
    },
  ) {
    const aCobrar = categoria.precoUnitarioCent ?? projeto.precoUnitarioCent
    const deTabela = categoria.precoDeTabelaCent ?? projeto.precoDeTabelaCent

    return {
      precoUnitarioCent: aCobrar,
      /*
        O RISCADO SÓ SAI SE FOR MAIOR QUE O QUE SE COBRA.

        A regra vive aqui, no servidor, e não no ecrã: se estivesse no ecrã,
        bastava um segundo ecrã — o resumo do pedido, o recibo — esquecê-la para
        um dos dois mostrar "de R$ 30 por R$ 49". Um preço riscado abaixo do
        preço é uma mentira ao contrário, e na loja dele isso é CDC.
      */
      precoDeTabelaCent: deTabela && deTabela > aCobrar ? deTabela : null,
      descontoPercentagem: categoria.descontoPercentagem ?? projeto.descontoPercentagem,
      descontoAPartirDe: categoria.descontoAPartirDe ?? projeto.descontoAPartirDe,
      moeda: projeto.moeda,
    }
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

  async criarPedido(
    projectSlug: string,
    quantidade: number,
    userId?: string,
    categoriaSlug?: string,
    idioma = 'pt-BR',
    anonId?: string | null,
  ) {
    if (quantidade < 1 || quantidade > MAXIMO_DE_CRIANCAS) {
      throw new BadRequestException(`Escolha entre 1 e ${MAXIMO_DE_CRIANCAS}.`)
    }

    const projeto = await this.projeto(projectSlug)
    const categoria = await this.categoriaEscolhida(projeto.id, categoriaSlug, idioma)
    const preco = this.precoEfetivo(categoria, await this.precoDoProjeto(projeto.id))

    /*
      A QUEM PERTENCE ESTA VENDA decide-se aqui, quando o pedido nasce: ao
      último link de afiliado que esta pessoa abriu. Ver
      `AfiliadosService.atribuir`. Uma falha nunca impede a compra — a venda
      fica "direta", que é o que ela seria sem programa de afiliados.
    */
    const afiliadoId = await this.afiliados
      .atribuir({ anonId: anonId ?? null, userId: userId ?? null })
      .catch((erro) => {
        this.logger.error(`Atribuição ao afiliado falhou: ${String(erro)}`)
        return null
      })

    const pedido = await this.prisma.pedidoDeCartoes.create({
      data: {
        projectId: projeto.id,
        categoriaId: categoria.id,
        idioma,
        userId: userId ?? null,
        afiliadoId,
        precoUnitarioCent: preco.precoUnitarioCent,
        precoDeTabelaCent: preco.precoDeTabelaCent,
        descontoPercentagem: preco.descontoPercentagem,
        descontoAPartirDe: preco.descontoAPartirDe,
        moeda: preco.moeda,
        expiraEm: this.daquiAHoras(this.horasAteAbandono),
        criancas: {
          // Cada criança do pedido é um conjunto a pagar. Desde 03/10 não há
          // foto a aprovar no servidor que decida quais seguem: seguem todas.
          create: Array.from({ length: quantidade }, (_, i) => ({ ordem: i + 1, selecionada: true })),
        },
      },
      include: { criancas: { orderBy: { ordem: 'asc' } } },
    })

    return this.paraEcra(pedido.id)
  }

  /**
   * O pedido como o ecrã precisa dele: o preço, o pagamento, e o código de
   * liberação depois de pago. Nada da criança — o servidor não o tem.
   */
  async paraEcra(pedidoId: string) {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({
      where: { id: pedidoId },
      include: {
        criancas: { orderBy: { ordem: 'asc' } },
        project: { select: { slug: true } },
        categoria: {
          select: { slug: true, nome: true, rotuloSingular: true, rotuloPlural: true },
        },
      },
    })
    if (!pedido) throw new NotFoundException('Pedido não encontrado.')

    const preco = calcularPreco(pedido.criancas.filter((c) => c.selecionada).length, {
      precoUnitarioCent: pedido.precoUnitarioCent,
      descontoPercentagem: pedido.descontoPercentagem,
      descontoAPartirDe: pedido.descontoAPartirDe,
    })

    /*
      O RISCADO DO PEDIDO INTEIRO, e não o de um conjunto.

      Dois conjuntos a R$ 49 valem R$ 98 de tabela a R$ 79, e mostrar R$ 79 ao
      lado de um total de R$ 68,60 não diz nada a ninguém. Multiplica-se pela
      mesma quantidade que o subtotal usou, para os dois números falarem da mesma
      compra. Nulo quando não há riscado ou quando ele não ficaria acima do que se
      cobra — ver a nota em `precoEfetivo`.
    */
    const tabelaCent = pedido.precoDeTabelaCent
      ? pedido.precoDeTabelaCent * preco.quantidade
      : null
    const deTabelaCent = tabelaCent && tabelaCent > preco.totalCent ? tabelaCent : null

    return {
      id: pedido.id,
      numero: pedido.numero,
      projectSlug: pedido.project.slug,
      categoria: pedido.categoria,
      idioma: pedido.idioma,
      estado: pedido.estado,
      moeda: pedido.moeda,
      preco: { ...preco, deTabelaCent },
      meio: pedido.meio,
      pixCopiaECola: pedido.pixCopiaECola,
      pixQrSvg: pedido.pixQrSvg,
      pagoEm: pedido.pagoEm,
      expiraEm: pedido.expiraEm,
      /*
        O CÓDIGO SÓ SAI A QUEM TEM O PEDIDO ABERTO, E SÓ DEPOIS DE PAGO.

        Quem tem o número do pedido é quem o fez (está no aparelho dela, ou na
        ligação do e-mail dela). Devolvê-lo aqui é o que deixa o ecrã gerar o
        PDF logo que o Pix confirma, sem ela ter de ir buscar o código ao e-mail.
      */
      codigoDeLiberacao:
        pedido.pagoEm && pedido.estado !== EstadoDoPedido.EXPIRADO ? pedido.codigoDeLiberacao : null,
      gerado: Boolean(pedido.prontoEm),
      criancas: pedido.criancas.map((c) => ({ id: c.id, ordem: c.ordem })),
    }
  }

  private async recalcularTotais(pedidoId: string) {
    const pedido = await this.prisma.pedidoDeCartoes.findUniqueOrThrow({
      where: { id: pedidoId },
      include: { criancas: true },
    })

    const preco = calcularPreco(pedido.criancas.filter((c) => c.selecionada).length, {
      precoUnitarioCent: pedido.precoUnitarioCent,
      descontoPercentagem: pedido.descontoPercentagem,
      descontoAPartirDe: pedido.descontoAPartirDe,
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

  async iniciarPagamento(
    pedidoId: string,
    meio: MeioDePagamento,
    emailDoPagador: string,
    aprovou: boolean,
    consentiu: boolean,
    sessao: { userId?: string | null; anonId?: string | null } = {},
  ) {
    const preparo = await this.prepararPagamento(pedidoId, meio, emailDoPagador, aprovou, consentiu, sessao)
    const cobranca = await this.provedor.criarCobranca(preparo.cobranca)
    await this.gravarCobranca(preparo, cobranca)

    return {
      ...(await this.paraEcra(pedidoId)),
      urlDeRedireccionamento: cobranca.urlDeRedireccionamento ?? null,
    }
  }

  /** Há formulário de cartão na página? E com que chave pública. */
  configuracaoDoPagamento() {
    return { chavePublicaDoCartao: this.provedor.chavePublica() }
  }

  /**
   * O CARTÃO DIGITADO NA PÁGINA (06/10) — ver `cobrarCartao` no provedor.
   *
   * As mesmas portas do Pix (aprovação, responsável, pedido por pagar), e a
   * mesma gravação. A diferença está no fim: o cartão responde na hora.
   * Aprovado, regista-se já o aviso — o mesmo que o webhook traria, com o mesmo
   * id, e que por isso o webhook depois encontra repetido. Recusado, o pedido
   * fica como estava: a pessoa lê porquê e tenta outro cartão ou o Pix.
   */
  async pagarComCartao(
    pedidoId: string,
    cartao: CartaoTokenizado,
    emailDoPagador: string,
    aprovou: boolean,
    consentiu: boolean,
    sessao: { userId?: string | null; anonId?: string | null } = {},
  ) {
    if (!this.provedor.chavePublica()) {
      throw new BadRequestException('O pagamento com cartão nesta página ainda não está ativo.')
    }
    const preparo = await this.prepararPagamento(
      pedidoId,
      MeioDePagamento.CARTAO,
      emailDoPagador,
      aprovou,
      consentiu,
      sessao,
    )
    const resultado = await this.provedor.cobrarCartao(preparo.cobranca, cartao)
    if (resultado.situacao === 'RECUSADO' || !resultado.referenciaExterna) {
      throw new BadRequestException(resultado.motivo ?? 'O pagamento foi recusado. Tente outro cartão ou pague com Pix.')
    }

    await this.gravarCobranca(preparo, { referenciaExterna: resultado.referenciaExterna })
    if (resultado.aviso) {
      // O dinheiro entrou. Se registar falhar agora, o webhook da mesma order
      // chega depois e faz o mesmo — a pessoa não pode ver um erro de cobrança.
      await this.registarAviso(resultado.aviso).catch((erro) =>
        this.logger.error(`Pedido ${pedidoId}: cartão aprovado, registo adiado para o aviso: ${String(erro)}`),
      )
    }

    return {
      ...(await this.paraEcra(pedidoId)),
      situacao: resultado.situacao,
      motivo: resultado.motivo ?? null,
    }
  }

  /**
   * Tudo o que se confere e se calcula antes de pedir dinheiro, igual para os
   * dois meios: a aprovação, o responsável, o pedido por pagar, o número, quem
   * compra e de que afiliado veio. Não grava nada: ver `gravarCobranca`.
   */
  private async prepararPagamento(
    pedidoId: string,
    meio: MeioDePagamento,
    emailDoPagador: string,
    aprovou: boolean,
    consentiu: boolean,
    sessao: { userId?: string | null; anonId?: string | null },
  ) {
    /*
      SEM A APROVAÇÃO, NÃO HÁ COBRANÇA.

      Pedido dele em 25/09, para evitar cancelamentos depois de o cliente já ter
      recebido um produto que só serve para aquela criança: antes de pagar, o
      cliente confirma que revisou o nome e a foto. A verificação vive aqui, e
      não só no ecrã, para que nenhum caminho — um ecrã antigo em cache, uma
      chamada directa — chegue ao Mercado Pago sem ela.
    */
    if (!aprovou) {
      throw new BadRequestException(
        'Confirme que revisou e aprovou o nome e a foto antes de pagar.',
      )
    }
    // E a do responsável, desde 03/10: são dados de criança (LGPD, art. 14).
    if (!consentiu) {
      throw new BadRequestException('Confirme que é o responsável pela criança antes de pagar.')
    }

    const pedido = await this.prisma.pedidoDeCartoes.findUnique({
      where: { id: pedidoId },
      include: { criancas: true, project: { select: { slug: true } } },
    })
    if (!pedido) throw new NotFoundException('Pedido não encontrado.')
    if (pedido.estado === EstadoDoPedido.PAGO || pedido.estado === EstadoDoPedido.PRONTO) {
      throw new BadRequestException('Este pedido já está pago.')
    }

    // A foto é avaliada no aparelho, que não deixa seguir sem ela. Aqui conta-se
    // quantos conjuntos se pagam, e mais nada.
    const escolhidas = pedido.criancas.filter((c) => c.selecionada)
    if (escolhidas.length === 0) {
      throw new BadRequestException('Este pedido não tem cartões a pagar.')
    }

    await this.recalcularTotais(pedidoId)
    const actualizado = await this.prisma.pedidoDeCartoes.findUniqueOrThrow({
      where: { id: pedidoId },
    })

    // O número nasce no primeiro pagamento e fica: ver `numero` no schema.
    const numero = actualizado.numero ?? (await this.proximoNumero())

    /*
      QUEM COMPRA.

      Com sessão, o pedido fica da conta — também quando foi começado antes de
      a pessoa entrar. É a compra com conta que libera a área de afiliado, e a
      mãe que entra só no passo de pagar não pode ficar sem ela por isso.
    */
    const donoId = pedido.userId ?? sessao.userId ?? null
    const dono = donoId
      ? await this.prisma.user.findUnique({ where: { id: donoId }, select: { displayName: true } })
      : null
    const afiliadoId = pedido.afiliadoId
      ? null
      : await this.afiliados
          .atribuir({ anonId: sessao.anonId ?? null, userId: donoId, email: emailDoPagador })
          .catch(() => null)

    const site = (this.config.get<string>('PUBLIC_WEB_URL') ?? '').replace(/\/+$/, '')
    const cobranca: CobrancaPedida = {
      pedidoId,
      totalCent: actualizado.totalCent,
      moeda: actualizado.moeda,
      meio,
      descricao: `Cartões personalizados — pedido #${numero} — ${escolhidas.length} conjunto(s)`,
      emailDoPagador,
      // De volta ao editor, que retoma o pedido sozinho e mostra o estado dele.
      urlDeRegresso: `${site}/${pedido.project.slug}/cartoes?pedido=${pedidoId}`,
      // A cobrança não sobrevive ao pedido: um Pix pago depois do prazo de
      // abandono cairia num pedido que já não existe para gerar.
      expiraEm: actualizado.expiraEm,
    }

    return {
      pedidoId,
      meio,
      numero,
      emailDoPagador,
      nomeDoComprador: dono?.displayName ?? null,
      // A conta entra no pedido se ele ainda não tinha dono.
      novoDono: !pedido.userId && sessao.userId ? sessao.userId : null,
      afiliadoId,
      cobranca,
    }
  }

  /** Grava no pedido a cobrança criada: a referência, e o QR quando é Pix. */
  private async gravarCobranca(
    preparo: Awaited<ReturnType<CartoesService['prepararPagamento']>>,
    cobranca: { referenciaExterna: string; pixCopiaECola?: string; pixQrSvg?: string },
  ) {
    await this.prisma.pedidoDeCartoes.update({
      where: { id: preparo.pedidoId },
      data: {
        estado: EstadoDoPedido.AGUARDANDO_PAGAMENTO,
        meio: preparo.meio,
        aprovacaoEm: new Date(),
        aprovacaoTexto: `${TEXTO_DA_APROVACAO} ${TEXTO_DO_CONSENTIMENTO}`,
        numero: preparo.numero,
        emailDoComprador: preparo.emailDoPagador.trim().toLowerCase().slice(0, 254),
        ...(preparo.nomeDoComprador ? { nomeDoComprador: preparo.nomeDoComprador.slice(0, 120) } : {}),
        ...(preparo.novoDono ? { userId: preparo.novoDono } : {}),
        ...(preparo.afiliadoId ? { afiliadoId: preparo.afiliadoId } : {}),
        referenciaExterna: cobranca.referenciaExterna,
        pixCopiaECola: cobranca.pixCopiaECola ?? null,
        pixQrSvg: cobranca.pixQrSvg ?? null,
      },
    })
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
    const pedido =
      (await this.prisma.pedidoDeCartoes.findUnique({
        where: { referenciaExterna: aviso.referenciaExterna },
      })) ??
      // Trocou de meio depois de criar esta cobrança: ver `pedidoId` no aviso.
      (aviso.pedidoId && UUID.test(aviso.pedidoId)
        ? await this.prisma.pedidoDeCartoes.findUnique({ where: { id: aviso.pedidoId } })
        : null)
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

    const devolvido = aviso.reembolsadoCent ?? 0
    let pagoAgora = false

    /*
      PAGO É TER `pagoEm`, E NÃO O `estado`.

      Isto perguntava pelo estado PAGO ou PRONTO. Mas o expurgo põe todo o
      pedido velho em EXPIRADO — e um aviso atrasado da mesma compra (a order
      depois do payment, por exemplo) voltava a pagá-lo, a gerar PDFs de
      fotografias já apagadas e, agora, a mexer na comissão. A data não muda.
    */
    if (aviso.pago && !pedido.pagoEm) {
      await this.prisma.pedidoDeCartoes.update({
        where: { id: pedido.id },
        data: {
          estado: EstadoDoPedido.PAGO,
          pagoEm: new Date(),
          // A partir daqui vale o prazo de entrega, não o de abandono.
          expiraEm: this.daquiADias(this.diasAteExpurgo),
          // O código de liberação: com ele o aparelho gera o PDF, até ao prazo.
          codigoDeLiberacao: pedido.codigoDeLiberacao ?? (await this.novoCodigo()),
        },
      })
      pagoAgora = true

      // Devolvido por inteiro no mesmo aviso: não há cartões a fazer.
      if (devolvido < pedido.totalCent) {
        await this.enviarCodigoPorEmail(pedido.id).catch((erro) =>
          this.logger.error(`E-mail do código do pedido ${pedido.id}: ${String(erro)}`),
        )
      }

      await this.afiliados
        .aoConfirmarPagamento(pedido.id, { taxaCent: aviso.taxaCent ?? null })
        .catch((erro) => this.logger.error(`Afiliados após o pagamento de ${pedido.id}: ${String(erro)}`))
    } else if (aviso.pago && aviso.taxaCent != null) {
      // A taxa verdadeira chegou depois de estimada.
      await this.afiliados.registarTaxa(pedido.id, aviso.taxaCent).catch(() => undefined)
    }

    const reembolsado = devolvido > 0 ? await this.registarReembolso(pedido.id, devolvido) : false

    if (pagoAgora) return { pago: true, reembolsado }
    if (reembolsado) return { reembolsado: true }
    return aviso.pago ? { repetido: true } : { registado: true }
  }

  /**
   * Um reembolso ou uma contestação, com o total devolvido até agora.
   *
   * Só sobe: um aviso atrasado de um reembolso parcial, a chegar depois do
   * total, não faz o pedido "desdevolver" dinheiro. E só num pedido pago —
   * não se devolve o que não entrou.
   */
  async registarReembolso(pedidoId: string, totalDevolvidoCent: number): Promise<boolean> {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({ where: { id: pedidoId } })
    if (!pedido?.pagoEm) return false
    const novo = Math.min(pedido.totalCent, Math.max(pedido.reembolsadoCent, Math.round(totalDevolvidoCent)))
    if (novo <= pedido.reembolsadoCent) return false

    await this.prisma.pedidoDeCartoes.update({
      where: { id: pedido.id },
      data: { reembolsadoCent: novo, reembolsadoEm: new Date() },
    })
    this.logger.warn(`Pedido ${pedido.numero ?? pedido.id}: reembolsado ${novo} de ${pedido.totalCent}.`)

    await this.afiliados
      .aoReembolsar(pedido.id)
      .catch((erro) => this.logger.error(`Comissão do reembolso de ${pedido.id}: ${String(erro)}`))
    return true
  }

  /** O número seguinte da sequência dos pedidos. */
  private async proximoNumero(): Promise<number> {
    const [linha] = await this.prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT nextval('pedidos_de_cartoes_numero_seq') AS n`
    return Number(linha.n)
  }

  // ─────────────────────────────────────────────────────────────────
  // A LIBERAÇÃO: O PDF É MONTADO NO TELEMÓVEL (03/10)
  // ─────────────────────────────────────────────────────────────────
  //
  // Até 03/10 o servidor recebia a foto, guardava-a, e montava aqui o PDF. O
  // cliente pediu o contrário, por escrito: "a foto não pode ser enviada ao
  // servidor", "o servidor guarda só pagamento e código de liberação". Por
  // isso o servidor deixou de ter foto, nome ou PDF de quem quer que seja, e
  // esta secção é tudo o que lhe sobrou do cartão: dar o código quando o
  // pagamento entra, e, contra esse código, dizer ao aparelho onde estão as
  // artes de impressão.

  /**
   * As artes de impressão do pedido, para o aparelho montar o PDF.
   *
   * Só com o código certo, num pedido pago, dentro do prazo, e não devolvido.
   * O que vai na resposta são endereços das artes — o PDF do designer, ou a
   * imagem de impressão —, e não há nada da criança no pedido nem na resposta.
   */
  async liberacao(pedidoId: string, codigo: string) {
    const pedido = await this.pedidoLiberado(pedidoId, codigo)

    // Só os cartões da categoria e do idioma comprados: sem este filtro, no dia
    // dos cartões de adultos, o PDF de uma criança sairia com catorze folhas.
    const modelos = await this.prisma.modeloDeCartao.findMany({
      where: {
        projectId: pedido.projectId,
        ativo: true,
        idioma: pedido.idioma,
        ...(pedido.categoriaId ? { categoriaId: pedido.categoriaId } : {}),
      },
      orderBy: [{ ordem: 'asc' }, { dia: 'asc' }],
      select: { id: true, arteUrl: true, arteImpressaoUrl: true },
    })

    const artes = await Promise.all(
      modelos.map(async (m) => ({ modeloId: m.id, arte: await this.arteDeImpressao(m) })),
    )
    return { expiraEm: pedido.expiraEm, artes }
  }

  /**
   * O aparelho avisa que gerou o PDF. É o que faz o painel dizer "concluído".
   *
   * Não leva o PDF, nem a foto, nem o nome: leva o código. O servidor fica a
   * saber que aconteceu, e mais nada.
   */
  async marcarGerado(pedidoId: string, codigo: string) {
    const pedido = await this.pedidoLiberado(pedidoId, codigo)
    if (!pedido.prontoEm || pedido.estado !== EstadoDoPedido.PRONTO) {
      await this.prisma.pedidoDeCartoes.update({
        where: { id: pedido.id },
        data: { estado: EstadoDoPedido.PRONTO, prontoEm: pedido.prontoEm ?? new Date() },
      })
    }
  }

  /**
   * O pedido, se o código abrir a porta: pago, dentro do prazo, não devolvido.
   *
   * O erro é o mesmo para pedido inexistente e código errado — dizer qual dos
   * dois falhou era ajudar quem tenta adivinhar.
   */
  private async pedidoLiberado(pedidoId: string, codigo: string) {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({ where: { id: pedidoId } })
    const dado = normalizarCodigo(codigo)
    const certo =
      pedido?.codigoDeLiberacao &&
      dado.length === pedido.codigoDeLiberacao.length &&
      timingSafeEqual(Buffer.from(dado), Buffer.from(pedido.codigoDeLiberacao))
    if (!pedido || !certo) throw new ForbiddenException('Código de liberação inválido.')
    if (!pedido.pagoEm) throw new ForbiddenException('O pagamento deste pedido ainda não foi confirmado.')
    if (pedido.estado === EstadoDoPedido.EXPIRADO || pedido.expiraEm <= new Date()) {
      throw new ForbiddenException('O prazo deste pedido terminou.')
    }
    if (pedido.reembolsadoCent >= pedido.totalCent && pedido.totalCent > 0) {
      throw new ForbiddenException('Este pedido foi reembolsado.')
    }
    return pedido
  }

  /**
   * A arte que vai para o papel, e nada mais.
   *
   * O PDF que o designer entregou, quando existe — vectorial, a qualidade
   * original que ele pediu duas vezes. Nas artes carregadas como imagem, a cópia
   * de impressão (até 2480px) se existir, senão a própria imagem.
   */
  private async arteDeImpressao(m: { arteUrl: string | null; arteImpressaoUrl: string | null }) {
    const endereco = m.arteImpressaoUrl ?? m.arteUrl
    if (!endereco) return null
    if (/\.pdf$/i.test(endereco.split('?')[0])) return { tipo: 'pdf' as const, url: endereco }
    const deImpressao = nomeParaImpressao(endereco)
    const caminho = this.storage.caminhoDaUrl(deImpressao)
    const existe = caminho ? await access(caminho).then(() => true, () => false) : false
    return { tipo: 'imagem' as const, url: existe ? deImpressao : endereco }
  }

  /** Um código novo, que ainda nenhum pedido tenha. */
  private async novoCodigo(): Promise<string> {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const letras = Array.from({ length: 8 }, () => ALFABETO_DO_CODIGO[randomInt(ALFABETO_DO_CODIGO.length)])
      const codigo = `${letras.slice(0, 4).join('')}-${letras.slice(4).join('')}`
      const usado = await this.prisma.pedidoDeCartoes.findUnique({
        where: { codigoDeLiberacao: codigo },
        select: { id: true },
      })
      if (!usado) return codigo
    }
    throw new Error('Não foi possível gerar um código de liberação único.')
  }

  /**
   * O e-mail do pagamento confirmado: o código e a ligação para gerar.
   *
   * Substitui o e-mail com a ligação para o PDF guardado, que deixou de
   * existir. Este não leva o nome da criança nem a foto — o servidor não os
   * tem — e serve para gerar os cartões noutro aparelho, ou outra vez, até ao
   * prazo. Se o envio falhar, o pagamento não falha: o código também está no
   * ecrã.
   */
  private async enviarCodigoPorEmail(pedidoId: string) {
    const pedido = await this.prisma.pedidoDeCartoes.findUnique({
      where: { id: pedidoId },
      include: { project: { select: { slug: true } } },
    })
    if (!pedido?.emailDoComprador || !pedido.codigoDeLiberacao || !this.mail.activo) return
    const site = (this.config.get<string>('PUBLIC_WEB_URL') ?? '').replace(/\/+$/, '')
    const url = `${site}/${pedido.project.slug}/cartoes?pedido=${pedido.id}&codigo=${encodeURIComponent(pedido.codigoDeLiberacao)}`
    const quando = pedido.expiraEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const numero = pedido.numero ? ` #${pedido.numero}` : ''
    await this.mail.enviar({
      para: pedido.emailDoComprador,
      assunto: `Pagamento confirmado — pedido${numero} dos cartões personalizados`,
      texto:
        `Seu pagamento foi confirmado.\n\nCódigo de liberação: ${pedido.codigoDeLiberacao}\n\n` +
        `Os cartões são gerados no seu aparelho: a foto não é enviada nem guardada. ` +
        `Se precisar gerar de novo, abra este link até ${quando} e escolha a foto:\n${url}`,
      html:
        `<p>Seu pagamento foi confirmado.</p>` +
        `<p>Código de liberação: <strong style="font-size:18px;letter-spacing:1px">${pedido.codigoDeLiberacao}</strong></p>` +
        `<p>Os cartões são gerados no seu aparelho: a foto não é enviada nem guardada.</p>` +
        `<p>Se precisar gerar de novo, até ${quando}: <a href="${url}">abrir e escolher a foto</a>.</p>`,
    })
  }

  // ─────────────────────────────────────────────────────────────────
  // AUXILIARES
  // ─────────────────────────────────────────────────────────────────

  private async projeto(slug: string) {
    const projeto = await this.prisma.project.findUnique({ where: { slug } })
    if (!projeto) throw new NotFoundException('Projeto não encontrado.')
    return projeto
  }

  private daquiAHoras(horas: number): Date {
    return new Date(Date.now() + horas * 60 * 60 * 1000)
  }

  private daquiADias(dias: number): Date {
    return new Date(Date.now() + dias * 24 * 60 * 60 * 1000)
  }
}
