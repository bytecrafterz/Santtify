import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import * as QRCode from 'qrcode'
import {
  ProvedorDePagamento,
  type AvisoDePagamento,
  type CobrancaCriada,
  type CobrancaPedida,
} from './provedor'

/**
 * O provedor que faz o percurso todo sem mover dinheiro.
 *
 * NÃO É UM FINGIMENTO PARA A DEMONSTRAÇÃO ficar bonita, e é importante que
 * fique escrito. O percurso do pagamento tem três partes: criar a cobrança,
 * esperar a confirmação sem prender a mãe ao ecrã, e destrancar os ficheiros só
 * quando a confirmação chega a sério. As três estão feitas e são as mesmas
 * seja qual for o provedor. O que falta é o adaptador do provedor, e esse não
 * se escreve sem uma conta: todo o provedor de Pix exige um CNPJ brasileiro
 * para liquidar o dinheiro.
 *
 * Enquanto essa conta não existe, este atende no lugar dele. A cobrança nasce,
 * fica a aguardar, e a confirmação entra pela MESMA porta do webhook que um
 * provedor a sério usaria — só que carregada à mão pelo administrador. No dia
 * em que houver conta, escreve-se a classe do provedor, troca-se o `useClass`
 * no módulo, e nada mais no sistema muda.
 */
@Injectable()
export class ProvedorManual extends ProvedorDePagamento {
  readonly nome = 'manual'
  private readonly logger = new Logger(ProvedorManual.name)

  async criarCobranca(pedido: CobrancaPedida): Promise<CobrancaCriada> {
    const referenciaExterna = `manual_${randomUUID()}`

    /**
     * O texto do QR é deliberadamente legível e deliberadamente NÃO é um Pix.
     *
     * Um código que se parecesse com um Pix verdadeiro seria a pior coisa a pôr
     * aqui: alguém apontava a câmara do banco, o banco recusava, e ficava a
     * dúvida de se o problema era o telemóvel dela. Assim, quem o lê percebe
     * de imediato o que está a ver.
     */
    const texto =
      `SANTTIFY PAGAMENTO PENDENTE DE CONFIGURACAO\n` +
      `pedido=${pedido.pedidoId}\n` +
      `valor=${(pedido.totalCent / 100).toFixed(2)} ${pedido.moeda}\n` +
      `referencia=${referenciaExterna}`

    const pixQrSvg = await QRCode.toString(texto, {
      type: 'svg',
      margin: 1,
      width: 512,
    })

    this.logger.warn(
      `Cobrança criada sem provedor real (${referenciaExterna}). ` +
        `Confirmação tem de ser feita pelo painel.`,
    )

    return {
      referenciaExterna,
      pixCopiaECola: texto,
      pixQrSvg,
    }
  }

  /**
   * O provedor manual não recebe webhooks de fora.
   *
   * A confirmação entra pela rota do painel, que constrói o mesmo
   * `AvisoDePagamento` e o entrega ao mesmo método do serviço. O caminho da
   * confirmação é um só — o que muda é quem bate à porta.
   */
  async lerAviso(): Promise<AvisoDePagamento | null> {
    return null
  }
}
