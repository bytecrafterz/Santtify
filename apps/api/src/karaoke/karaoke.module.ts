import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { AdminKaraokeController, KaraokeController } from './karaoke.controller'
import { KaraokeService } from './karaoke.service'

@Module({
  // O AuthGuard precisa do JwtService, que vive no IdentityModule.
  imports: [IdentityModule],
  controllers: [KaraokeController, AdminKaraokeController],
  providers: [KaraokeService],
})
export class KaraokeModule {}
