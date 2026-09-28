import { Module } from '@nestjs/common'
import { ShortLinksService } from './short-links.service'
import { ShortLinksController } from './short-links.controller'
import { TrackingModule } from '../tracking/tracking.module'
import { AfiliadosModule } from '../afiliados/afiliados.module'

@Module({
  imports: [TrackingModule, AfiliadosModule],
  controllers: [ShortLinksController],
  providers: [ShortLinksService],
  exports: [ShortLinksService],
})
export class ShortLinksModule {}
