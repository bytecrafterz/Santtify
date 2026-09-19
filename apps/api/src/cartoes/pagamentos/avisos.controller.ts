import {
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { CartoesService } from '../cartoes.service'
import { AvisoNaoAutenticado, ProvedorDePagamento } from './provedor'

/**
 * A porta por onde o provedor avisa que um pagamento mudou.
 *
 * Aberta, sem sessão: quem bate aqui é o servidor do Mercado Pago. Por isso não
 * se acredita no que chega — ver `ProvedorMercadoPago.lerAviso`, que confere a
 * assinatura e pergunta ao próprio Mercado Pago o estado verdadeiro.
 *
 * AS RESPOSTAS SÃO PENSADAS PARA QUEM REENVIA:
 *   - 200 para tudo o que foi tratado, e também para o que não é nosso. Um
 *     aviso desconhecido respondido com erro seria reenviado durante horas.
 *   - 401 para a assinatura errada. Não há nada a reenviar.
 *   - 500 se a consulta ao Mercado Pago falhar. Aí queremos mesmo que ele
 *     tente outra vez, e é o que o erro faz.
 */
@Controller('pagamentos')
export class AvisosDePagamentoController {
  private readonly logger = new Logger(AvisosDePagamentoController.name)

  constructor(
    private readonly provedor: ProvedorDePagamento,
    private readonly cartoes: CartoesService,
  ) {}

  @Post('mercadopago/aviso')
  @HttpCode(200)
  async mercadoPago(@Req() req: Request) {
    if (this.provedor.nome !== 'mercadopago') return { ignorado: true }

    try {
      const aviso = await this.provedor.lerAviso({
        corpo: req.body,
        cabecalhos: req.headers,
        consulta: req.query as Record<string, unknown>,
      })
      if (!aviso) return { ignorado: true }
      return await this.cartoes.registarAviso(aviso)
    } catch (erro) {
      if (erro instanceof AvisoNaoAutenticado) {
        this.logger.warn(`Aviso recusado: ${erro.message}`)
        throw new UnauthorizedException()
      }
      throw erro
    }
  }
}
