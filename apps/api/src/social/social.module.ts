import { Module } from '@nestjs/common'
import { SocialService } from './social.service'
import {
  SocialController,
  FaixasController,
  ComentariosController,
  MinhasPublicacoesController,
  PublicacoesController,
  DenunciasController,
  PerfisController,
} from './social.controller'
import { ShortLinksModule } from '../short-links/short-links.module'
import { TrackingModule } from '../tracking/tracking.module'
import { IdentityModule } from '../identity/identity.module'
import { PostsModule } from './posts.module'
import { ContagensModule } from './contagens.module'

@Module({
  imports: [ShortLinksModule, TrackingModule, IdentityModule, PostsModule, ContagensModule],
  controllers: [
    SocialController,
    FaixasController,
    ComentariosController,
    MinhasPublicacoesController,
    PublicacoesController,
    DenunciasController,
    PerfisController,
  ],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
