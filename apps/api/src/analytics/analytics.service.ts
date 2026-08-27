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
/**
 * O QUE NÃO CONTA PARA AS MÉTRICAS.
 *
 * Uma constante e não um filtro escrito à mão em cada consulta: são nove
 * consultas neste ficheiro e bastava esquecer uma para o painel voltar a
 * discordar de si próprio, que é o defeito que este projeto já teve três vezes.
 */
const SO_VISITAS_REAIS = { ignoradoNasMetricas: false } as const

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
      chegaramAoFimDoPv,
      contatosPv,
      cliquesEmComprar,
    ] = await Promise.all([
      this.prisma.visitor.count({ where: { projectId, ...SO_VISITAS_REAIS } }),
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
          where: {
            projectId,
            ...SO_VISITAS_REAIS,
            userId: { not: null },
            user: { is: { status: 'ACTIVE' } },
          },
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
      this.contagens.partilhasDoProjecto(projectId),
      this.prisma.event.count({ where: { projectId, type: 'SHARE_LINK_CLICKED' } }),
      // O PV é contado somando TODAS as letras: é um só Produto Vivo,
      // apresentado em vinte e seis lugares. Por isso não há filtro de
      // conteúdo aqui — e é justamente esse número que diz quantas empresas
      // podem estar olhando.
      this.prisma.event.count({ where: { projectId, type: 'PV_CLICK' } }),
      // Quem foi até o fim e pediu para entrar no grupo. É este o número que
      // responde "existem 10, 20 ou 50 empresas interessadas?".
      /**
       * O DEGRAU DO MEIO DO FUNIL, que não existia.
       *
       * Havia o primeiro (tocou no selo, por curiosidade) e o último (pediu para
       * entrar no grupo, por intenção), e nada pelo meio. Sem isto não se sabe
       * se quem não entrou no grupo se desinteressou pela proposta ou nunca
       * chegou a lê-la, e são duas conclusões comerciais opostas. Ele pediu-o
       * em 27/08 e passa a ser marcado quando o fim da apresentação entra mesmo
       * no ecrã, uma vez por visita.
       */
      this.prisma.event.count({
        where: { projectId, type: 'CUSTOM', props: { path: ['acao'], equals: 'pv_ate_ao_fim' } },
      }),
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
      chegaramAoFimDoPv,
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
      WHERE v."projectId" = ${projectId}::uuid AND v."ignoradoNasMetricas" = false
      GROUP BY 1 ORDER BY 2 DESC`

    return linhas.map((l) => ({
      pais: l.pais,
      nome: nomeDoPais(l.pais),
      visitantes: l.visitantes,
      cadastros: l.cadastros,
    }))
  }

  /**
   * As visitas que formaram o número de um país, uma a uma.
   *
   * Ele desconfiou do painel em 27/08 e a desconfiança era justificada: 66 dos
   * acessos eram meus. Pediu para poder abrir "Alemanha 66" e ver o que está lá
   * dentro, e tem razão em querer isso antes de decidir em que idioma traduzir a
   * plataforma.
   *
   * MOSTRA O QUE EXISTE, E DIZ O QUE NÃO EXISTE. Ele pediu também IP em cru,
   * ASN, operadora, deteção de VPN e user-agent. Nada disso está guardado, por
   * decisão de privacidade tomada no princípio: o endereço é truncado a uma
   * faixa de rede e depois resumido com uma chave do servidor, e o user-agent
   * idem. A política publicada em nome dele promete isso às famílias. Devolver
   * essa lista obrigaria a passar a guardar dado pessoal de cada criança que
   * abre a plataforma.
   *
   * O que se pode dar é isto, e chega para a pergunta dele: quantas visitas,
   * quantas faixas de rede distintas, e cada visita com data, aparelho, se já
   * cá tinha estado e por onde chegou.
   */
  async visitasDoPais(projectSlug: string, pais: string | null, limite = 200) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    })
    if (!project) return { pais, total: 0, redesDistintas: 0, visitas: [] }

    const onde = {
      projectId: project.id,
      ...SO_VISITAS_REAIS,
      countryCode: pais === 'SEM_PAIS' ? null : pais,
    }

    const [total, visitas] = await Promise.all([
      this.prisma.visitor.count({ where: onde }),
      this.prisma.visitor.findMany({
        where: onde,
        orderBy: { firstSeenAt: 'desc' },
        take: limite,
        select: {
          id: true,
          anonId: true,
          ipHash: true,
          deviceType: true,
          firstSeenAt: true,
          lastSeenAt: true,
          rootPlatform: true,
          chainDepth: true,
          userId: true,
        },
      }),
    ])

    // Faixas de rede distintas: é o mais perto que se chega de "quantas pessoas
    // diferentes", sem guardar endereços. Foi assim que se provou que os 66 da
    // Alemanha eram uma máquina só.
    const redes = new Set(visitas.map((v) => v.ipHash).filter(Boolean))

    return {
      pais,
      total,
      redesDistintas: redes.size,
      visitas: visitas.map((v) => ({
        id: v.id,
        visitante: v.anonId.slice(0, 8),
        rede: v.ipHash ? v.ipHash.slice(0, 8) : null,
        aparelho: v.deviceType,
        primeiraVez: v.firstSeenAt,
        ultimaVez: v.lastSeenAt,
        repetida: v.lastSeenAt.getTime() - v.firstSeenAt.getTime() > 60_000,
        origem: v.rootPlatform ?? 'DIRECT',
        temConta: Boolean(v.userId),
        profundidade: v.chainDepth,
      })),
    }
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
      WHERE v."projectId" = ${projectId}::uuid AND v."ignoradoNasMetricas" = false AND v."firstSeenAt" >= ${desde}
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
      WHERE v."projectId" = ${projectId}::uuid AND v."ignoradoNasMetricas" = false
      GROUP BY 1 ORDER BY 2 DESC`
  }

  private async origemDeCadastros(projectId: string) {
    return this.prisma.$queryRaw<Array<{ plataforma: string; cadastros: number }>>`
      SELECT COALESCE(v."rootPlatform"::text, 'DESCONHECIDA') AS plataforma,
             count(*)::int                                    AS cadastros
      FROM visitors v
      WHERE v."projectId" = ${projectId}::uuid AND v."ignoradoNasMetricas" = false AND v."userId" IS NOT NULL
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
      this.prisma.visitor.count({ where: { projectId, ...SO_VISITAS_REAIS, chainDepth: 0 } }),
      this.prisma.visitor.count({
        where: { projectId, ...SO_VISITAS_REAIS, chainDepth: { gt: 0 } },
      }),
      this.prisma.visitor.count({
        where: { projectId, ...SO_VISITAS_REAIS, chainDepth: { gt: 0 }, userId: { not: null } },
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
/**
 * O nome do país por extenso, em português, para qualquer código.
 *
 * ISTO ERA UMA TABELA DE QUINZE PAÍSES, escrita à mão e toda lusófona ou
 * europeia. Quem chegasse de fora dela ficava com o código cru na tela, e ele
 * apanhou-o em 27/08: "aparecem códigos como TH e TW, quero o nome completo".
 * Tinha razão, e uma tabela à mão nunca ia acompanhar de onde as pessoas vêm.
 *
 * `Intl.DisplayNames` sabe os nomes de todos os países e vem com o Node. Não há
 * lista para manter e não há país que fique de fora. Se um dia o código não for
 * um país (vem 'XX' de alguma base), devolve o próprio código em vez de
 * rebentar, que é o que se quer num painel.
 */
const NOMES_DE_PAIS = new Intl.DisplayNames(['pt'], { type: 'region' })

function nomeDoPais(codigo: string | null): string {
  if (!codigo) return 'Sem identificar'
  try {
    return NOMES_DE_PAIS.of(codigo) ?? codigo
  } catch {
    return codigo
  }
}
