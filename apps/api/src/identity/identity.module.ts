import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { ConsentService } from './consent.service'
import { ProfileService } from './profile.service'
import { AuthGuard, AdminGuard } from './auth.guard'
import { IdentityController } from './identity.controller'
import { TrackingModule } from '../tracking/tracking.module'

@Module({
  imports: [TrackingModule, JwtModule.register({})],
  controllers: [IdentityController],
  providers: [AuthService, ConsentService, ProfileService, AuthGuard, AdminGuard],
  exports: [AuthService, ConsentService, ProfileService, AuthGuard, AdminGuard, JwtModule],
})
export class IdentityModule {}
