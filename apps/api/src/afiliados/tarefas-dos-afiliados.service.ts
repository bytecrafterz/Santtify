import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { MailService } from '../common/mail/mail.service'
import { AfiliadosService } from './afiliados.service'
import { PainelDeAfiliadosService } from './painel-de-afiliados.service'
import { reais } from './dinheiro'
import { emailDeLembreteDePagamentos } from './emails'

/**
 * O que corre sozinho: os avisos.
 *
 * NENHUMA CONTA DEPENDE DISTO. O saldo disponível é calculado a partir da
 * data a cada leitura (ver `EstadoDaComissao`), por isso uma noite em que
 * estas tarefas não corram atrasa um e-mail e mais nada.
 *
 * Às 9h de São Paulo, que é quando um aviso se lê — e não às 3h da manhã.
 */
@Injectable()
export class TarefasDosAfiliadosService {
  private readonly logger = new Logger(TarefasDosAfiliadosService.name)
  private readonly webUrl: string

  constructor(
    private readonly afiliados: AfiliadosService,
    private readonly painel: PainelDeAfiliadosService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = (config.get<string>('PUBLIC_WEB_URL') ?? '').replace(/\/+$/, '')
  }

  /** A cada afiliado, as comissões que passaram a disponíveis desde ontem. */
  @Cron('0 9 * * *', { timeZone: 'America/Sao_Paulo' })
  async avisarDisponiveis() {
    try {
      const enviados = await this.afiliados.avisarDisponiveis()
      if (enviados) this.logger.log(`Avisos de comissão disponível: ${enviados}`)
    } catch (erro) {
      this.logger.error(`Avisos de comissão disponível falharam: ${String(erro)}`)
    }
  }

  /**
   * No dia 1 de cada mês, ao responsável: quem tem saldo para receber.
   *
   * Só os que passam o mínimo configurado. O painel mostra o mesmo lembrete a
   * qualquer hora; este e-mail é para ele não ter de se lembrar de ir ver.
   */
  @Cron('0 9 1 * *', { timeZone: 'America/Sao_Paulo' })
  async lembrarPagamentos() {
    try {
      const cfg = await this.afiliados.configuracao()
      if (!cfg.emailDeAvisos || !this.mail.activo) return
      const aPagar = await this.painel.aPagar()
      const acima = aPagar.afiliados.filter((a) => a.acimaDoMinimo)
      if (acima.length === 0) return

      const total = acima.reduce((t, a) => t + a.aPagarCent, 0)
      const slug = (await this.afiliados.destinoDoLink(cfg).catch(() => null))?.path.split(/[/?#]/)[1] ?? ''
      const m = emailDeLembreteDePagamentos({
        quantos: acima.length,
        total: reais(total),
        linhas: acima.slice(0, 30).map((a) => `${a.nome} (@${a.codigo}): ${reais(a.aPagarCent)}`),
        painel: `${this.webUrl}${slug ? `/${slug}` : ''}/admin/vendas/financeiro`,
      })
      await this.mail.enviar({ para: cfg.emailDeAvisos, ...m })
    } catch (erro) {
      this.logger.error(`Lembrete de pagamentos falhou: ${String(erro)}`)
    }
  }
}
