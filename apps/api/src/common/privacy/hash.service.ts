import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'

/**
 * Pseudonimização de IP e user-agent.
 *
 * O fluxo de eventos nunca guarda o valor cru — só o HMAC com salt de servidor.
 * Isso preserva a correlação técnica (mesmo dispositivo, mesma sessão) sem
 * armazenar dado pessoal, que é o que GDPR e LGPD pedem.
 */
@Injectable()
export class HashService {
  private readonly salt: string

  constructor(config: ConfigService) {
    this.salt = config.getOrThrow<string>('PRIVACY_HASH_SALT')
  }

  hash(value: string | undefined | null): string | null {
    if (!value) return null
    return createHmac('sha256', this.salt).update(value).digest('base64url').slice(0, 32)
  }

  /**
   * O IP é truncado antes do hash, reduzindo a granularidade a uma faixa de
   * rede em vez de um dispositivo. Preserva a leitura de país/região e derruba
   * a capacidade de identificar a pessoa.
   */
  hashIp(ip: string | undefined | null): string | null {
    if (!ip) return null
    const truncado = ip.includes(':')
      ? ip.split(':').slice(0, 4).join(':') // /64 do IPv6
      : ip.split('.').slice(0, 3).join('.') // /24 do IPv4
    return this.hash(truncado)
  }
}
