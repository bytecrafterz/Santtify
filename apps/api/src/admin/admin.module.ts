import { Module, forwardRef } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminContentService } from './admin-content.service'
import { StorageModule } from './storage.module'
import { ShortLinksModule } from '../short-links/short-links.module'
import { ContentModule } from '../content/content.module'
import { PostsModule } from '../social/posts.module'
import { IdentityModule } from '../identity/identity.module'

@Module({
  imports: [
    ShortLinksModule,
    IdentityModule,
    ContentModule,
    StorageModule,
    forwardRef(() => PostsModule),
  ],
  controllers: [AdminController],
  providers: [AdminContentService],
  exports: [AdminContentService, StorageModule],
})
export class AdminModule {}
