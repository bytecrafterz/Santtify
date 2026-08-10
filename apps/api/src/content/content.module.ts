import { Module } from '@nestjs/common'
import { ContentService } from './content.service'
import { LaunchesService } from './launches.service'
import { ContentController } from './content.controller'
import { ShortLinksModule } from '../short-links/short-links.module'

@Module({
  imports: [ShortLinksModule],
  controllers: [ContentController],
  providers: [ContentService, LaunchesService],
  exports: [ContentService, LaunchesService],
})
export class ContentModule {}
