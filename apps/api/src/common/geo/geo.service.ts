import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { open, type Reader, type CountryResponse, type CityResponse } from 'maxmind'
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
 * PAÍS, REGIÃO E CIDADE. A região e a cidade entraram em 28/08, a pedido dele,
 * e com a ressalva que eu já tinha escrito aqui quando só havia país: num
 * telemóvel o endereço é o da operadora, e a cidade que sai é onde está o
 * equipamento dela e não onde está a pessoa. A ressalva não desapareceu porque
 * a função existe; foi para o ecrã, ao lado do número, onde ele a lê.
 *
 * NOMES E NUNCA COORDENADAS. A base devolve latitude e longitude por cada
 * endereço. Nada disso é lido aqui nem guardado em lado nenhum. Um ponto no
 * mapa de uma criança é outra categoria de dado, e não é a que ele pediu.
 *
 * Sem a base instalada devolve nulo e a plataforma segue. Nunca foi condição
 * para nada funcionar, e não passa a ser agora.
 */
@Injectable()
export class GeoService implements OnModuleInit {
  private readonly logger = new Logger(GeoService.name)
  private leitor: Reader<CountryResponse> | null = null
  private leitorDeCidade: Reader<CityResponse> | null = null

  async onModuleInit() {
    const caminho = process.env.GEOIP_PAIS_DB ?? '/app/geo/dbip-country-lite.mmdb'
    if (!existsSync(caminho)) {
      this.logger.warn(`Sem base de países em ${caminho}; a origem fica por identificar.`)
      // Sem `return`: as duas bases são independentes, e a de cidade sozinha
      // também resolve o país. Um `return` aqui deixaria a base grande por
      // abrir só porque falta a pequena.
      await this.carregarCidades()
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

    await this.carregarCidades()
  }

  /**
   * A base de cidade é opcional e é grande (125 MB abertos).
   *
   * Se não estiver lá, fica um aviso e a região e a cidade saem vazias; o país
   * continua a sair da base pequena. Uma máquina de desenvolvimento sem a base
   * grande não pode ser uma máquina onde a plataforma não arranca.
   */
  private async carregarCidades() {
    const caminho = process.env.GEOIP_CIDADE_DB ?? '/app/geo/dbip-city-lite.mmdb'
    if (!existsSync(caminho)) {
      this.logger.warn(`Sem base de cidades em ${caminho}; região e cidade ficam vazias.`)
      return
    }
    try {
      this.leitorDeCidade = await open<CityResponse>(caminho)
      this.logger.log('Base de cidades carregada.')
    } catch (e) {
      this.logger.error(
        `Não consegui abrir a base de cidades: ${e instanceof Error ? e.message : e}`,
      )
    }
  }

  /**
   * Nome da região e da cidade em português.
   *
   * A base gratuita só traz `en` para cidades e regiões: devolve "Lisbon" e
   * "Saxony". O país vem traduzido, a cidade não. Para quem lê o painel em
   * português, "Lisbon" parece defeito.
   *
   * A tabela cobre Portugal inteiro (os dezoito distritos e as ilhas) porque é
   * onde ele está, mais o punhado de casos noutros países onde o inglês muda o
   * nome. O Brasil não precisa de tabela: "São Paulo" e "Minas Gerais" saem
   * iguais nas duas línguas. O que não estiver aqui sai como vem, que é melhor
   * do que sair vazio.
   */
  private static readonly EM_PORTUGUES: Record<string, string> = {
    Lisbon: 'Lisboa',
    Oporto: 'Porto',
    Azores: 'Açores',
    Madeira: 'Madeira',
    Setubal: 'Setúbal',
    Santarem: 'Santarém',
    Evora: 'Évora',
    Braganca: 'Bragança',
    'Castelo Branco': 'Castelo Branco',
    Viseu: 'Viseu',
    Guarda: 'Guarda',
    Faro: 'Faro',
    Beja: 'Beja',
    Aveiro: 'Aveiro',
    Braga: 'Braga',
    Coimbra: 'Coimbra',
    Leiria: 'Leiria',
    Portalegre: 'Portalegre',
    'Viana do Castelo': 'Viana do Castelo',
    'Vila Real': 'Vila Real',
    // Fora de Portugal, onde o inglês muda mesmo o nome.
    Saxony: 'Saxónia',
    Bavaria: 'Baviera',
    Cologne: 'Colónia',
    Munich: 'Munique',
    Geneva: 'Genebra',
    Zurich: 'Zurique',
    Seville: 'Sevilha',
    'The Hague': 'Haia',
    Florence: 'Florença',
    Rome: 'Roma',
    Milan: 'Milão',
    Venice: 'Veneza',
    Naples: 'Nápoles',
    Athens: 'Atenas',
    Warsaw: 'Varsóvia',
    Moscow: 'Moscovo',
    'New York': 'Nova Iorque',
  }

  private static emPortugues(nome: string | undefined | null): string | null {
    if (!nome) return null
    return GeoService.EM_PORTUGUES[nome] ?? nome
  }

  /**
   * País, região e cidade de uma só leitura.
   *
   * Uma leitura e não três: a base de cidade já traz o país lá dentro, e abrir
   * o ficheiro duas vezes por visita não acrescenta nada.
   */
  localizacao(ip: string | null | undefined): {
    pais: string | null
    regiao: string | null
    cidade: string | null
  } {
    const vazio = { pais: null, regiao: null, cidade: null }
    if (!ip || this.ehRedeLocal(ip)) return vazio

    if (this.leitorDeCidade) {
      try {
        const d = this.leitorDeCidade.get(ip)
        if (d) {
          return {
            pais: d.country?.iso_code ?? null,
            regiao: GeoService.emPortugues(d.subdivisions?.[0]?.names?.en),
            cidade: GeoService.emPortugues(d.city?.names?.en),
          }
        }
      } catch {
        // Cai para a base de países em baixo.
      }
    }

    // Sem base de cidade instalada, o país continua a sair. Foi sempre assim e
    // continua a ser: nada aqui é condição para a plataforma funcionar.
    return { ...vazio, pais: this.pais(ip) }
  }

  private ehRedeLocal(ip: string): boolean {
    return ip.startsWith('10.') || ip.startsWith('192.168.') || ip === '127.0.0.1'
  }

  /** Devolve "PT", "BR"... ou nulo quando não dá para saber. */
  pais(ip: string | null | undefined): string | null {
    if (!this.leitor || !ip) return null
    // Endereços de rede local não têm país nenhum, e perguntar por eles só
    // enche o registo de nulos com ar de falha.
    if (this.ehRedeLocal(ip)) return null
    try {
      return this.leitor.get(ip)?.country?.iso_code ?? null
    } catch {
      return null
    }
  }
}
