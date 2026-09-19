import { MeioDePagamento } from '@pv/db'

/**
 * A porta por onde o dinheiro entra.
 *
 * O Santtify fica com o checkout, os produtos, os clientes e — quando chegar a
 * altura — os afiliados. O provedor trata só do processamento. Foi assim que
 * ficou combinado, e é o que evita depender de Hotmart, Kiwify ou Eduzz.
 *
 * ESTA INTERFACE EXISTE POR UMA RAZÃO CONCRETA, não por gosto de abstrair. O
 * Pix e o cartão internacional muito provavelmente não vão sair do mesmo sítio:
 * o Pix sai mais barato num provedor brasileiro, e o cartão em euro e dólar
 * quer o Stripe. Duas implementações desta porta, um só checkout, e o resto do
 * código nunca sabe qual está a atender.
 *
 * O QUE FALTA PARA LIGAR UM PROVEDOR A SÉRIO: uma conta e uma empresa. Todo o
 * provedor de Pix exige um CNPJ brasileiro para liquidar. Enquanto essa conta
 * não existir, nenhuma linha de código a pode inventar — por isso o que está
 * ligado é o `ProvedorManual`, que faz o percurso inteiro sem mover dinheiro.
 * Trocar por um provedor real é escrever uma classe com estes dois métodos.
 */

export interface CobrancaPedida {
  pedidoId: string
  totalCent: number
  moeda: string
  meio: MeioDePagamento
  descricao: string
  /**
   * O e-mail de quem paga, que os provedores exigem.
   *
   * Passa por aqui e segue para o provedor; o pedido não o guarda. Uma
   * plataforma de crianças só guarda o que precisa, e para entregar os
   * cartões o e-mail não é preciso.
   */
  emailDoPagador: string
  /** Para onde o provedor devolve a pessoa depois de pagar com cartão. */
  urlDeRegresso: string
  /** Até quando a cobrança vale. Depois disso o pedido já foi abandonado. */
  expiraEm: Date
}

export interface CobrancaCriada {
  /** O identificador da cobrança do lado do provedor. */
  referenciaExterna: string
  /** O código Pix "copia e cola", quando o meio é Pix. */
  pixCopiaECola?: string
  /** O QR do Pix em SVG, para a mãe apontar a câmara. */
  pixQrSvg?: string
  /** Para cartão: o endereço onde ela termina o pagamento. */
  urlDeRedireccionamento?: string
}

/** Um aviso tal como chegou: corpo, cabeçalhos e os parâmetros do endereço. */
export interface AvisoRecebido {
  corpo: unknown
  cabecalhos: Record<string, string | string[] | undefined>
  consulta: Record<string, unknown>
}

/** A assinatura do aviso não confere: quem o mandou não foi o provedor. */
export class AvisoNaoAutenticado extends Error {}

/** O que um aviso do provedor diz, depois de traduzido. */
export interface AvisoDePagamento {
  /** O id do EVENTO no provedor. É a chave da idempotência, não o da cobrança. */
  idExterno: string
  referenciaExterna: string
  tipo: string
  pago: boolean
  bruto: Record<string, unknown>
}

export abstract class ProvedorDePagamento {
  /** O nome que aparece no painel e nos registos. */
  abstract readonly nome: string

  abstract criarCobranca(pedido: CobrancaPedida): Promise<CobrancaCriada>

  /**
   * Traduz o webhook para o que o sistema entende.
   *
   * Devolve `null` quando o aviso não diz respeito a nada nosso — os provedores
   * mandam de tudo pelo mesmo endereço, e um aviso desconhecido é para ignorar
   * em silêncio, nunca para rebentar com um 500 que faz o provedor reenviar
   * o mesmo aviso durante horas.
   *
   * ASSÍNCRONO porque o aviso do Mercado Pago não diz se o pagamento entrou:
   * diz só "a order X mudou". Saber o que mudou é perguntar-lhe, e a resposta
   * dele é a única em que se acredita. Lança `AvisoNaoAutenticado` se a
   * assinatura não conferir.
   */
  abstract lerAviso(recebido: AvisoRecebido): Promise<AvisoDePagamento | null>
}
