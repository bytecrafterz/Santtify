import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import * as QRCode from 'qrcode'
import { MeioDePagamento } from '@pv/db'
import { assinaturaMercadoPagoValida } from './assinatura-mercadopago'
import {
  AvisoNaoAutenticado,
  ProvedorDePagamento,
  type AvisoDePagamento,
  type AvisoRecebido,
  type CobrancaCriada,
  type CobrancaPedida,
} from './provedor'

const API = 'https://api.mercadopago.com'

/** Prefixo da referência das cobranças de cartão. Ver `criarCobrancaDeCartao`. */
const CARTAO = 'cartao:'

/**
 * O Mercado Pago, na conta do cliente.
 *
 * DUAS APIS, UMA POR MEIO, e é de propósito:
 *
 *   - PIX pela API de Orders. O código "copia e cola" e o QR vêm na resposta e
 *     aparecem no NOSSO ecrã, que é o que já estava desenhado: a mãe paga sem
 *     sair da Santtify. Foi a API que o cliente escolheu ao criar a aplicação,
 *     e é a que o Mercado Pago mantém — a de Payments está a ser descontinuada.
 *
 *   - CARTÃO pelo Checkout Pro, a página de pagamento do próprio Mercado Pago.
 *     Os dados do cartão nunca passam por nós, e a página dele já trata de
 *     parcelas, de 3-D Secure e dos bancos que pedem confirmação. Fazer isso
 *     aqui dentro era trazer para a Santtify uma responsabilidade (PCI) que não
 *     há razão nenhuma para ela ter.
 *
 * E O AVISO NUNCA É ACREDITADO PELO QUE DIZ. O Mercado Pago avisa "a order X
 * mudou"; o que mudou pergunta-se-lhe a ele, com o nosso Access Token. Só a
 * resposta dele diz se um pedido está pago. Ver `MERCADOPAGO_WEBHOOK_SECRET`
 * em `config/env.ts`.
 */
@Injectable()
export class ProvedorMercadoPago extends ProvedorDePagamento {
  readonly nome = 'mercadopago'
  private readonly logger = new Logger(ProvedorMercadoPago.name)

  constructor(private readonly config: ConfigService) {
    super()
  }

  async criarCobranca(pedido: CobrancaPedida): Promise<CobrancaCriada> {
    return pedido.meio === MeioDePagamento.PIX
      ? this.criarCobrancaPix(pedido)
      : this.criarCobrancaDeCartao(pedido)
  }

  private async criarCobrancaPix(pedido: CobrancaPedida): Promise<CobrancaCriada> {
    const valor = (pedido.totalCent / 100).toFixed(2)
    const order = await this.pedir<Record<string, any>>('POST', '/v1/orders', {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: valor,
      external_reference: pedido.pedidoId,
      payer: { email: pedido.emailDoPagador },
      transactions: {
        payments: [
          {
            amount: valor,
            payment_method: { id: 'pix', type: 'bank_transfer' },
            expiration_time: duracaoAte(pedido.expiraEm),
          },
        ],
      },
    })

    const codigo = order?.transactions?.payments?.[0]?.payment_method?.qr_code
    if (!order?.id || typeof codigo !== 'string' || !codigo) {
      this.logger.error(`Order sem código Pix na resposta (${order?.id ?? 'sem id'})`)
      throw new ServiceUnavailableException('Não foi possível gerar o Pix agora. Tente de novo em instantes.')
    }

    /*
      O QR DESENHA-SE AQUI, a partir do código, e não da imagem que eles mandam.

      A resposta traz também `qr_code_base64`, um PNG. Desenhar o nosso a partir
      do mesmo texto dá exactamente o mesmo Pix, no mesmo SVG nítido que o ecrã
      já mostrava — e o que se guarda no pedido é texto, não uma imagem.
    */
    const pixQrSvg = await QRCode.toString(codigo, { type: 'svg', margin: 1, width: 512 })
    return { referenciaExterna: String(order.id), pixCopiaECola: codigo, pixQrSvg }
  }

  /**
   * A cobrança de cartão é uma "preferência" do Checkout Pro.
   *
   * O pagamento só nasce quando a pessoa paga, e por isso o id dele não existe
   * ainda. A referência guardada no pedido é então `cartao:<id do pedido>`, que
   * é também o que o aviso do pagamento devolve (o Mercado Pago repete o
   * `external_reference` que lhe demos). Os dois lados chegam ao mesmo texto
   * sem precisar de guardar mais nada.
   */
  private async criarCobrancaDeCartao(pedido: CobrancaPedida): Promise<CobrancaCriada> {
    const https = (url: string) => url.startsWith('https://')
    const aviso = `${this.urlPublicaDaApi()}/pagamentos/mercadopago/aviso`

    const preferencia = await this.pedir<Record<string, any>>('POST', '/checkout/preferences', {
      items: [
        {
          id: pedido.pedidoId,
          title: pedido.descricao,
          quantity: 1,
          unit_price: pedido.totalCent / 100,
          currency_id: pedido.moeda,
        },
      ],
      external_reference: pedido.pedidoId,
      payer: { email: pedido.emailDoPagador },
      // Só cartão: o Pix já tem o seu caminho, dentro do nosso ecrã.
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }],
      },
      back_urls: {
        success: pedido.urlDeRegresso,
        pending: pedido.urlDeRegresso,
        failure: pedido.urlDeRegresso,
      },
      // O Mercado Pago recusa estas duas com endereços que não sejam HTTPS, e em
      // desenvolvimento os nossos são http://localhost. Em produção vão sempre.
      ...(https(pedido.urlDeRegresso) ? { auto_return: 'approved' } : {}),
      ...(https(aviso) ? { notification_url: aviso } : {}),
      expires: true,
      expiration_date_to: pedido.expiraEm.toISOString(),
      statement_descriptor: 'SANTTIFY',
    })

    if (!preferencia?.init_point) {
      this.logger.error(`Preferência sem endereço de pagamento (${preferencia?.id ?? 'sem id'})`)
      throw new ServiceUnavailableException('Não foi possível abrir o pagamento com cartão agora.')
    }
    return {
      referenciaExterna: `${CARTAO}${pedido.pedidoId}`,
      urlDeRedireccionamento: String(preferencia.init_point),
    }
  }

  async lerAviso({ corpo, cabecalhos, consulta }: AvisoRecebido): Promise<AvisoDePagamento | null> {
    const c = (corpo ?? {}) as Record<string, any>
    const tipo = String(consulta['type'] ?? consulta['topic'] ?? c.type ?? c.topic ?? '')
    // O id vem do endereço. O do corpo só serve de recurso, e nunca para a assinatura.
    const idDoEndereco = consulta['data.id'] ?? consulta['id']
    const id = String(idDoEndereco ?? c.data?.id ?? '')
    if (!id || !tipo) return null

    const segredo = this.config.get<string>('MERCADOPAGO_WEBHOOK_SECRET')
    const assinatura = cabecalho(cabecalhos, 'x-signature')
    if (segredo && assinatura) {
      const valida = assinaturaMercadoPagoValida({
        assinatura,
        requestId: cabecalho(cabecalhos, 'x-request-id'),
        dataId: idDoEndereco === undefined ? undefined : String(idDoEndereco),
        segredo,
      })
      if (!valida) throw new AvisoNaoAutenticado('Assinatura do aviso não confere')
    }
    // Sem assinatura, segue: a consulta abaixo é que decide, e com o NOSSO token.

    if (tipo === 'order') {
      const order = await this.pedir<Record<string, any>>('GET', `/v1/orders/${encodeURIComponent(id)}`)
      if (!order) return null
      const estado = String(order.status ?? '')
      const detalhe = String(order.status_detail ?? '')
      /*
        O PIX DEVOLVIDO.

        A order devolvida por inteiro fica `refunded`; a devolvida em parte
        continua `processed`, com o detalhe `partially_refunded`. O valor vem
        no total devolvido, ou na soma dos reembolsos da transacção. Um
        reembolso parcial sem valor legível fica registado como evento e é
        avisado no registo — o painel tem o botão para o lançar à mão.
      */
      const total = centavos(order.total_amount)
      const totalmente = [estado, detalhe].some((s) => s === 'refunded' || s === 'charged_back')
      const parcial = detalhe === 'partially_refunded'
      const declarado = centavos(order.total_refunded_amount) || somaDosReembolsos(order)
      const reembolsado = totalmente ? declarado || total : parcial ? declarado : 0
      if (parcial && !declarado) {
        this.logger.warn(`Order ${order.id} com reembolso parcial sem valor no aviso; lance-o no painel.`)
      }
      return {
        idExterno: `mp:order:${order.id}:${estado}:${detalhe}${reembolsado ? `:${reembolsado}` : ''}`,
        referenciaExterna: String(order.id),
        pedidoId: order.external_reference ? String(order.external_reference) : null,
        tipo: `order.${estado}`,
        pago: (estado === 'processed' && (detalhe === 'accredited' || parcial)) || totalmente,
        reembolsadoCent: reembolsado || null,
        // A API de Orders não diz a taxa: fica estimada pela percentagem do painel.
        taxaCent: null,
        bruto: resumo(order),
      }
    }

    if (tipo === 'payment') {
      const pagamento = await this.pedir<Record<string, any>>('GET', `/v1/payments/${encodeURIComponent(id)}`)
      // Um pagamento sem a nossa referência não é de nenhum pedido de cartões.
      if (!pagamento?.external_reference) return null
      const estado = String(pagamento.status ?? '')
      /*
        O CARTÃO DEVOLVIDO OU CONTESTADO.

        `refunded` é o reembolso inteiro; `charged_back` é a contestação que o
        banco deu por boa — para a loja, o mesmo dinheiro que volta. O
        reembolso parcial continua `approved`, com o valor devolvido em
        `transaction_amount_refunded`.

        O valor devolvido entra no id do evento: cada reembolso parcial é um
        evento novo, e o repetido de um já visto continua a bater no índice.
      */
      const total = centavos(pagamento.transaction_amount)
      const devolvido = centavos(pagamento.transaction_amount_refunded)
      const totalmente = estado === 'refunded' || estado === 'charged_back'
      const reembolsado = totalmente ? devolvido || total : devolvido
      return {
        idExterno: `mp:payment:${pagamento.id}:${estado}${reembolsado ? `:${reembolsado}` : ''}`,
        referenciaExterna: `${CARTAO}${pagamento.external_reference}`,
        pedidoId: String(pagamento.external_reference),
        tipo: `payment.${estado}`,
        pago: estado === 'approved' || estado === 'in_mediation' || totalmente,
        reembolsadoCent: reembolsado || null,
        taxaCent: taxaDoPagamento(pagamento),
        bruto: resumo(pagamento),
      }
    }

    return null
  }

  /**
   * Um pedido à API deles. Devolve `null` num 404, que num aviso quer dizer "isto
   * não é nosso"; qualquer outra falha sobe, e o aviso responde com erro para o
   * Mercado Pago tentar outra vez mais tarde.
   *
   * A chave de idempotência vai em todos os POST: um toque duplo no botão, ou
   * um repetir da rede, não cria duas cobranças.
   */
  private async pedir<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T | null> {
    const token = this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN')
    if (!token) throw new ServiceUnavailableException('Pagamentos por configurar.')

    const res = await fetch(`${API}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(corpo ? { 'Content-Type': 'application/json', 'X-Idempotency-Key': randomUUID() } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 404) return null
    const dados = await res.json().catch(() => null)
    if (!res.ok) {
      // O corpo da resposta de erro diz o campo que falhou. O token não vai para o registo.
      this.logger.error(`Mercado Pago ${metodo} ${caminho} → ${res.status}: ${JSON.stringify(dados)?.slice(0, 500)}`)
      throw new ServiceUnavailableException('O processador de pagamentos não respondeu. Tente de novo em instantes.')
    }
    return dados as T
  }

  private urlPublicaDaApi(): string {
    const base = this.config.get<string>('PUBLIC_API_URL') ?? ''
    return base.replace(/\/+$/, '').replace(/\/api$/, '') + '/api'
  }
}

/** Duração ISO 8601 até uma data: "PT36H". Entre 1 hora e 30 dias, que é o que o Pix aceita. */
function duracaoAte(data: Date): string {
  const horas = Math.ceil((data.getTime() - Date.now()) / 3_600_000)
  return `PT${Math.min(720, Math.max(1, horas))}H`
}

function cabecalho(c: AvisoRecebido['cabecalhos'], nome: string): string | undefined {
  const v = c[nome] ?? c[nome.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

/**
 * O que se guarda do aviso, para a auditoria.
 *
 * Só o estado e os valores. A resposta completa traz o e-mail e o nome de quem
 * pagou, e esses ficam no Mercado Pago, que é onde já estão.
 */
function resumo(r: Record<string, any>): Record<string, unknown> {
  return {
    id: r.id,
    status: r.status,
    status_detail: r.status_detail,
    total_amount: r.total_amount ?? r.transaction_amount,
    refunded_amount: r.transaction_amount_refunded ?? r.total_refunded_amount ?? null,
    fee: taxaDoPagamento(r),
    currency: r.currency_id ?? r.currency,
    external_reference: r.external_reference,
    date: r.last_updated_date ?? r.date_last_updated ?? r.date_approved ?? null,
  }
}

/** "49.9" → 4990. O Mercado Pago fala em reais com casas decimais. */
function centavos(valor: unknown): number {
  const n = Number(valor ?? 0)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

/** A soma dos reembolsos de uma order, quando ela os lista. */
function somaDosReembolsos(order: Record<string, any>): number {
  const lista = order?.transactions?.refunds
  if (!Array.isArray(lista)) return 0
  return lista
    .filter((r: Record<string, any>) => !['failed', 'rejected', 'canceled'].includes(String(r?.status ?? '')))
    .reduce((t: number, r: Record<string, any>) => t + centavos(r?.amount), 0)
}

/**
 * A taxa que o Mercado Pago cobrou à loja neste pagamento, em cêntimos.
 *
 * Só as taxas pagas por quem recebe (`collector`): as que o comprador paga
 * — juros de parcelas, por exemplo — não saem do dinheiro da loja.
 */
function taxaDoPagamento(p: Record<string, any>): number | null {
  const taxas = p?.fee_details
  if (!Array.isArray(taxas) || taxas.length === 0) return null
  const soma = taxas
    .filter((t: Record<string, any>) => !t?.fee_payer || t.fee_payer === 'collector')
    .reduce((s: number, t: Record<string, any>) => s + Number(t?.amount ?? 0), 0)
  return Number.isFinite(soma) ? Math.round(soma * 100) : null
}
