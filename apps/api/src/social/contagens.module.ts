import { Module } from '@nestjs/common'
import { ContagensService } from './contagens.service'

/**
 * Num módulo só dele para que a parte pública, o painel e o social o possam
 * importar sem se fecharem em círculo. Não depende de mais nada.
 */
@Module({
  providers: [ContagensService],
  exports: [ContagensService],
})
export class ContagensModule {}
