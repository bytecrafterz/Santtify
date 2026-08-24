import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Envio de e-mail transaccional, pelo Brevo.
 *
 * Pela API e não por SMTP: SMTP obriga a abrir portas de saída no servidor,
 * que muitos alojamentos bloqueiam, e a guardar utilizador e senha. Aqui é um
 * POST com uma chave, e a chave vive só na variável de ambiente do servidor.
 *
 * NUNCA FALHA PARA CIMA. Se o envio não correr, quem chamou não é interrompido:
 * uma senha reposta com sucesso não pode ser desfeita porque o e-mail não saiu.
 * Devolve se conseguiu, e quem chama decide o que dizer à pessoa.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)

  constructor(private readonly config: ConfigService) {}

  /** Há serviço configurado? Quando não há, o caminho manual continua a valer. */
  get activo(): boolean {
    return Boolean(this.config.get<string>('BREVO_API_KEY') && this.config.get<string>('MAIL_REMETENTE'))
  }

  async enviar(dados: { para: string; nome?: string | null; assunto: string; html: string; texto: string }) {
    const chave = this.config.get<string>('BREVO_API_KEY')
    const remetente = this.config.get<string>('MAIL_REMETENTE')
    if (!chave || !remetente) {
      this.logger.warn('Envio de e-mail pedido sem serviço configurado.')
      return { enviado: false, motivo: 'sem-servico' as const }
    }

    try {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': chave,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: remetente, name: this.config.get<string>('MAIL_REMETENTE_NOME') },
          to: [{ email: dados.para, ...(dados.nome ? { name: dados.nome } : {}) }],
          subject: dados.assunto,
          htmlContent: dados.html,
          textContent: dados.texto,
        }),
      })

      if (!r.ok) {
        // O corpo do erro do Brevo diz coisas úteis — remetente por verificar,
        // chave revogada, conta suspensa — e nada disso se adivinha do código.
        const corpo = await r.text().catch(() => '')
        this.logger.error(`Envio falhou (${r.status}): ${corpo.slice(0, 300)}`)
        return { enviado: false, motivo: 'recusado' as const, detalhe: corpo.slice(0, 300) }
      }

      this.logger.log(`E-mail enviado para ${dados.para}`)
      return { enviado: true, motivo: null }
    } catch (e) {
      this.logger.error(`Envio falhou: ${e instanceof Error ? e.message : e}`)
      return { enviado: false, motivo: 'erro' as const }
    }
  }
}
