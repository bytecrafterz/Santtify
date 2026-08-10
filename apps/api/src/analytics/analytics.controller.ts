import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common'
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
}
