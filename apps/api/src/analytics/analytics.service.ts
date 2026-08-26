import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ContagensService } from '../social/contagens.service'

/**
 * Dashboard das métricas essenciais da Fase 1.
 *
 * Tudo aqui é lido dos EVENTOS BRUTOS, não de contadores. É mais caro por
 * consulta e é a escolha certa: qualquer número mostrado ao cliente pode ser
 * auditado até o evento que o originou, e nenhum agregado pode divergir da
 * verdade sem ser recalculável.
 *
 * As comparações cruzadas, o funil por campanha e a árvore visual são Fase 2 —
 * combinado por escrito com o cliente. O que está aqui é exatamente a lista de
 * métricas essenciais do escopo acordado.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contagens: ContagensService,
  ) {}

  async visaoGeral(projectSlug: string, dias = 30) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true, slug: true, name: true, createdAt: true },
    })
    if (!project) throw new NotFoundException('Projeto não encontrado')

    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

    const [
      totais,
      porDia,
      origemVisitantes,
      origemCadastros,
      propagacao,
      conteudos,
      diaZero,
      porPais,
    ] = await Promise.all([
      this.totais(project.id),
      this.novosPorDia(project.id, desde),
      this.origemDeVisitantes(project.id),
      this.origemDeCadastros(project.id),
      this.propagacao(project.id),
      this.conteudosMaisAcessados(project.id),
      this.marcoDiaZero(project.id),
      this.porPais(project.id),
    ])

    return {
      project,
      periodoDias: dias,
      totais,
      porDia,
      origemVisitantes,
      origemCadastros,
      propagacao,
      conteudos,
      diaZero,
      porPais,
    }
  }

  /** Visitantes, cadastros, interações. */
  private async totais(projectId: string) {
    const [
      visitantes,
      cadastros,
      visualizacoes,
      curtidas,
      comentarios,
      compartilhamentos,
      cliquesEmPartilha,
      cliquesNoPv,
      contatosPv,
      cliquesEmComprar,
    ] = await Promise.all([
      this.prisma.visitor.count({ where: { projectId } }),
      /**
       * CADASTROS SÃO PESSOAS, e não linhas de visitante.
       *
       * Isto contava linhas. Cada navegador, cada telemóvel e cada janela
       * privada cria uma linha de visitante nova, e ao entrar na conta essa
       * linha passa a apontar para a pessoa. Uma pessoa com três aparelhos
       * contava três vezes.
       *
       * Na base dele hoje: 56 linhas para 7 pessoas. A Família Caxito sozinha
       * tinha 31 linhas. O painel dizia catorze cadastros e ele só conseguia
       * ver três perfis — apanhou a diferença em 25/08 e pediu para descobrir
       * de onde vinha. Vinha daqui.
       *
       * A lista da comunidade sempre contou por pessoa. Passam a contar o
       * mesmo, que é a única forma de os dois números não se contradizerem no
       * mesmo ecrã.
       */
      /**
       * E SÓ CONTAS QUE AINDA EXISTEM.
       *
       * Contava toda a linha de visitante com dono, incluindo os donos cuja
       * conta já foi removida. Em 27/08 o painel dizia oito cadastros e ele só
       * tinha sete pessoas: a oitava era uma conta de teste minha, desactivada
       * no dia anterior. A lista da comunidade já escondia contas removidas
       * desde 25/08; este número não, e por isso os dois discordavam no mesmo
       * ecrã outra vez.
       */
      this.prisma.visitor
        .findMany({
          where: { projectId, userId: { not: null }, user: { is: { status: 'ACTIVE' } } },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((v) => v.length),
      /**
       * Visualizações do projecto inteiro: aberturas de conteúdo.
       *
       * O painel mostrava visitantes e cadastros, e ele pediu em 27/08 os
       * números que vai APRESENTAR A UMA EMPRESA. Visitantes responde quantas
       * pessoas entraram; visualizações responde quantas vezes o conteúdo foi
       * mesmo aberto, que é outra coisa e é a que interessa a quem compra.
       */
      this.prisma.event.count({ where: { projectId, type: 'CONTENT_VIEW' } }),
      this.prisma.reaction.count({ where: { projectId, user: { is: { status: 'ACTIVE' } } } }),
      this.contagens.comentariosDoProjecto(projectId),
      this.prisma.share.count({ where: { shortLink: { projectId } } }),
      this.prisma.event.count({ where: { projectId, type: 'SHARE_LINK_CLICKED' } }),
      // O PV é contado somando TODAS as letras: é um só Produto Vivo,
      // apresentado em vinte e seis lugares. Por isso não há filtro de
      // conteúdo aqui — e é justamente esse número que diz quantas empresas
      // podem estar olhando.
      this.prisma.event.count({ where: { projectId, type: 'PV_CLICK' } }),
      // Quem foi até o fim e pediu para entrar no grupo. É este o número que
      // responde "existem 10, 20 ou 50 empresas interessadas?".
      this.prisma.event.count({ where: { projectId, type: 'PV_CONTACT' } }),
      this.prisma.event.count({ where: { projectId, type: 'CHECKOUT_CLICKED' } }),
    ])

    // Conversão de visita para cadastro: a pergunta comercial central.
    const conversao = visitantes > 0 ? Number(((cadastros / visitantes) * 100).toFixed(1)) : 0

    return {
      visitantes,
      cadastros,
      visualizacoes,
      conversao,
      curtidas,
      comentarios,
      compartilhamentos,
      cliquesEmPartilha,
      cliquesNoPv,
      contatosPv,
      cliquesEmComprar,
    }
  }

  /**
   * De que países vêm as visitas e os cadastros.
   *
   * Ele pediu a origem em 25/08: país, região e cidade. Devolvo PAÍS, e digo
   * porquê em vez de fingir o resto.
   *
   * O país sai de uma base offline pelo endereço de rede, e é fiável. A região
   * e a cidade saem da mesma família de bases e não são: num telemóvel o
   * endereço pertence à operadora, e a cidade que ela devolve é onde está o
   * equipamento dela. Numa plataforma que vai correr quase toda em telemóveis,
   * isso daria uma lista de cidades onde a operadora tem antenas, com ar de ser
   * onde estão as famílias. Um número errado com aspecto de certo é pior do que
   * número nenhum, e este ia para decisões de divulgação.
   *
   * "SEM IDENTIFICAR" é uma linha honesta e não um erro. São as visitas
   * anteriores a 25/08, quando o campo nunca chegou a ser preenchido, mais as
   * que vêm de redes que a base não conhece.
   */
  private async porPais(projectId: string) {
    const linhas = await this.prisma.$queryRaw<
      Array<{ pais: string | null; visitantes: number; cadastros: number }>
    >`
      SELECT v."countryCode"                                  AS pais,
             count(*)::int                                    AS visitantes,
             count(DISTINCT v."userId")::int                   AS cadastros
      FROM visitors v
      WHERE v."projectId" = ${projectId}::uuid
      GROUP BY 1 ORDER BY 2 DESC`

    return linhas.map((l) => ({
      pais: l.pais,
      nome: l.pais ? (NOMES_DE_PAIS[l.pais] ?? l.pais) : 'Sem identificar',
      visitantes: l.visitantes,
      cadastros: l.cadastros,
    }))
  }

  /** Curva de crescimento a partir do Dia Zero. */
  private async novosPorDia(projectId: string, desde: Date) {
    return this.prisma.$queryRaw<Array<{ dia: Date; visitantes: number; cadastros: number }>>`
      SELECT date_trunc('day', v."firstSeenAt")::date              AS dia,
             count(*)::int                                         AS visitantes,
             -- Pessoas distintas, pela mesma razão do total acima: uma pessoa
             -- com três aparelhos continua a ser uma pessoa.
             count(DISTINCT v."userId")::int                       AS cadastros
      FROM visitors v
      WHERE v."projectId" = ${projectId}::uuid AND v."firstSeenAt" >= ${desde}
      GROUP BY 1 ORDER BY 1`
  }

  /**
   * Origem dos visitantes pela RAIZ da cadeia, não pelo toque imediato.
   *
   * A diferença importa: quem chegou por um compartilhamento de WhatsApp
   * originado no Instagram conta para o Instagram, porque foi o Instagram que
   * trouxe aquela pessoa para dentro. Contar pelo toque imediato faria o
   * WhatsApp parecer o maior canal de aquisição quando ele é só o meio de
   * propagação.
   */
  private async origemDeVisitantes(projectId: string) {
    return this.prisma.$queryRaw<Array<{ plataforma: string; visitantes: number }>>`
      SELECT COALESCE(v."rootPlatform"::text, 'DESCONHECIDA') AS plataforma,
             count(*)::int                                    AS visitantes
      FROM visitors v
      WHERE v."projectId" = ${projectId}::uuid
      GROUP BY 1 ORDER BY 2 DESC`
  }

  private async origemDeCadastros(projectId: string) {
    return this.prisma.$queryRaw<Array<{ plataforma: string; cadastros: number }>>`
      SELECT COALESCE(v."rootPlatform"::text, 'DESCONHECIDA') AS plataforma,
             count(*)::int                                    AS cadastros
      FROM visitors v
      WHERE v."projectId" = ${projectId}::uuid AND v."userId" IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC`
  }

  /**
   * Quanto do crescimento veio da propagação interna.
   *
   * É a prova comercial que o cliente quer poder mostrar a uma empresa:
   * "X por cento dos meus usuários foram trazidos pelos próprios usuários".
   */
  private async propagacao(projectId: string) {
    const [diretos, porPartilha, cadastrosPorPartilha] = await Promise.all([
      this.prisma.visitor.count({ where: { projectId, chainDepth: 0 } }),
      this.prisma.visitor.count({ where: { projectId, chainDepth: { gt: 0 } } }),
      this.prisma.visitor.count({
        where: { projectId, chainDepth: { gt: 0 }, userId: { not: null } },
      }),
    ])

    const total = diretos + porPartilha
    return {
      diretos,
      porPartilha,
      cadastrosPorPartilha,
      percentualPorPartilha: total > 0 ? Number(((porPartilha / total) * 100).toFixed(1)) : 0,
      // Quantos usuários novos cada pessoa adquirida diretamente trouxe.
      usuariosPorUsuario: diretos > 0 ? Number((porPartilha / diretos).toFixed(2)) : 0,
    }
  }

  private async conteudosMaisAcessados(projectId: string) {
    return this.prisma.$queryRaw<
      Array<{ titulo: string; slug: string; visualizacoes: number; visitantes: number }>
    >`
      SELECT c.title                        AS titulo,
             c.slug                         AS slug,
             count(e.id)::int                    AS visualizacoes,
             count(DISTINCT e."visitorId")::int AS visitantes
      FROM events e
      JOIN contents c ON c.id = e."contentId"
      WHERE e."projectId" = ${projectId}::uuid AND e.type = 'CONTENT_VIEW'
      GROUP BY c.title, c.slug
      ORDER BY 3 DESC
      LIMIT 10`
  }

  /** Linha de base de lançamento, para a curva ter um ponto de partida real. */
  private async marcoDiaZero(projectId: string) {
    return this.prisma.baselineSnapshot.findMany({
      where: { projectId, label: 'Dia Zero' },
      select: { platform: true, followers: true, capturedAt: true },
      orderBy: { followers: 'desc' },
    })
  }
}

/**
 * Os países que interessam a este projeto, por extenso.
 *
 * Uma tabela curta e não uma biblioteca: ele fala português a famílias em
 * Portugal e no Brasil, e o resto do mundo aparece pelo código de duas letras
 * até haver razão para o contrário. Acrescentar uma linha aqui custa menos do
 * que carregar duzentos nomes que ninguém vai ler.
 */
const NOMES_DE_PAIS: Record<string, string> = {
  PT: 'Portugal',
  BR: 'Brasil',
  AO: 'Angola',
  MZ: 'Moçambique',
  CV: 'Cabo Verde',
  GW: 'Guiné-Bissau',
  ST: 'São Tomé e Príncipe',
  TL: 'Timor-Leste',
  ES: 'Espanha',
  FR: 'França',
  GB: 'Reino Unido',
  CH: 'Suíça',
  LU: 'Luxemburgo',
  US: 'Estados Unidos',
  CA: 'Canadá',
}
