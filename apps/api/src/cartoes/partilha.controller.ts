import { Controller, Get, Param, Res } from '@nestjs/common'
import type { Response } from 'express'
import { CartoesService } from './cartoes.service'

/**
 * A porta por onde a ligação partilhada entra.
 *
 * SEM GUARDA NENHUMA, de propósito e não por esquecimento. É este o objectivo:
 * a gráfica, a avó, o telemóvel do marido — sítios onde ninguém tem sessão
 * iniciada. Quem manda aqui é a assinatura da própria ficha, verificada em
 * `ligacao-de-partilha.ts`, e o prazo que vai lá dentro.
 *
 * Fica num controlador à parte porque o outro está debaixo de
 * `projects/:projectSlug/cartoes` e esta rota não pertence a projeto nenhum:
 * pertence à ficha. Um endereço curto também é mais fácil de colar no WhatsApp.
 */
@Controller('cartoes/partilha')
export class PartilhaDeCartoesController {
  constructor(private readonly cartoes: CartoesService) {}

  @Get(':ficha')
  async abrir(@Param('ficha') ficha: string, @Res() res: Response) {
    const { nome, conteudo } = await this.cartoes.pdfPorFicha(ficha)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`)
    /**
     * `no-store` mesmo aqui.
     *
     * A ligação é para ser passada adiante e vai atravessar caches de operadora
     * e de empresa. Uma cópia da fotografia de uma criança guardada num
     * intermediário sobrevive ao expurgo, e o expurgo é a promessa toda.
     */
    res.setHeader('Cache-Control', 'no-store, private')
    res.send(conteudo)
  }
}
