import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventType, MediaKind } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
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
    dados: { displayName?: string; bio?: string; guardianName?: string },
    foto?: Express.Multer.File,
  ) {
    const dadosParaGravar: {
      displayName?: string
      bio?: string | null
      guardianName?: string | null
      avatarUrl?: string
    } = {}

    if (dados.displayName !== undefined) dadosParaGravar.displayName = dados.displayName.trim()
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
      this.prisma.share.count({ where: { userId } }),
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
