import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { MensagensController } from './mensagens.controller'
import { MensagensService } from './mensagens.service'

@Module({
  imports: [IdentityModule],
  controllers: [MensagensController],
  providers: [MensagensService],
})
export class MensagensModule {}
