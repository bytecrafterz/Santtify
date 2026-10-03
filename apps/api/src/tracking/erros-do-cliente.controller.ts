import { Body, Controller, HttpCode, Logger, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { IsOptional, IsString, MaxLength } from 'class-validator'

class ErroDoClienteDto {
  @IsString() @MaxLength(500) mensagem!: string
  @IsOptional() @IsString() @MaxLength(4000) pilha?: string
  @IsOptional() @IsString() @MaxLength(2000) componentes?: string
  @IsOptional() @IsString() @MaxLength(300) url?: string
  /** "render" (a página caiu), "janela" (erro solto), "promessa" (rejeição solta). */
  @IsOptional() @IsString() @MaxLength(20) tipo?: string
  @IsOptional() @IsString() @MaxLength(80) digest?: string
}

/**
 * OS ERROS QUE ACONTECEM NO TELEMÓVEL DE QUEM USA (03/10).
 *
 * Em 03/10 o cliente mandou um ecrã branco com "Application error: a
 * client-side exception has occurred" — no iPhone dele, ao escolher a foto do
 * cartão — e o servidor não tinha nada: o erro acontece no aparelho e morre
 * lá. Nenhum teste no WebKit do computador o reproduzia.
 *
 * Agora o site manda o erro para aqui (`RelatorDeErros`, `error.tsx`,
 * `global-error.tsx`), e ele fica no registo da API: a mensagem, a pilha, a
 * página e o aparelho. Nada da pessoa — nem foto, nem nome, nem conta: a
 * mensagem de um erro de código é sobre o código.
 *
 * Não grava em base de dados: o registo chega para diagnosticar, e um ponto de
 * entrada público que escreve na base é um convite.
 */
@Controller('erros-do-cliente')
export class ErrosDoClienteController {
  private readonly logger = new Logger('ErroNoAparelho')
  private recentes: number[] = []

  @Post()
  @HttpCode(204)
  registar(@Body() dto: ErroDoClienteDto, @Req() req: Request) {
    // Um aparelho em ciclo de erro não pode encher o registo: no máximo 60 por
    // minuto, de todos juntos.
    const agora = Date.now()
    this.recentes = this.recentes.filter((t) => agora - t < 60_000)
    if (this.recentes.length >= 60) return
    this.recentes.push(agora)

    const agente = String(req.headers['user-agent'] ?? '').slice(0, 200)
    this.logger.warn(
      JSON.stringify({
        tipo: dto.tipo ?? 'render',
        mensagem: dto.mensagem,
        url: dto.url,
        digest: dto.digest,
        agente,
        pilha: dto.pilha,
        componentes: dto.componentes,
      }),
    )
  }
}
