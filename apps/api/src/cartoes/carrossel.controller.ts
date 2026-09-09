import { Controller, Get } from '@nestjs/common'
import { CarrosselService } from './carrossel.service'

/**
 * O carrossel é público, como o perfil que fica por cima dele.
 *
 * Sem guarda nenhuma de propósito: quem chega pelo QR partilhado no WhatsApp
 * ainda não tem conta, e é essa pessoa que o carrossel serve para encaminhar
 * para os outros projetos.
 */
@Controller('carrossel')
export class CarrosselController {
  constructor(private readonly carrossel: CarrosselService) {}

  @Get('projetos')
  projetos() {
    return this.carrossel.listar()
  }
}
