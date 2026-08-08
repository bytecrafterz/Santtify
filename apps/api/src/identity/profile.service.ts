import { Injectable, NotFoundException } from '@nestjs/common'
import { EventType } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Perfil do usuário: "My Posts", "Meu Registro" e "Meus Lançamentos".
 *
 * NOTA DE ESCOPO: o cliente listou as três seções sem definir o que são
 * "Meu Registro" e "Meus Lançamentos". A pergunta foi feita a ele. Até a
 * resposta chegar:
 *
 *   - "Minhas Publicações" = comentários da pessoa (definição segura).
 *   - "Meu Registro"       = histórico de atividade dela na plataforma,
 *                            construído a partir dos eventos brutos.
 *   - "Meus Lançamentos"   = NÃO construído. Não vale adivinhar e refazer.
 *
 * O histórico sai do log de eventos que já existe — nenhuma tabela nova foi
 * precisa. É o primeiro retorno concreto da decisão de gravar evento bruto.
 */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

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
        createdAt: true,
      },
    })
    if (!user) throw new NotFoundException('Usuário não encontrado')

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

  /** "Minhas Publicações" — o que a pessoa escreveu. */
  async publicacoes(userId: string, limite = 50) {
    const comments = await this.prisma.comment.findMany({
      where: { userId, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        body: true,
        createdAt: true,
        content: { select: { slug: true, title: true, project: { select: { slug: true } } } },
      },
    })
    return comments
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
