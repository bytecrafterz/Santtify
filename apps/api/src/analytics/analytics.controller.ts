import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common'
import { AnalyticsService } from './analytics.service'
import { AdminGuard, AuthGuard } from '../identity/auth.guard'

/**
 * Dashboard — restrito ao administrador.
 *
 * São números de negócio do cliente: quanto cresceu, de onde veio, o que
 * converteu. Não é informação pública.
 */
@Controller('admin/analytics')
@UseGuards(AuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':projectSlug')
  visaoGeral(
    @Param('projectSlug') projectSlug: string,
    @Query('dias', new DefaultValuePipe(30), ParseIntPipe) dias: number,
  ) {
    return this.analytics.visaoGeral(projectSlug, Math.min(Math.max(dias, 1), 365))
  }

  /**
   * As visitas por trás do número de um país.
   *
   * `SEM_PAIS` abre as que não têm país nenhum, que são todas anteriores a
   * 25/08, quando a base de países ainda não existia.
   */
  @Get(':projectSlug/paises/:pais')
  visitasDoPais(
    @Param('projectSlug') projectSlug: string,
    @Param('pais') pais: string,
    @Query('limite', new DefaultValuePipe(200), ParseIntPipe) limite: number,
  ) {
    return this.analytics.visitasDoPais(projectSlug, pais, Math.min(Math.max(limite, 1), 500))
  }
}
