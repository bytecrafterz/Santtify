import { Module } from '@nestjs/common'
import { ShortLinksService } from './short-links.service'
import { ShortLinksController } from './short-links.controller'
import { TrackingModule } from '../tracking/tracking.module'

@Module({
  imports: [TrackingModule],
  controllers: [ShortLinksController],
  providers: [ShortLinksService],
  exports: [ShortLinksService],
})
export class ShortLinksModule {}
