import { Module } from '@nestjs/common'
import { StorageService } from './storage.service'

/**
 * O armazenamento num módulo só dele.
 *
 * Estava dentro do módulo de administração, e a partir do momento em que a
 * parte pública passou a precisar dele para gerar o PDF do cartão isso deixou
 * de servir: o módulo público não pode importar o de administração, que já
 * importa o público. Um módulo à parte, que os dois importam, resolve sem
 * forwardRef e sem uma segunda cópia do serviço.
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
