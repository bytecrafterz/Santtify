import { Module } from '@nestjs/common'
import { AttributionService } from './attribution.service'
import { EventsService } from './events.service'
import { TrackingController } from './tracking.controller'
import { ErrosDoClienteController } from './erros-do-cliente.controller'

@Module({
  controllers: [TrackingController, ErrosDoClienteController],
  providers: [AttributionService, EventsService],
  exports: [AttributionService, EventsService],
})
export class TrackingModule {}
