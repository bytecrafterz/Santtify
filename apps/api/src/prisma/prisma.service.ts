import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient, Prisma } from '@pv/db'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit() {
    await this.$connect()
    this.logger.log('Conectado ao banco')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  /**
   * Único caminho autorizado para remover eventos.
   *
   * A trigger `events_no_delete` bloqueia DELETE a menos que a flag de sessão
   * esteja ligada. Concentrar isso aqui torna o apagamento deliberado e
   * rastreável, em vez de algo que acontece por engano dentro de um serviço
   * qualquer.
   */
  async purgeEvents(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
    await this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL pv.allow_event_purge = 'on'`)
      await fn(tx)
    })
  }
}
