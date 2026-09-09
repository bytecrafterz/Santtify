import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { EstadoDoPedido } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { ArmazenamentoDeCartoesService } from './armazenamento-de-cartoes.service'

/**
 * O expurgo. É esta classe que torna verdadeira a promessa feita ao cliente.
 *
 * Ele escreveu, e repetiu: fotos e PDFs não podem ficar guardados
 * permanentemente. Uma promessa dessas não se cumpre com boa intenção nem com
 * um apagar no fim de cada fluxo — cumpre-se com uma coisa que varre sozinha,
 * de hora a hora, sem depender de o caminho feliz ter corrido bem. A mãe que
 * fecha o separador a meio deixa uma fotografia em disco, e é exactamente essa
 * que ninguém se lembraria de apagar à mão.
 *
 * São fotografias de crianças, com utilizadores em Portugal. RGPD, não só LGPD.
 *
 * O REGISTO DA COMPRA FICA; O QUE ERA PESSOAL SAI. A linha do pedido continua,
 * porque é dela que se sabe que houve uma venda e por quanto. O que desaparece
 * é a fotografia e o ficheiro — que é o que tinha de desaparecer.
 */
@Injectable()
export class ExpurgoDeCartoesService {
  private readonly logger = new Logger(ExpurgoDeCartoesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly armazenamento: ArmazenamentoDeCartoesService,
  ) {}

  /**
   * De hora a hora, e não uma vez por dia.
   *
   * Um prazo de sete dias varrido diariamente é, na prática, um prazo entre
   * sete e oito. De hora a hora, o desvio máximo é uma hora, e o trabalho é
   * barato: uma consulta por um índice e alguns ficheiros a menos.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async varrer(): Promise<{ pedidos: number }> {
    const vencidos = await this.prisma.pedidoDeCartoes.findMany({
      where: {
        expiraEm: { lte: new Date() },
        estado: { not: EstadoDoPedido.EXPIRADO },
      },
      select: { id: true, estado: true },
      take: 200,
    })

    if (vencidos.length === 0) return { pedidos: 0 }

    for (const pedido of vencidos) {
      try {
        await this.armazenamento.apagarPedido(pedido.id)

        await this.prisma.criancaDoPedido.updateMany({
          where: { pedidoId: pedido.id },
          data: { fotoPath: null, pdfPath: null, fotoLargura: null, fotoAltura: null },
        })

        await this.prisma.pedidoDeCartoes.update({
          where: { id: pedido.id },
          data: { estado: EstadoDoPedido.EXPIRADO },
        })
      } catch (erro) {
        // Um pedido que falha não pode levar os outros atrás. Fica para a
        // próxima volta, daqui a uma hora.
        this.logger.error(`Falha ao expurgar o pedido ${pedido.id}: ${String(erro)}`)
      }
    }

    this.logger.log(`Expurgo concluído: ${vencidos.length} pedido(s) limpos.`)
    return { pedidos: vencidos.length }
  }
}
