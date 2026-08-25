import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { open, type Reader, type CountryResponse } from 'maxmind'
import { existsSync } from 'node:fs'

/**
 * O país de onde vem uma visita, resolvido DENTRO do servidor.
 *
 * Ele pediu a origem dos acessos em 25/08. Havia uma coluna `countryCode` desde
 * o princípio e estava vazia nas 290 linhas: o código lia cabeçalhos de CDN
 * (`cf-ipcountry` e afins) que não existem atrás do Caddy. Nunca falhou nem deu
 * erro; simplesmente nunca teve o que ler.
 *
 * A RESOLUÇÃO É LOCAL, e essa é a decisão que interessa aqui. A alternativa
 * óbvia seria perguntar a um serviço externo por cada visita, e isso obrigaria a
 * mandar para fora o endereço de rede de cada criança que abre a plataforma. A
 * política de privacidade publicada em nome dele promete o contrário: o IP é
 * resumido e nunca guardado em cru. Uma base offline respeita essa promessa e
 * não custa nada em latência.
 *
 * SÓ PAÍS. Existe base de cidade, e não a uso sem lhe explicar antes: num
 * telemóvel o endereço é o da operadora, e a "cidade" que ela devolve é onde
 * está o equipamento dela e não onde está a pessoa. Um número errado com ar de
 * certo é pior do que número nenhum.
 *
 * Sem a base instalada devolve nulo e a plataforma segue. Nunca foi condição
 * para nada funcionar, e não passa a ser agora.
 */
@Injectable()
export class GeoService implements OnModuleInit {
  private readonly logger = new Logger(GeoService.name)
  private leitor: Reader<CountryResponse> | null = null

  async onModuleInit() {
    const caminho = process.env.GEOIP_PAIS_DB ?? '/app/geo/dbip-country-lite.mmdb'
    if (!existsSync(caminho)) {
      this.logger.warn(`Sem base de países em ${caminho}; a origem fica por identificar.`)
      return
    }
    try {
      this.leitor = await open<CountryResponse>(caminho)
      this.logger.log('Base de países carregada.')
    } catch (e) {
      this.logger.error(
        `Não consegui abrir a base de países: ${e instanceof Error ? e.message : e}`,
      )
    }
  }

  /** Devolve "PT", "BR"... ou nulo quando não dá para saber. */
  pais(ip: string | null | undefined): string | null {
    if (!this.leitor || !ip) return null
    // Endereços de rede local não têm país nenhum, e perguntar por eles só
    // enche o registo de nulos com ar de falha.
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip === '127.0.0.1') return null
    try {
      return this.leitor.get(ip)?.country?.iso_code ?? null
    } catch {
      return null
    }
  }
}
