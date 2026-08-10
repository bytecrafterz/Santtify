import { Module } from '@nestjs/common'
import { SocialService } from './social.service'
import { SocialController, ComentariosController } from './social.controller'
import { ShortLinksModule } from '../short-links/short-links.module'
import { TrackingModule } from '../tracking/tracking.module'
import { IdentityModule } from '../identity/identity.module'

@Module({
  imports: [ShortLinksModule, TrackingModule, IdentityModule],
  controllers: [SocialController, ComentariosController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
