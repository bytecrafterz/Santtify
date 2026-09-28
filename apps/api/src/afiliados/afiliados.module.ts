import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { MailModule } from '../common/mail/mail.module'
import { AfiliadosService } from './afiliados.service'
import { PainelDeAfiliadosService } from './painel-de-afiliados.service'
import { VendasService } from './vendas.service'
import { TarefasDosAfiliadosService } from './tarefas-dos-afiliados.service'
import { AfiliadosController } from './afiliados.controller'
import { AdminAfiliadosController } from './admin-afiliados.controller'
import { AdminVendasController } from './admin-vendas.controller'

/**
 * Os afiliados e o painel de vendas.
 *
 * Não importa os cartões nem os links curtos, e é de propósito: são ELES que
 * importam este módulo (o aviso de pagamento chama a comissão; o `/r/` chama
 * o clique). A seta num só sentido é o que evita a dependência circular.
 */
@Module({
  imports: [IdentityModule, MailModule],
  controllers: [AfiliadosController, AdminAfiliadosController, AdminVendasController],
  providers: [AfiliadosService, PainelDeAfiliadosService, VendasService, TarefasDosAfiliadosService],
  exports: [AfiliadosService],
})
export class AfiliadosModule {}
