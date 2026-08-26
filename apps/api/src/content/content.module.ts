import { Module } from '@nestjs/common'
import { ContentService } from './content.service'
import { LaunchesService } from './launches.service'
import { ContentController } from './content.controller'
import { ShortLinksModule } from '../short-links/short-links.module'
import { StorageModule } from '../admin/storage.module'
import { ContagensModule } from '../social/contagens.module'

@Module({
  imports: [ShortLinksModule, StorageModule, ContagensModule],
  controllers: [ContentController],
  providers: [ContentService, LaunchesService],
  exports: [ContentService, LaunchesService],
})
export class ContentModule {}
