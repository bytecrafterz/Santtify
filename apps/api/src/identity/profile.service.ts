import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventType, MediaKind } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { normalizarNomeDeUtilizador, problemaNoNomeDeUtilizador } from './nome-de-utilizador'
import { limparNomeDePerfil, problemaNoNomeDePerfil } from './nome-de-perfil'
import { StorageService } from '../admin/storage.service'

/**
 * Perfil do usuário: os números do topo e "Meu Registro".
 *
 * A lista do My Post saiu daqui em 12/08 e foi para o PostsService: quem
 * decide o que nasce pendente tem de ser o mesmo que decide o que o autor
 * enxerga, senão a foto esperando aprovação some da tela de quem a enviou.
 *
 * O histórico sai do log de eventos que já existe — nenhuma tabela nova foi
 * precisa. É o primeiro retorno concreto da decisão de gravar evento bruto.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Edição do próprio perfil: foto, nome, descrição e responsável.
   *
   * Multipart numa chamada só, pelo mesmo motivo do My Post: enviar arquivo e
   * dados em requisições separadas deixa foto órfã no disco sempre que a
   * segunda falha.
   *
   * Campo ausente e campo vazio são coisas diferentes aqui. Não mandar `bio`
   * significa "não mexi nisso"; mandar `bio` vazia significa "quero apagar".
   * Sem essa distinção, guardar só o nome apagaria a descrição sem ninguém
   * pedir.
   */
  async atualizarPerfil(
    userId: string,
    dados: {
      displayName?: string
      username?: string
      bio?: string
      guardianName?: string
      removerFoto?: string
    },
    foto?: Express.Multer.File,
  ) {
    const dadosParaGravar: {
      displayName?: string
      username?: string
      bio?: string | null
      guardianName?: string | null
      avatarUrl?: string | null
    } = {}

    /*
      A MESMA RÉGUA DA EDIÇÃO E DO CADASTRO.

      Medir só no cadastro não servia de nada: bastava criar a conta com um nome
      bom e trocá-lo a seguir por "24055".
    */
    if (dados.displayName !== undefined) {
      const problemaNoNome = problemaNoNomeDePerfil(dados.displayName)
      if (problemaNoNome) throw new BadRequestException(problemaNoNome)
      dadosParaGravar.displayName = limparNomeDePerfil(dados.displayName)
    }

    /*
      O @identificador pode ser trocado, e é medido pela mesma régua do cadastro.

      Podia ser imutável, e pensei nisso: um identificador que nunca muda é mais
      fácil de tratar. Mas quem se cadastrou às pressas com um identificador de
      que não gosta ou que revela o nome da criança tem de o poder corrigir, e
      numa plataforma usada por famílias essa segunda razão manda mais do que a
      minha conveniência.

      O identificador antigo fica livre para outra pessoa. É o mesmo que as
      outras plataformas fazem, e a alternativa — reservá-lo para sempre — encheria
      o espaço de nomes com nomes de ninguém.
    */
    if (dados.username !== undefined) {
      const nome = normalizarNomeDeUtilizador(dados.username)
      const eu = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, role: true },
      })
      /*
        GRAVAR O QUE JÁ LÁ ESTÁ NÃO É MUDAR NADA.

        Sem isto, quem abrisse a edição do perfil e gravasse o nome ou a
        descrição levava com as regras do identificador outra vez — incluindo
        regras criadas DEPOIS de ele o ter escolhido. Era assim que se tirava a
        alguém um identificador que a própria plataforma lhe tinha dado, e o
        primeiro a apanhá-lo seria o responsável, que é `@santtifyoficial`.
      */
      if (nome !== (eu?.username ?? null)) {
        // Quem é da casa pode usar o nome da casa.
        const problema = problemaNoNomeDeUtilizador(nome, eu?.role === 'ADMIN')
        if (problema) throw new BadRequestException(problema)
      }
      const tomado = await this.prisma.user.findUnique({
        where: { username: nome },
        select: { id: true },
      })
      // Gravar o seu próprio identificador outra vez não é um conflito.
      if (tomado && tomado.id !== userId) {
        throw new BadRequestException(`O identificador @${nome} já está em uso.`)
      }
      dadosParaGravar.username = nome
    }
    if (dados.bio !== undefined) dadosParaGravar.bio = dados.bio.trim() || null
    if (dados.guardianName !== undefined) {
      dadosParaGravar.guardianName = dados.guardianName.trim() || null
    }

    if (foto) {
      if (this.storage.tipoDe(foto.mimetype) !== MediaKind.IMAGE) {
        throw new BadRequestException('A foto do perfil precisa ser uma imagem.')
      }
      const salvo = await this.storage.salvar(foto)
      dadosParaGravar.avatarUrl = salvo.url
    } else if (dados.removerFoto === 'sim') {
      /*
        Remover a fotografia, que o desenho dele de 31/08 pede ao lado de
        "Alterar Foto". Só quando NÃO vem ficheiro: enviar uma foto nova e
        pedir para remover ao mesmo tempo é uma contradição, e nesse caso vale
        a foto nova, que é a acção mais recente da pessoa.

        O ficheiro antigo fica no disco. Apagá-lo daria trabalho e nenhum
        proveito: ninguém tem o endereço, e quem apaga a conta inteira já leva
        os dados pessoais atrás.
      */
      dadosParaGravar.avatarUrl = null
    }

    if (Object.keys(dadosParaGravar).length === 0) return this.perfil(userId)

    await this.prisma.user.update({ where: { id: userId }, data: dadosParaGravar })
    return this.perfil(userId)
  }

  /**
   * Filtro de "tudo o que esta pessoa fez", inclusive antes de ter conta.
   *
   * Os eventos gravados antes do cadastro têm `userId` nulo — eram de um
   * visitante anônimo. Como o log é append-only, não se volta atrás para
   * carimbar o usuário neles: reescrever histórico é exatamente o que o
   * projeto proíbe. O caminho certo é ler pelo elo visitante → usuário.
   *
   * Vale para qualquer pergunta futura por usuário, no dashboard também:
   * contar só por `event.userId` perde tudo o que aconteceu antes do cadastro,
   * que é justamente a parte mais interessante do funil.
   */
  private eventosDaPessoa(userId: string) {
    return { OR: [{ userId }, { visitor: { userId } }] }
  }

  async perfil(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        guardianName: true,
        createdAt: true,
      },
    })
    if (!user) throw new NotFoundException('Usuário não encontrado')

    // Comentários, e não publicações: o My Post saiu da interface em 12/08 e um
    // número que a pessoa não consegue explicar olhando a tela é pior do que
    // número nenhum.
    const [comentarios, curtidas, compartilhamentos, conteudosVistos] = await Promise.all([
      this.prisma.comment.count({ where: { userId, status: 'PUBLISHED' } }),
      this.prisma.reaction.count({ where: { userId } }),
      /**
       * Partilhas com a mesma definição do resto da plataforma.
       *
       * Contava só as linhas de `Share`, que nascem do fluxo antigo do link
       * rastreado, e por isso dizia 2 a quem tinha partilhado dezenas de vezes.
       * Partilhar uma faixa ou um perfil grava um evento, e ficava de fora. É o
       * mesmo defeito que o painel de métricas tinha.
       */
      Promise.all([
        this.prisma.share.count({ where: { userId } }),
        /**
         * DOIS `OR` NA MESMA CONSULTA E UM APAGA O OUTRO.
         *
         * `eventosDaPessoa` devolve `{ OR: [...] }` para dizer de quem é o
         * evento. Espalhá-lo aqui e escrever outro `OR` a seguir, para dizer
         * qual é a acção, não junta as duas condições: a segunda substitui a
         * primeira. O filtro da pessoa desaparecia sem erro nenhum, e a conta
         * passava a contar TODAS as partilhas da plataforma.
         *
         * Viu-se numa conta criada minutos antes, que nunca partilhou nada, a
         * mostrar 59 partilhas. Defeito meu, introduzido hoje ao corrigir a
         * definição de partilha.
         */
        this.prisma.event.count({
          where: {
            AND: [
              this.eventosDaPessoa(userId),
              {
                OR: ['partilhar_conteudo', 'partilhar_faixa', 'partilhar_perfil'].map((acao) => ({
                  props: { path: ['acao'], equals: acao },
                })),
              },
            ],
            type: EventType.CUSTOM,
          },
        }),
      ]).then(([linhas, eventos]) => linhas + eventos),
      this.prisma.event
        .findMany({
          where: {
            ...this.eventosDaPessoa(userId),
            type: EventType.CONTENT_VIEW,
            contentId: { not: null },
          },
          distinct: ['contentId'],
          select: { contentId: true },
        })
        .then((r) => r.length),
    ])

    return {
      user,
      estatisticas: { comentarios, curtidas, compartilhamentos, conteudosVistos },
    }
  }

  /**
   * "Meu Registro" — histórico de atividade, lido dos eventos brutos.
   *
   * Só tipos que fazem sentido mostrar à própria pessoa. Eventos técnicos
   * (SESSION_START, PAGE_VIEW) ficam de fora: são para o dashboard, não para
   * o usuário.
   */
  async registro(userId: string, limite = 50) {
    const eventos = await this.prisma.event.findMany({
      where: {
        ...this.eventosDaPessoa(userId),
        type: {
          in: [
            EventType.SIGNUP,
            EventType.CONTENT_VIEW,
            EventType.MEDIA_COMPLETE,
            EventType.LIKE,
            EventType.COMMENT,
            EventType.SHARE_CREATED,
          ],
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: limite,
      select: {
        id: true,
        type: true,
        occurredAt: true,
        props: true,
        content: { select: { slug: true, title: true, project: { select: { slug: true } } } },
      },
    })

    // BigInt não é serializável em JSON; o id vira string.
    return eventos.map((e) => ({ ...e, id: e.id.toString() }))
  }
}
