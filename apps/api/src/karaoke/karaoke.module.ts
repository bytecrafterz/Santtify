import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import {
  AdminKaraokeController,
  KaraokeController,
  TranscritorController,
} from './karaoke.controller'
import { KaraokeService } from './karaoke.service'
import { TranscricaoService } from './transcricao.service'

@Module({
  // O AuthGuard precisa do JwtService, que vive no IdentityModule.
  imports: [IdentityModule],
  controllers: [KaraokeController, AdminKaraokeController, TranscritorController],
  providers: [KaraokeService, TranscricaoService],
  exports: [TranscricaoService],
})
export class KaraokeModule {}
