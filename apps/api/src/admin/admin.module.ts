import { Module, forwardRef } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminContentService } from './admin-content.service'
import { StorageModule } from './storage.module'
import { ContagensModule } from '../social/contagens.module'
import { ShortLinksModule } from '../short-links/short-links.module'
import { ContentModule } from '../content/content.module'
import { PostsModule } from '../social/posts.module'
import { IdentityModule } from '../identity/identity.module'
import { KaraokeModule } from '../karaoke/karaoke.module'

@Module({
  imports: [
    // O karaokê entra aqui por uma razão só: quando ele envia um áudio novo,
    // a faixa vai sozinha para a fila de transcrição. Ver `salvarCartao`.
    KaraokeModule,
    ShortLinksModule,
    IdentityModule,
    ContentModule,
    StorageModule,
    ContagensModule,
    forwardRef(() => PostsModule),
  ],
  controllers: [AdminController],
  providers: [AdminContentService],
  exports: [AdminContentService, StorageModule],
})
export class AdminModule {}
