import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { ConsentService } from './consent.service'
import { ProfileService } from './profile.service'
import { AuthGuard, AdminGuard } from './auth.guard'
import { IdentityController } from './identity.controller'
import { TrackingModule } from '../tracking/tracking.module'
import { StorageService } from '../admin/storage.service'

@Module({
  imports: [TrackingModule, JwtModule.register({})],
  controllers: [IdentityController],
  // StorageService entra como provider próprio, e não via AdminModule: o
  // AdminModule já importa este módulo, e importá-lo de volta fecharia um
  // ciclo que só se resolve com forwardRef dos dois lados. O serviço não
  // guarda estado — duas instâncias escrevem na mesma pasta sem se estorvar.
  providers: [AuthService, ConsentService, ProfileService, AuthGuard, AdminGuard, StorageService],
  exports: [AuthService, ConsentService, ProfileService, AuthGuard, AdminGuard, JwtModule],
})
export class IdentityModule {}
