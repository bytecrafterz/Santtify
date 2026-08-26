import { Module } from '@nestjs/common'
import { AnalyticsService } from './analytics.service'
import { AnalyticsController } from './analytics.controller'
import { IdentityModule } from '../identity/identity.module'
import { ContagensModule } from '../social/contagens.module'

@Module({
  imports: [IdentityModule, ContagensModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
