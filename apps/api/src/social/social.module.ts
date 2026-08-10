import { Module } from '@nestjs/common'
import { SocialService } from './social.service'
import { PostsService } from './posts.service'
import { SocialController, ComentariosController, PublicacoesController } from './social.controller'
import { ShortLinksModule } from '../short-links/short-links.module'
import { TrackingModule } from '../tracking/tracking.module'
import { IdentityModule } from '../identity/identity.module'

@Module({
  imports: [ShortLinksModule, TrackingModule, IdentityModule],
  controllers: [SocialController, ComentariosController, PublicacoesController],
  providers: [SocialService, PostsService],
  exports: [SocialService, PostsService],
})
export class SocialModule {}
