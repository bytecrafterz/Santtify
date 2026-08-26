import { Module } from '@nestjs/common'
import { ContentService } from './content.service'
import { LaunchesService } from './launches.service'
import { ContentController } from './content.controller'
import { ShortLinksModule } from '../short-links/short-links.module'
import { StorageModule } from '../admin/storage.module'
import { ContagensModule } from '../social/contagens.module'
import { IdentityModule } from '../identity/identity.module'

@Module({
  // IdentityModule entra por causa das guardas da rota de pessoas: sem ele o
  // AuthGuard não encontra o serviço de JWT e a rota rebentaria só em produção,
  // que é o pior sítio para descobrir uma dependência em falta.
  imports: [ShortLinksModule, StorageModule, ContagensModule, IdentityModule],
  controllers: [ContentController],
  providers: [ContentService, LaunchesService],
  exports: [ContentService, LaunchesService],
})
export class ContentModule {}
