import { Module } from '@nestjs/common'
import { SocialService } from './social.service'
import {
  SocialController,
  FaixasController,
  ComentariosController,
  MinhasPublicacoesController,
  PublicacoesController,
} from './social.controller'
import { ShortLinksModule } from '../short-links/short-links.module'
import { TrackingModule } from '../tracking/tracking.module'
import { IdentityModule } from '../identity/identity.module'
import { PostsModule } from './posts.module'

@Module({
  imports: [ShortLinksModule, TrackingModule, IdentityModule, PostsModule],
  controllers: [
    SocialController,
    FaixasController,
    ComentariosController,
    MinhasPublicacoesController,
    PublicacoesController,
  ],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
