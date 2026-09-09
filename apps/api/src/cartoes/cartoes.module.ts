import { Module } from '@nestjs/common'
import { CartoesService } from './cartoes.service'
import { CartoesController } from './cartoes.controller'
import { AdminCartoesService } from './admin-cartoes.service'
import { AdminCartoesController } from './admin-cartoes.controller'
import { CarrosselService } from './carrossel.service'
import { CarrosselController } from './carrossel.controller'
import { ArmazenamentoDeCartoesService } from './armazenamento-de-cartoes.service'
import { ExpurgoDeCartoesService } from './expurgo.service'
import { ProvedorDePagamento } from './pagamentos/provedor'
import { ProvedorManual } from './pagamentos/provedor-manual'
import { StorageService } from '../admin/storage.service'
import { ContagensService } from '../social/contagens.service'
import { IdentityModule } from '../identity/identity.module'

@Module({
  // O AuthGuard precisa do JwtService, que vive no IdentityModule.
  imports: [IdentityModule],
  controllers: [CartoesController, AdminCartoesController, CarrosselController],
  providers: [
    CartoesService,
    AdminCartoesService,
    CarrosselService,
    ArmazenamentoDeCartoesService,
    ExpurgoDeCartoesService,
    StorageService,
    ContagensService,
    /**
     * O ponto de troca do provedor de pagamento.
     *
     * Ligar um provedor a sério — Mercado Pago, Asaas, Efí para o Pix, Stripe
     * para o cartão internacional — é escrever a classe e trocar o `useClass`
     * desta linha. Nada mais no sistema sabe qual está a atender, e é para isso
     * que a `ProvedorDePagamento` existe.
     */
    { provide: ProvedorDePagamento, useClass: ProvedorManual },
  ],
  exports: [CartoesService, CarrosselService],
})
export class CartoesModule {}
