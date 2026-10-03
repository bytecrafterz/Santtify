import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

/**
 * A pasta onde ficavam as fotografias das crianças e os PDFs — e o que resta
 * dela: apagá-la.
 *
 * Até 03/10 a foto vinha ao servidor e o PDF era montado e guardado aqui, numa
 * pasta que nenhuma rota servia directamente. Desde 03/10 a foto não sai do
 * telemóvel e o PDF é montado lá (ver `gerarPdfNoAparelho` no site): nada novo
 * entra nesta pasta. Fica só o apagar, para o expurgo limpar o que os pedidos
 * de antes ainda lá tiverem, no fim do prazo de cada um.
 */
@Injectable()
export class ArmazenamentoDeCartoesService {
  private readonly pasta: string

  constructor(config: ConfigService) {
    this.pasta = resolve(
      config.get<string>('CARTOES_DIR') ?? join(process.cwd(), '..', '..', 'cartoes-temporarios'),
    )
  }

  /** Apaga tudo o que um pedido de antes de 03/10 ainda tiver: fotos, PDFs e a pasta. */
  async apagarPedido(pedidoId: string): Promise<void> {
    await rm(join(this.pasta, pedidoId), { recursive: true, force: true })
  }
}
