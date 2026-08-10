import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminContentService } from './admin-content.service'
import { StorageService } from './storage.service'
import { ShortLinksModule } from '../short-links/short-links.module'
import { ContentModule } from '../content/content.module'
import { IdentityModule } from '../identity/identity.module'

@Module({
  imports: [ShortLinksModule, IdentityModule, ContentModule],
  controllers: [AdminController],
  providers: [AdminContentService, StorageService],
  exports: [AdminContentService, StorageService],
})
export class AdminModule {}
