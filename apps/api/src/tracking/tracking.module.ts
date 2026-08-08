import { Module } from '@nestjs/common'
import { AttributionService } from './attribution.service'
import { EventsService } from './events.service'
import { TrackingController } from './tracking.controller'

@Module({
  controllers: [TrackingController],
  providers: [AttributionService, EventsService],
  exports: [AttributionService, EventsService],
})
export class TrackingModule {}
