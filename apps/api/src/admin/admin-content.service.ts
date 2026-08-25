import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { BlockType, CardEstado, CardPapel, ContentStatus, MediaKind, Prisma } from '@pv/db'
import { PrismaService } from '../prisma/prisma.service'
import { ShortLinksService } from '../short-links/short-links.service'

/**
 * Operações do painel administrativo.
 *
 * Tudo genérico sobre Project/Content: o painel que o cliente usa para as 26
 * letras é o mesmo que servirá o próximo projeto. Nenhuma rota menciona letra.
 *
 * Toda alteração é registrada em AdminAuditLog — se um conteúdo sumir ou mudar
 * sozinho, dá para saber quem fez e quando.
 */
@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shortLinks: ShortLinksService,
  ) {}

  /** Lista TUDO, inclusive rascunho — diferente da leitura pública. */
  async listar(projectSlug: string) {
    const project = await this.projeto(projectSlug)

    const contents = await this.prisma.content.findMany({
      where: { projectId: project.id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        status: true,
        position: true,
        publishedAt: true,
        updatedAt: true,
        stats: { select: { views: true, likes: true, comments: true, shares: true } },
        shortLink: {
          where: { kind: 'CONTENT_QR', active: true },
          select: { code: true },
          take: 1,
        },
        blocks: { select: { id: true, type: true, text: true, assetId: true } },
      },
    })

    return {
      project,
      contents: contents.map((c) => {
        const preenchidos = c.blocks.filter((b) => b.text || b.assetId).length
        return {
          id: c.id,
          slug: c.slug,
          title: c.title,
          subtitle: c.subtitle,
          status: c.status,
          position: c.position,
          publishedAt: c.publishedAt,
          updatedAt: c.updatedAt,
          stats: c.stats,
          qrCode: c.shortLink[0]?.code ?? null,
          // O cliente precisa ver de relance o que falta preencher.
          blocosPreenchidos: preenchidos,
          blocosTotal: c.blocks.length,
        }
      }),
    }
  }

  async detalhe(projectSlug: string, contentSlug: string) {
    const project = await this.projeto(projectSlug)
    const content = await this.prisma.content.findUnique({
      where: { projectId_slug: { projectId: project.id, slug: contentSlug } },
      include: {
        blocks: { orderBy: { position: 'asc' }, include: { asset: true, imageAsset: true } },
        metadata: true,
        shortLink: { where: { kind: 'CONTENT_QR', active: true }, take: 1 },
      },
    })
    if (!content) throw new NotFoundException('Conteúdo não encontrado')

    const code = content.shortLink[0]?.code ?? null
    return {
      project,
      content: {
        ...content,
        shortLink: undefined,
        qrCode: code,
        qrUrl: code ? this.shortLinks.urlPublica(code) : null,
      },
    }
  }

  async criarConteudo(
    projectSlug: string,
    dados: { slug: string; title: string; subtitle?: string; position?: number },
    adminId: string,
  ) {
    const project = await this.projeto(projectSlug)
    const slug = this.normalizarSlug(dados.slug)

    const existe = await this.prisma.content.findUnique({
      where: { projectId_slug: { projectId: project.id, slug } },
      select: { id: true },
    })
    if (existe) throw new BadRequestException(`Já existe um conteúdo com o endereço "${slug}"`)

    const ultimo = await this.prisma.content.findFirst({
      where: { projectId: project.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    /**
     * Entrar no meio da fila empurra os outros para baixo.
     *
     * Ele quis publicar uma Introdução na posição 1 com quatro conteúdos já
     * feitos. Sem isto, a alternativa era refazer os quatro à mão — apagar
     * textos, reenviar áudios — só para mudar a ordem por que aparecem. A
     * ordem é uma propriedade da lista, não do conteúdo, e mexer nela não pode
     * obrigar a tocar no que está lá dentro.
     */
    const posicaoPedida =
      dados.position && dados.position > 0
        ? Math.min(dados.position, (ultimo?.position ?? 0) + 1)
        : null

    if (posicaoPedida !== null) {
      await this.prisma.content.updateMany({
        where: { projectId: project.id, position: { gte: posicaoPedida } },
        data: { position: { increment: 1 } },
      })
    }

    const content = await this.prisma.content.create({
      data: {
        projectId: project.id,
        slug,
        title: dados.title.trim(),
        subtitle: dados.subtitle?.trim() || null,
        position: (ultimo?.position ?? 0) + 1,
        status: ContentStatus.DRAFT,
        stats: { create: {} },
        metadata: { create: {} },
      },
    })

    // QR gerado na criação, não na publicação: o cliente pode imprimir o
    // material antes de terminar de cadastrar o conteúdo.
    await this.shortLinks.criarQrDeConteudo({
      projectId: project.id,
      contentId: content.id,
      projectSlug: project.slug,
      contentSlug: slug,
    })

    await this.auditar(adminId, project.id, 'content.create', 'Content', content.id, { slug })
    return content
  }

  async atualizarConteudo(
    contentId: string,
    dados: { title?: string; subtitle?: string; summary?: string; coverUrl?: string; position?: number },
    adminId: string,
  ) {
    const content = await this.prisma.content.update({
      where: { id: contentId },
      data: {
        ...(dados.title !== undefined ? { title: dados.title.trim() } : {}),
        ...(dados.subtitle !== undefined ? { subtitle: dados.subtitle.trim() || null } : {}),
        ...(dados.summary !== undefined ? { summary: dados.summary.trim() || null } : {}),
        ...(dados.coverUrl !== undefined ? { coverUrl: dados.coverUrl || null } : {}),
        ...(dados.position !== undefined ? { position: dados.position } : {}),
      },
    })
    await this.auditar(adminId, content.projectId, 'content.update', 'Content', contentId, dados)
    return content
  }

  /**
   * Publicar exige conteúdo de verdade.
   *
   * Sem esta checagem o cliente publicaria uma página vazia sem perceber, e
   * quem escaneasse o QR encontraria só o título. O erro diz o que falta.
   */
  async publicar(contentId: string, publicar: boolean, adminId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: { blocks: { select: { text: true, assetId: true, url: true } } },
    })
    if (!content) throw new NotFoundException('Conteúdo não encontrado')

    if (publicar) {
      const temAlgo = content.blocks.some((b) => b.text?.trim() || b.assetId || b.url)
      if (!temAlgo) {
        throw new BadRequestException(
          'Este conteúdo ainda está vazio. Preencha pelo menos um bloco antes de publicar.',
        )
      }
    }

    const atualizado = await this.prisma.content.update({
      where: { id: contentId },
      data: {
        status: publicar ? ContentStatus.PUBLISHED : ContentStatus.DRAFT,
        publishedAt: publicar ? (content.publishedAt ?? new Date()) : null,
      },
    })

    await this.auditar(
      adminId,
      content.projectId,
      publicar ? 'content.publish' : 'content.unpublish',
      'Content',
      contentId,
      {},
    )
    return atualizado
  }

  async salvarBloco(
    blocoId: string,
    dados: { label?: string; text?: string; url?: string; assetId?: string | null },
    adminId: string,
  ) {
    const bloco = await this.prisma.contentBlock.update({
      where: { id: blocoId },
      data: {
        ...(dados.label !== undefined ? { label: dados.label.trim() || null } : {}),
        ...(dados.text !== undefined ? { text: dados.text || null } : {}),
        ...(dados.url !== undefined ? { url: dados.url.trim() || null } : {}),
        ...(dados.assetId !== undefined ? { assetId: dados.assetId } : {}),
      },
      include: { asset: true, content: { select: { projectId: true } } },
    })
    // O ESTADO SEGUE O CONTEÚDO, venha a alteração por onde vier.
    //
    // O painel antigo continua a existir e é por ele que ele trabalha hoje.
    // Se só as rotas novas recalculassem o estado, um cartão completado pelo
    // painel antigo ficava eternamente em rascunho e nunca chegava à página —
    // e ele veria a letra a esvaziar-se sem perceber porquê.
    await this.sincronizarEstado(blocoId)
    await this.auditar(adminId, bloco.content.projectId, 'block.update', 'ContentBlock', blocoId, {})
    return bloco
  }

  /** Recalcula rascunho/publicado a partir do que está mesmo no cartão. */
  private async sincronizarEstado(blocoId: string) {
    const b = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      select: {
        type: true,
        papel: true,
        meta: true,
        contentId: true,
        assetId: true,
        imageAssetId: true,
        titulo: true,
        label: true,
        text: true,
      },
    })
    if (!b || b.type !== BlockType.AUDIO) return
    // Quem preenche pelo painel antigo escreve o "rótulo" e não o "título".
    // Enquanto os dois painéis coexistirem, o rótulo vale como título.
    const titulo = b.titulo?.trim() || b.label?.trim() || ''

    /**
     * O CARTÃO DE IMPRESSÃO TEM OUTRAS EXIGÊNCIAS, e não pode ser medido pela
     * mesma régua. Não tem áudio nem descrição: é uma arte de apresentação e
     * uma folha A4 para imprimir. Exigir-lhe um som seria mantê-lo em rascunho
     * para sempre, e ele nunca chegaria à página.
     */
    if (b.papel === CardPapel.IMPRESSAO) {
      const meta = (b.meta ?? {}) as Record<string, unknown>
      const prontoParaImprimir = Boolean(b.imageAssetId) && Boolean(meta.folhaA4)
      await this.prisma.contentBlock.update({
        where: { id: blocoId },
        data: {
          estado: prontoParaImprimir ? CardEstado.PUBLICADO : CardEstado.RASCUNHO,
          ...(b.titulo?.trim() ? {} : { titulo: titulo || null }),
        },
      })
      return
    }

    const inteiro =
      Boolean(b.assetId) && Boolean(b.imageAssetId) && Boolean(titulo) && Boolean(b.text?.trim())
    await this.prisma.contentBlock.update({
      where: { id: blocoId },
      data: {
        estado: inteiro ? CardEstado.PUBLICADO : CardEstado.RASCUNHO,
        ...(b.titulo?.trim() ? {} : { titulo: titulo || null }),
      },
    })

    /**
     * A LETRA PUBLICA-SE SOZINHA QUANDO TEM CONTEÚDO PRONTO.
     *
     * Ele preencheu a Letra B inteira, viu os cartões marcados como PRONTO, e o
     * conteúdo não apareceu no feed. Tinha razão em não perceber: havia dois
     * níveis de publicação e só um estava à vista. As letras B a Z nasceram como
     * rascunho — o que é certo, senão a grade abria com 26 casas vazias — mas
     * ninguém lhe disse que faltava publicar a LETRA, além dos cartões.
     *
     * Ter de publicar duas vezes a mesma coisa não é uma regra, é uma armadilha.
     * A letra passa a abrir-se no instante em que tiver o primeiro cartão
     * pronto.
     *
     * O contrário não acontece: tirar o último cartão do ar NÃO fecha a letra.
     * Fechá-la faria a casa voltar a trancar-se na grade a meio de uma edição, e
     * quem está a trocar uma foto veria o seu trabalho desaparecer do site.
     */
    if (inteiro) {
      await this.prisma.content.updateMany({
        where: { id: b.contentId, status: { not: ContentStatus.PUBLISHED } },
        data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
      })
    }
  }

  async criarBloco(
    contentId: string,
    dados: { type: BlockType; label?: string },
    adminId: string,
  ) {
    const ultimo = await this.prisma.contentBlock.findFirst({
      where: { contentId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const bloco = await this.prisma.contentBlock.create({
      data: {
        contentId,
        type: dados.type,
        label: dados.label?.trim() || null,
        position: (ultimo?.position ?? 0) + 1,
      },
    })
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { projectId: true },
    })
    await this.auditar(adminId, content!.projectId, 'block.create', 'ContentBlock', bloco.id, dados)
    return bloco
  }

  async removerBloco(blocoId: string, adminId: string) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      include: { content: { select: { projectId: true } } },
    })
    if (!bloco) throw new NotFoundException('Bloco não encontrado')
    await this.prisma.contentBlock.delete({ where: { id: blocoId } })
    await this.auditar(adminId, bloco.content.projectId, 'block.delete', 'ContentBlock', blocoId, {})
  }

  /**
   * Sobe ou desce um bloco na página.
   *
   * Bloco novo sempre nasce no fim, e a ordem importa: o cliente quer a
   * explicação antes da música. Sem isto, ele teria de acertar a ordem de
   * criação em todas as 26 letras e nunca poderia corrigir um engano.
   *
   * Subir/descer, e não arrastar: o painel é usado no celular, onde arrastar
   * uma lista é justamente o gesto que briga com a rolagem da página.
   */
  async moverBloco(blocoId: string, direcao: 'cima' | 'baixo', adminId: string) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      select: { id: true, position: true, contentId: true, content: { select: { projectId: true } } },
    })
    if (!bloco) throw new NotFoundException('Bloco não encontrado')

    // O vizinho na direção pedida — que pode não existir, se já está na ponta.
    const vizinho = await this.prisma.contentBlock.findFirst({
      where: {
        contentId: bloco.contentId,
        position: direcao === 'cima' ? { lt: bloco.position } : { gt: bloco.position },
      },
      orderBy: { position: direcao === 'cima' ? 'desc' : 'asc' },
      select: { id: true, position: true },
    })
    if (!vizinho) return { movido: false }

    // Troca em transação: com duas escritas soltas, uma falha no meio deixaria
    // dois blocos na mesma posição e a ordem viraria sorteio.
    await this.prisma.$transaction([
      this.prisma.contentBlock.update({ where: { id: bloco.id }, data: { position: vizinho.position } }),
      this.prisma.contentBlock.update({ where: { id: vizinho.id }, data: { position: bloco.position } }),
    ])
    await this.auditar(adminId, bloco.content.projectId, 'block.move', 'ContentBlock', blocoId, {
      direcao,
    })
    return { movido: true }
  }

  /**
   * Define (ou remove) a arte própria de uma faixa.
   *
   * Separada da capa da letra de propósito: a capa é uma só e vai na prévia do
   * link compartilhado; a arte da faixa muda a cada áudio e é o que a pessoa vê
   * enquanto ouve aquela faixa.
   */
  async definirArteDoBloco(blocoId: string, assetId: string | null, adminId: string) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      select: { id: true, content: { select: { projectId: true } } },
    })
    if (!bloco) throw new NotFoundException('Bloco não encontrado')

    if (assetId) {
      const asset = await this.prisma.mediaAsset.findUnique({
        where: { id: assetId },
        select: { kind: true },
      })
      if (!asset || asset.kind !== MediaKind.IMAGE) {
        throw new BadRequestException('A arte da faixa precisa ser uma imagem.')
      }
    }

    const atualizado = await this.prisma.contentBlock.update({
      where: { id: blocoId },
      data: { imageAssetId: assetId },
      select: { id: true, imageAssetId: true },
    })
    await this.sincronizarEstado(blocoId)
    await this.auditar(adminId, bloco.content.projectId, 'block.image', 'ContentBlock', blocoId, {
      imageAssetId: assetId,
    })
    return atualizado
  }

  /** Classifica (ou desclassifica) um áudio numa categoria. */
  async definirCategoriaDoBloco(blocoId: string, categoryId: string | null, adminId: string) {
    const bloco = await this.prisma.contentBlock.findUnique({
      where: { id: blocoId },
      select: { id: true, content: { select: { projectId: true } } },
    })
    if (!bloco) throw new NotFoundException('Bloco não encontrado')

    if (categoryId) {
      const cat = await this.prisma.blockCategory.findUnique({ where: { id: categoryId } })
      if (!cat || cat.projectId !== bloco.content.projectId) {
        throw new BadRequestException('Categoria não pertence a este projeto')
      }
    }

    const atualizado = await this.prisma.contentBlock.update({
      where: { id: blocoId },
      data: { categoryId },
      select: { id: true, categoryId: true },
    })
    await this.auditar(
      adminId,
      bloco.content.projectId,
      'block.category',
      'ContentBlock',
      blocoId,
      { categoryId },
    )
    return atualizado
  }

  async registrarMidia(
    dados: {
      url: string
      kind: MediaKind
      mimeType: string
      sizeBytes: number
      title: string
      shareCardUrl?: string
      width?: number
      height?: number
    },
    adminId: string,
  ) {
    return this.prisma.mediaAsset.create({
      data: {
        kind: dados.kind,
        url: dados.url,
        mimeType: dados.mimeType,
        sizeBytes: dados.sizeBytes,
        title: dados.title,
        shareCardUrl: dados.shareCardUrl ?? null,
        width: dados.width ?? null,
        height: dados.height ?? null,
        uploadedById: adminId,
      },
    })
  }

  /**
   * Define a capa da letra a partir de uma mídia já enviada.
   *
   * A capa não é enfeite: é ela que aparece na prévia do link quando alguém
   * compartilha no WhatsApp, e é por isso que o cliente desenhou a arte.
   */
  async definirCapa(contentId: string, assetId: string | null, adminId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, projectId: true },
    })
    if (!content) throw new NotFoundException('Conteúdo não encontrado')

    let coverUrl: string | null = null
    let shareCardUrl: string | null = null
    if (assetId) {
      const asset = await this.prisma.mediaAsset.findUnique({
        where: { id: assetId },
        select: { url: true, kind: true, shareCardUrl: true },
      })
      if (!asset || asset.kind !== MediaKind.IMAGE) {
        throw new BadRequestException('A capa precisa ser uma imagem.')
      }
      coverUrl = asset.url
      shareCardUrl = asset.shareCardUrl
    }

    const atualizado = await this.prisma.content.update({
      where: { id: contentId },
      data: { coverUrl, shareCardUrl },
      select: { id: true, coverUrl: true, shareCardUrl: true },
    })
    await this.auditar(adminId, content.projectId, 'content.cover', 'Content', contentId, {
      coverUrl,
    })
    return atualizado
  }

  /** Metadados analíticos do conteúdo — o pedido final do cliente. */
  async salvarMetadados(
    contentId: string,
    dados: Record<string, unknown>,
    adminId: string,
  ) {
    const campos = ['platform', 'format', 'theme', 'productRef', 'cta', 'testVariant'] as const
    const data: Record<string, unknown> = {}
    for (const campo of campos) {
      if (dados[campo] !== undefined) data[campo] = dados[campo] || null
    }

    const metadata = await this.prisma.contentMetadata.upsert({
      where: { contentId },
      update: data,
      create: { contentId, ...data },
    })
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { projectId: true },
    })
    await this.auditar(adminId, content!.projectId, 'metadata.update', 'Content', contentId, data)
    return metadata
  }

  private async projeto(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        photoApprovalRequired: true,
        checkoutUrl: true,
      },
    })
    if (!project) throw new NotFoundException('Projeto não encontrado')
    return project
  }

  /**
   * Liga e desliga a aprovação prévia de foto.
   *
   * Passa pela auditoria como qualquer outra decisão do painel: é a mudança de
   * configuração de maior consequência que existe aqui, porque decide se uma
   * foto de criança fica pública no instante do envio. Quem ligou ou desligou,
   * e quando, precisa ser reconstituível.
   */
  async definirAprovacaoDeFoto(projectSlug: string, exigir: boolean, userId: string) {
    const project = await this.projeto(projectSlug)
    const atual = await this.prisma.project.update({
      where: { id: project.id },
      data: { photoApprovalRequired: exigir },
      select: { slug: true, name: true, photoApprovalRequired: true },
    })
    await this.auditar(
      userId,
      project.id,
      exigir ? 'project.photo_approval.on' : 'project.photo_approval.off',
      'Project',
      project.id,
      { photoApprovalRequired: exigir },
    )
    return atual
  }

  /** Define (ou remove) o material gratuito para download da letra. */
  async definirMaterialGratis(contentId: string, assetId: string | null, adminId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, projectId: true },
    })
    if (!content) throw new NotFoundException('Conteúdo não encontrado')

    let freeFileUrl: string | null = null
    let freeFileName: string | null = null
    if (assetId) {
      const asset = await this.prisma.mediaAsset.findUnique({
        where: { id: assetId },
        select: { url: true, kind: true, title: true },
      })
      if (!asset || asset.kind !== MediaKind.DOCUMENT) {
        throw new BadRequestException('O material precisa ser um PDF.')
      }
      freeFileUrl = asset.url
      freeFileName = asset.title
    }

    const atualizado = await this.prisma.content.update({
      where: { id: contentId },
      data: { freeFileUrl, freeFileName },
      select: { id: true, freeFileUrl: true, freeFileName: true },
    })
    await this.auditar(adminId, content.projectId, 'content.free_file', 'Content', contentId, {
      freeFileUrl,
    })
    return atualizado
  }

  /** Define (ou remove) o link externo de compra do projeto. */
  async definirLinkDeCompra(projectSlug: string, url: string | null, adminId: string) {
    const project = await this.projeto(projectSlug)
    const limpo = url?.trim() || null

    // Só http(s): um link colado errado que vira "javascript:" seria um buraco
    // aberto por um campo de texto do painel.
    if (limpo && !/^https:\/\/[^\s]+$/i.test(limpo)) {
      throw new BadRequestException('Cole o endereço completo, começando com https://')
    }

    const atualizado = await this.prisma.project.update({
      where: { id: project.id },
      data: { checkoutUrl: limpo },
      select: { id: true, checkoutUrl: true },
    })
    await this.auditar(adminId, project.id, 'project.checkout_url', 'Project', project.id, {
      checkoutUrl: limpo,
    })
    return atualizado
  }

  // ── Categorias de áudio ───────────────────────────────────────────

  /**
   * As categorias do projeto, com quantos áudios cada uma tem.
   *
   * A contagem vai junto porque é ela que responde a pergunta que o dono faz ao
   * abrir a tela: "esta categoria está sendo usada?" — e porque apagar uma
   * categoria com áudios dentro tem consequência, então ele precisa ver o
   * número antes de decidir.
   */
  async categorias(projectSlug: string) {
    const project = await this.projeto(projectSlug)
    const categorias = await this.prisma.blockCategory.findMany({
      where: { projectId: project.id },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        position: true,
        _count: { select: { blocks: true } },
      },
    })
    return {
      project,
      categorias: categorias.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        position: c.position,
        audios: c._count.blocks,
      })),
    }
  }

  async criarCategoria(projectSlug: string, nome: string, adminId: string) {
    const project = await this.projeto(projectSlug)
    const limpo = nome.trim()
    if (limpo.length < 2) throw new BadRequestException('O nome ficou curto demais')

    const slug = this.normalizarSlug(limpo)
    if (!slug) throw new BadRequestException('Escolha um nome com letras ou números')

    const jaExiste = await this.prisma.blockCategory.findUnique({
      where: { projectId_slug: { projectId: project.id, slug } },
    })
    if (jaExiste) throw new BadRequestException(`Já existe uma categoria "${jaExiste.name}"`)

    const ultima = await this.prisma.blockCategory.findFirst({
      where: { projectId: project.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const criada = await this.prisma.blockCategory.create({
      data: { projectId: project.id, name: limpo, slug, position: (ultima?.position ?? 0) + 1 },
    })
    await this.auditar(adminId, project.id, 'category.create', 'BlockCategory', criada.id, {
      name: limpo,
    })
    return criada
  }

  async renomearCategoria(id: string, nome: string, adminId: string) {
    const atual = await this.prisma.blockCategory.findUnique({ where: { id } })
    if (!atual) throw new NotFoundException('Categoria não encontrada')
    const limpo = nome.trim()
    if (limpo.length < 2) throw new BadRequestException('O nome ficou curto demais')

    // O slug NÃO muda ao renomear: ele está nos endereços que as pessoas já
    // compartilharam da playlist filtrada. Renomear é trocar a etiqueta, não
    // mudar de lugar.
    const renomeada = await this.prisma.blockCategory.update({
      where: { id },
      data: { name: limpo },
    })
    await this.auditar(adminId, atual.projectId, 'category.rename', 'BlockCategory', id, {
      de: atual.name,
      para: limpo,
    })
    return renomeada
  }

  async removerCategoria(id: string, adminId: string) {
    const atual = await this.prisma.blockCategory.findUnique({
      where: { id },
      select: { id: true, name: true, projectId: true, _count: { select: { blocks: true } } },
    })
    if (!atual) throw new NotFoundException('Categoria não encontrada')

    // Os áudios ficam: a chave é SetNull. Eles voltam a ser "sem categoria" e
    // continuam tocando. Apagar categoria não pode apagar conteúdo.
    await this.prisma.blockCategory.delete({ where: { id } })
    await this.auditar(adminId, atual.projectId, 'category.delete', 'BlockCategory', id, {
      name: atual.name,
      audiosDesclassificados: atual._count.blocks,
    })
    return { removida: atual.name, audiosDesclassificados: atual._count.blocks }
  }

  // ── Moderação da comunidade ───────────────────────────────────────

  /**
   * Comentários recentes do projeto, para o dono ver e agir.
   *
   * Mostra os apagados junto, marcados: quem modera precisa conseguir conferir
   * o que já resolveu, e uma lista onde o item some no instante da ação deixa
   * a dúvida de se a ação funcionou.
   */

  /**
   * Denúncias à espera de decisão.
   *
   * Ordenadas pelas pendentes primeiro e mais recentes no topo: a fila existe
   * para agir, e o que já foi decidido só interessa como histórico.
   */
  async denuncias(projectSlug: string, limite = 100) {
    const project = await this.projeto(projectSlug)
    const reports = await this.prisma.report.findMany({
      where: { projectId: project.id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: limite,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        note: true,
        status: true,
        createdAt: true,
        reporter: { select: { id: true, displayName: true } },
      },
    })
    return { project, reports }
  }

  async decidirDenuncia(id: string, status: 'REVIEWED' | 'DISMISSED', adminId: string) {
    return this.prisma.report.update({
      where: { id },
      data: { status, reviewedAt: new Date(), reviewedById: adminId },
      select: { id: true, status: true },
    })
  }

  async comentariosRecentes(projectSlug: string, limite = 100) {
    const project = await this.projeto(projectSlug)
    const comments = await this.prisma.comment.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        body: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, email: true, status: true } },
        content: { select: { slug: true, title: true } },
        profileUser: { select: { id: true, displayName: true } },
        // De QUAL faixa veio o comentário. Sem isto, um comentário da oração e
        // um da música chegam à fila indistinguíveis, e moderar sem saber sobre
        // o que a pessoa falava é decidir no escuro.
        block: { select: { id: true, label: true, category: { select: { name: true } } } },
      },
    })
    return { project, comments }
  }

  /**
   * Bloqueia ou libera uma conta.
   *
   * Bloquear apaga também os tokens de renovação da pessoa. Sem isso, a sessão
   * já aberta continuaria funcionando até o token curto expirar, e "bloqueei e
   * ele continua comentando" é exatamente o tipo de coisa que faz o dono
   * perder a confiança na ferramenta.
   *
   * Administrador não bloqueia administrador: evita que uma conta invadida
   * derrube o dono do próprio painel.
   */
  async bloquearConta(userId: string, bloquear: boolean, adminId: string, motivo?: string) {
    const alvo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, email: true, role: true, status: true },
    })
    if (!alvo) throw new NotFoundException('Conta não encontrada')
    if (alvo.role === 'ADMIN') {
      throw new BadRequestException('Não é possível bloquear uma conta de administrador')
    }

    const atual = await this.prisma.user.update({
      where: { id: userId },
      data: { status: bloquear ? 'SUSPENDED' : 'ACTIVE' },
      select: { id: true, displayName: true, email: true, status: true },
    })

    if (bloquear) {
      await this.prisma.refreshToken.deleteMany({ where: { userId } })
    }

    const projeto = await this.prisma.project.findFirst({ select: { id: true } })
    if (projeto) {
      await this.auditar(
        adminId,
        projeto.id,
        bloquear ? 'user.block' : 'user.unblock',
        'User',
        userId,
        { motivo: motivo ?? null, email: alvo.email },
      )
    }

    return atual
  }

  private normalizarSlug(bruto: string): string {
    return bruto
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
  }

  // ── O CARTÃO COMO PEÇA ÚNICA (23/08) ───────────────────────────────
  //
  // Um cartão é imagem, áudio, título e descrição numa linha só, com as suas
  // próprias curtidas e comentários. Não há como guardar meio cartão porque
  // não há meio cartão — há um rascunho, e um rascunho não chega à página.

  /** Um cartão está inteiro quando tem imagem, som, título e descrição. */
  private estadoDoCartao(b: {
    assetId: string | null
    imageAssetId: string | null
    titulo: string | null
    text: string | null
  }): CardEstado {
    const inteiro =
      Boolean(b.assetId) &&
      Boolean(b.imageAssetId) &&
      Boolean(b.titulo?.trim()) &&
      Boolean(b.text?.trim())
    return inteiro ? CardEstado.PUBLICADO : CardEstado.RASCUNHO
  }

  /**
   * A composição inteira: 26 vagões, cada um com os seus cartões.
   *
   * Devolve as 26 letras SEMPRE, existam ou não conteúdos. A casa da letra é
   * dela mesmo quando está vazia — foi o que faltou quando o A caiu no lugar
   * do B, e é o que ele descreveu como a linha azul que não se interrompe.
   */
  async alfabeto(projectSlug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true, slug: true, name: true },
    })
    if (!project) throw new NotFoundException('Projeto não encontrado')

    const conteudos = await this.prisma.content.findMany({
      where: { projectId: project.id, letra: { not: null } },
      orderBy: { letra: 'asc' },
      select: {
        id: true,
        slug: true,
        letra: true,
        title: true,
        status: true,
        coverUrl: true,
        blocks: {
          where: { type: BlockType.AUDIO },
          orderBy: [{ slot: 'asc' }, { position: 'asc' }],
          select: {
            id: true,
            slot: true,
            papel: true,
            estado: true,
            label: true,
            titulo: true,
            text: true,
            linkUpgrade: true,
            meta: true,
            asset: { select: { id: true, url: true, title: true, durationMs: true } },
            imageAsset: { select: { url: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    })

    const porLetra = new Map(conteudos.map((c) => [c.letra!, c]))

    return {
      project,
      vagoes: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letra) => {
        const c = porLetra.get(letra)
        return {
          letra,
          contentId: c?.id ?? null,
          slug: c?.slug ?? null,
          title: c?.title ?? `Letra ${letra}`,
          publicado: c?.status === ContentStatus.PUBLISHED,
          coverUrl: c?.coverUrl ?? null,
          cartoes: (c?.blocks ?? []).map((b) => ({
            id: b.id,
            slot: b.slot,
            papel: b.papel,
            estado: b.estado,
            nomeInterno: b.label,
            titulo: b.titulo,
            descricao: b.text,
            linkUpgrade: b.linkUpgrade,
            audio: b.asset,
            imagem: b.imageAsset?.url ?? null,
            categoriaId: b.category?.id ?? null,
            categoriaNome: b.category?.name ?? null,
            folhaA4: ((b.meta ?? {}) as Record<string, unknown>).folhaA4 ?? null,
          })),
          prontos: (c?.blocks ?? []).filter((b) => b.estado === CardEstado.PUBLICADO).length,
        }
      }),
    }
  }

  /**
   * A raiz: perfil, introdução e alfabeto.
   *
   * É a tela que ele desenhou em 24/08, e a frase dele no rodapé diz o que ela
   * é para servir: "Perfil + Introdução + Alfabeto = uma única raiz". O perfil
   * e o alfabeto são FIXOS — existem sempre, não se duplicam nem se apagam. A
   * introdução é a única parte que ele pode multiplicar.
   *
   * A introdução é o conteúdo sem letra. É por isso que ela nunca entrou na
   * contagem das 26 e é por isso que aqui ela aparece à parte: não é uma letra
   * que calha estar em primeiro, é outra coisa.
   */
  async estruturaRaiz(projectSlug: string) {
    const project = await this.projetoPorSlug(projectSlug)

    const [anfitriao, introducao, letras] = await Promise.all([
      this.prisma.user.findFirst({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, displayName: true, avatarUrl: true, bio: true },
      }),
      this.prisma.content.findFirst({
        // A introdução é o conteúdo sem letra E que não é o Produto Vivo. Os
        // dois vivem fora do alfabeto, e sem esta distinção o Produto Vivo
        // apareceria como introdução no dia em que fosse criado primeiro.
        where: { projectId: project.id, letra: null, slug: { not: 'produto-vivo' } },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          coverUrl: true,
          blocks: {
            where: { type: BlockType.AUDIO },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              slot: true,
              papel: true,
              estado: true,
              label: true,
              titulo: true,
              text: true,
              linkUpgrade: true,
              meta: true,
              asset: { select: { id: true, url: true, title: true, durationMs: true } },
              imageAsset: { select: { url: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.content.findMany({
        where: { projectId: project.id, letra: { not: null } },
        orderBy: { letra: 'asc' },
        select: { letra: true, status: true },
      }),
    ])

    /**
     * O PRODUTO VIVO NASCE QUANDO FOR PRECISO, e não numa migração.
     *
     * Ele pediu em 25/08 um modelo vazio para preencher, com o mesmo cartão dos
     * áudios e um botão de duplicar. Criar isto por migração obrigaria todos os
     * projectos futuros a ter um Produto Vivo, tenham-no ou não; criado aqui,
     * aparece na primeira vez que alguém abre a estrutura e mais nunca.
     */
    let pv = await this.prisma.content.findFirst({
      where: { projectId: project.id, slug: 'produto-vivo' },
      select: { id: true, title: true },
    })
    if (!pv) {
      const criado = await this.prisma.content.create({
        data: {
          projectId: project.id,
          slug: 'produto-vivo',
          title: 'Produto Vivo',
          status: ContentStatus.PUBLISHED,
          position: 900,
        },
        select: { id: true, title: true },
      })
      await this.prisma.contentBlock.create({
        data: {
          contentId: criado.id,
          type: BlockType.AUDIO,
          papel: CardPapel.CARTAO,
          estado: CardEstado.RASCUNHO,
          slot: null,
          label: 'Produto Vivo',
          position: 1,
        },
      })
      pv = criado
    }

    const cartoesPv = await this.prisma.contentBlock.findMany({
      where: { contentId: pv.id, type: BlockType.AUDIO },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slot: true,
        papel: true,
        estado: true,
        label: true,
        titulo: true,
        text: true,
        linkUpgrade: true,
        meta: true,
        asset: { select: { id: true, url: true, title: true, durationMs: true } },
        imageAsset: { select: { url: true } },
        category: { select: { id: true, name: true } },
      },
    })

    return {
      project,
      perfil: anfitriao,
      produtoVivo: {
        contentId: pv.id,
        title: pv.title,
        cartoes: cartoesPv.map((b) => ({
          id: b.id,
          slot: b.slot,
          papel: b.papel,
          estado: b.estado,
          nomeInterno: b.label,
          titulo: b.titulo,
          descricao: b.text,
          linkUpgrade: b.linkUpgrade,
          audio: b.asset,
          imagem: b.imageAsset?.url ?? null,
          categoriaId: b.category?.id ?? null,
          categoriaNome: b.category?.name ?? null,
          folhaA4: ((b.meta ?? {}) as Record<string, unknown>).folhaA4 ?? null,
        })),
      },
      introducao: introducao
        ? {
            contentId: introducao.id,
            title: introducao.title,
            coverUrl: introducao.coverUrl,
            cartoes: introducao.blocks.map((b) => ({
              id: b.id,
              slot: b.slot,
              papel: b.papel,
              estado: b.estado,
              nomeInterno: b.label,
              titulo: b.titulo,
              descricao: b.text,
              linkUpgrade: b.linkUpgrade,
              audio: b.asset,
              imagem: b.imageAsset?.url ?? null,
              categoriaId: b.category?.id ?? null,
              categoriaNome: b.category?.name ?? null,
              folhaA4: ((b.meta ?? {}) as Record<string, unknown>).folhaA4 ?? null,
            })),
          }
        : null,
      alfabeto: {
        letras: letras.map((c) => c.letra!),
        publicadas: letras.filter((c) => c.status === ContentStatus.PUBLISHED).length,
      },
    }
  }

  /**
   * Acrescenta uma introdução — o "Duplicar" do segundo bloco da raiz.
   *
   * Nasce vazia, como as cópias dos cartões das letras: ele duplica para ter
   * DUAS introduções, e não a mesma introdução duas vezes.
   */
  async duplicarIntroducao(contentId: string, adminId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      // `slug` vai no select porque é lido logo abaixo. Faltava, e o build
      // local passou na mesma por causa da cache incremental do TypeScript —
      // só o build limpo do servidor é que o apanhou.
      select: { id: true, projectId: true, letra: true, slug: true },
    })
    if (!content) throw new NotFoundException('Introdução não encontrada')
    // Serve a introdução e o Produto Vivo: os dois vivem fora do alfabeto e os
    // dois se multiplicam. Numa LETRA não, porque aí as quatro casas são fixas.
    if (content.letra) throw new BadRequestException('Numa letra, use Duplicar no quadrado.')

    const ultimo = await this.prisma.contentBlock.findFirst({
      where: { contentId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const cartao = await this.prisma.contentBlock.create({
      data: {
        contentId,
        type: BlockType.AUDIO,
        papel: CardPapel.CARTAO,
        estado: CardEstado.RASCUNHO,
        slot: null,
        label: content.slug === 'produto-vivo' ? 'Produto Vivo' : 'Introdução',
        position: (ultimo?.position ?? 0) + 1,
      },
      select: { id: true, label: true, estado: true, position: true },
    })
    await this.auditar(adminId, content.projectId, 'intro.duplicate', 'ContentBlock', cartao.id, {})
    return cartao
  }

  /**
   * Guarda um cartão inteiro de uma vez, e recalcula o estado a seguir.
   *
   * O estado nunca é escolhido por quem chama: é uma consequência do que está
   * lá dentro. Se fosse um campo qualquer, mais cedo ou mais tarde alguém
   * publicava um cartão sem imagem — que é exactamente o defeito que isto veio
   * fechar.
   */
  async salvarCartao(
    cartaoId: string,
    dados: {
      titulo?: string | null
      descricao?: string | null
      assetId?: string | null
      imageAssetId?: string | null
      linkUpgrade?: string | null
      /** A folha A4 do cartão de impressão. Vive no `meta`, que já existe. */
      folhaA4AssetId?: string | null
    },
    adminId: string,
  ) {
    const antes = await this.prisma.contentBlock.findUnique({
      where: { id: cartaoId },
      select: { id: true, content: { select: { projectId: true } } },
    })
    if (!antes) throw new NotFoundException('Cartão não encontrado')

    /**
     * A folha A4 guarda-se no `meta`, e não numa coluna nova.
     *
     * É a única imagem que só o cartão de impressão tem, e criar uma coluna
     * para uma coisa que 99% das linhas nunca vai usar é o tipo de decisão que
     * se paga em todas as consultas seguintes. O `meta` existe exactamente
     * para isto.
     */
    let metaNova: Prisma.InputJsonValue | undefined
    if (dados.folhaA4AssetId !== undefined) {
      const actual = await this.prisma.contentBlock.findUnique({
        where: { id: cartaoId },
        select: { meta: true },
      })
      const base = ((actual?.meta ?? {}) as Record<string, unknown>) || {}
      if (dados.folhaA4AssetId) {
        const asset = await this.prisma.mediaAsset.findUnique({
          where: { id: dados.folhaA4AssetId },
          select: { url: true, kind: true },
        })
        if (!asset || asset.kind !== MediaKind.IMAGE) {
          throw new BadRequestException('A folha A4 precisa de ser uma imagem.')
        }
        metaNova = { ...base, folhaA4: asset.url } as Prisma.InputJsonValue
      } else {
        const { folhaA4: _fora, ...resto } = base
        metaNova = resto as Prisma.InputJsonValue
      }
    }

    const guardado = await this.prisma.contentBlock.update({
      where: { id: cartaoId },
      data: {
        ...(metaNova !== undefined ? { meta: metaNova } : {}),
        ...(dados.titulo !== undefined ? { titulo: dados.titulo?.trim() || null } : {}),
        ...(dados.descricao !== undefined ? { text: dados.descricao?.trim() || null } : {}),
        ...(dados.assetId !== undefined ? { assetId: dados.assetId } : {}),
        ...(dados.imageAssetId !== undefined ? { imageAssetId: dados.imageAssetId } : {}),
        ...(dados.linkUpgrade !== undefined
          ? { linkUpgrade: dados.linkUpgrade?.trim() || null }
          : {}),
      },
      select: {
        id: true,
        assetId: true,
        imageAssetId: true,
        titulo: true,
        text: true,
        linkUpgrade: true,
        meta: true,
        // O ENDEREÇO DA IMAGEM E DO SOM, e não só os identificadores.
        //
        // Isto devolvia `imageAssetId`, que é um número, e o painel tentava
        // mostrar a fotografia a partir dele. Resultado: a pessoa escolhia a
        // foto, o envio corria bem, e o quadrado continuava vazio — sem erro
        // nenhum. O cliente descreveu-o em 24/08 com a pergunta certa: "como
        // vou saber se escolhi a foto certa ou se o upload funcionou?".
        asset: { select: { id: true, url: true, title: true, durationMs: true } },
        imageAsset: { select: { url: true } },
        category: { select: { id: true, name: true } },
      },
    })

    await this.sincronizarEstado(cartaoId)
    const estado = this.estadoDoCartao(guardado)
    await this.auditar(adminId, antes.content.projectId, 'card.save', 'ContentBlock', cartaoId, {
      estado,
    })
    return {
      ...guardado,
      estado,
      // A mesma forma que as listas do painel devolvem, para quem chama nunca
      // ter de saber onde cada coisa vive.
      audio: guardado.asset,
      imagem: guardado.imageAsset?.url ?? null,
      folhaA4: ((guardado.meta ?? {}) as Record<string, unknown>).folhaA4 ?? null,
    }
  }

  /**
   * Tira um cartão do ar sem o apagar.
   *
   * Pedido dele em 25/08, depois de ficar com duas memorizações repetidas no
   * topo do perfil e sem forma de mexer em nenhuma. A frase dele diz o
   * problema: "se eu publicar algo errado ou duplicado, fica preso no perfil".
   *
   * SÃO DUAS ACÇÕES DIFERENTES E NÃO UMA COM AVISO. Tirar do ar é reversível e
   * usa-se com pressa — publicou-se o que não devia, e tira-se. Apagar é
   * definitivo e usa-se com calma. Juntá-las num só botão com uma pergunta faz
   * com que a pressa da primeira leve a segunda pela frente.
   *
   * `estado` volta a RASCUNHO, que é a mesma porta por onde um cartão
   * incompleto espera: fica no painel, guarda tudo o que tem, e não chega à
   * página. Não foi preciso inventar um terceiro estado para isto.
   */
  async tirarDoAr(cartaoId: string, adminId: string) {
    const cartao = await this.prisma.contentBlock.findUnique({
      where: { id: cartaoId },
      select: { id: true, content: { select: { projectId: true } } },
    })
    if (!cartao) throw new NotFoundException('Cartão não encontrado')

    await this.prisma.contentBlock.update({
      where: { id: cartaoId },
      data: { estado: CardEstado.RASCUNHO },
    })
    await this.auditar(adminId, cartao.content.projectId, 'card.unpublish', 'ContentBlock', cartaoId, {})
    return { estado: CardEstado.RASCUNHO }
  }

  /**
   * Volta a pôr no ar um cartão que estava fora.
   *
   * Só se estiver inteiro. Um cartão a que falte a foto não volta ao ar por
   * alguém carregar num botão — a regra de quando um cartão pode ser publicado
   * é uma só, e é calculada a partir do que ele tem lá dentro.
   */
  async porNoAr(cartaoId: string, adminId: string) {
    const cartao = await this.prisma.contentBlock.findUnique({
      where: { id: cartaoId },
      select: { id: true, content: { select: { projectId: true } } },
    })
    if (!cartao) throw new NotFoundException('Cartão não encontrado')

    await this.sincronizarEstado(cartaoId)
    const depois = await this.prisma.contentBlock.findUnique({
      where: { id: cartaoId },
      select: { estado: true },
    })
    if (depois?.estado !== CardEstado.PUBLICADO) {
      throw new BadRequestException(
        'Este cartão ainda não está completo. Falta preencher alguma coisa antes de o pôr no ar.',
      )
    }
    await this.auditar(adminId, cartao.content.projectId, 'card.publish', 'ContentBlock', cartaoId, {})
    return { estado: CardEstado.PUBLICADO }
  }

  /**
   * Apaga um cartão de vez.
   *
   * Ao contrário de `esvaziarCartao`, que preserva o quadrado das quatro casas
   * fixas, isto remove a linha. Só se usa em cópias e no cartão de impressão —
   * as quatro casas de uma letra não se apagam, senão a letra passa a ter três
   * e a composição deixa de ter a mesma forma em todos os vagões.
   */
  async apagarCartao(cartaoId: string, adminId: string) {
    const cartao = await this.prisma.contentBlock.findUnique({
      where: { id: cartaoId },
      select: { id: true, slot: true, papel: true, content: { select: { projectId: true, letra: true } } },
    })
    if (!cartao) throw new NotFoundException('Cartão não encontrado')

    // Numa letra, as quatro casas são fixas: esvaziam-se, não se apagam. Fora
    // das letras — a introdução, o Produto Vivo — não há casas a preservar.
    if (cartao.slot !== null && cartao.content.letra) {
      await this.esvaziarCartao(cartaoId, adminId)
      return { apagado: false, esvaziado: true }
    }

    await this.prisma.contentBlock.delete({ where: { id: cartaoId } })
    await this.auditar(adminId, cartao.content.projectId, 'card.delete', 'ContentBlock', cartaoId, {})
    return { apagado: true, esvaziado: false }
  }

  /**
   * Duplica um cartão: nasce vazio, logo a seguir ao original.
   *
   * Vazio e não copiado. Ele quer duplicar para ter DUAS músicas, e não a
   * mesma música duas vezes — copiar o conteúdo daria um cartão pronto que
   * ninguém pediu e que iria direito à página.
   */
  async duplicarCartao(cartaoId: string, adminId: string) {
    const original = await this.prisma.contentBlock.findUnique({
      where: { id: cartaoId },
      select: {
        contentId: true,
        position: true,
        label: true,
        papel: true,
        content: { select: { projectId: true } },
      },
    })
    if (!original) throw new NotFoundException('Cartão não encontrado')
    if (original.papel === CardPapel.IMPRESSAO) {
      throw new BadRequestException('O cartão de impressão é único e não se duplica.')
    }

    // Abre espaço a seguir ao original, para a cópia não aterrar no fim.
    await this.prisma.contentBlock.updateMany({
      where: { contentId: original.contentId, position: { gt: original.position } },
      data: { position: { increment: 1 } },
    })

    const copia = await this.prisma.contentBlock.create({
      data: {
        contentId: original.contentId,
        type: BlockType.AUDIO,
        papel: CardPapel.CARTAO,
        estado: CardEstado.RASCUNHO,
        // Sem casa: as quatro casas são das originais. A cópia vive a seguir
        // àquela de onde saiu e some se for apagada.
        slot: null,
        label: original.label,
        position: original.position + 1,
      },
      select: { id: true, slot: true, label: true, position: true, estado: true },
    })
    await this.auditar(
      adminId,
      original.content.projectId,
      'card.duplicate',
      'ContentBlock',
      copia.id,
      { de: cartaoId },
    )
    return copia
  }

  /**
   * Esvazia um cartão original — o quadrado fica.
   *
   * "Deletar remove apenas seu conteúdo, mas preserva o quadrado vazio", disse
   * ele, e é a diferença que interessa: as quatro casas de uma letra são fixas.
   * Apagar a casa faria a letra passar a ter três, e a composição deixaria de
   * ter a mesma forma em todos os vagões.
   *
   * Uma cópia não tem casa nenhuma a preservar: essa desaparece mesmo.
   */
  async esvaziarCartao(cartaoId: string, adminId: string) {
    const cartao = await this.prisma.contentBlock.findUnique({
      where: { id: cartaoId },
      select: { id: true, slot: true, papel: true, content: { select: { projectId: true } } },
    })
    if (!cartao) throw new NotFoundException('Cartão não encontrado')

    if (cartao.slot === null) {
      await this.prisma.contentBlock.delete({ where: { id: cartaoId } })
      await this.auditar(
        adminId,
        cartao.content.projectId,
        'card.delete',
        'ContentBlock',
        cartaoId,
        {},
      )
      return { removido: true }
    }

    await this.prisma.contentBlock.update({
      where: { id: cartaoId },
      data: {
        assetId: null,
        imageAssetId: null,
        titulo: null,
        text: null,
        linkUpgrade: null,
        estado: CardEstado.RASCUNHO,
      },
    })
    await this.auditar(adminId, cartao.content.projectId, 'card.clear', 'ContentBlock', cartaoId, {})
    return { removido: false }
  }

  /**
   * Cria o cartão de impressão da letra. Um por letra, e só um.
   *
   * Nasce do quarto quadrado, como ele desenhou, e não se duplica.
   */
  async criarCartaoDeImpressao(contentId: string, adminId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, projectId: true },
    })
    if (!content) throw new NotFoundException('Letra não encontrada')

    const jaExiste = await this.prisma.contentBlock.findFirst({
      where: { contentId, papel: CardPapel.IMPRESSAO },
      select: { id: true },
    })
    if (jaExiste) return jaExiste

    const ultimo = await this.prisma.contentBlock.findFirst({
      where: { contentId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const cartao = await this.prisma.contentBlock.create({
      data: {
        contentId,
        type: BlockType.AUDIO,
        papel: CardPapel.IMPRESSAO,
        estado: CardEstado.RASCUNHO,
        slot: null,
        label: 'Cartão para impressão',
        position: (ultimo?.position ?? 0) + 1,
      },
      select: { id: true, papel: true, estado: true, label: true, position: true },
    })
    await this.auditar(adminId, content.projectId, 'card.print', 'ContentBlock', cartao.id, {})
    return cartao
  }

  /**
   * Grava a ordem dos cartões de uma letra, de uma vez.
   *
   * Uma chamada por cartão trocado deixaria a ordem meio gravada se a ligação
   * caísse a meio — e ele usa isto no telemóvel, onde a ligação cai. Vai tudo
   * numa transacção: ou fica a ordem toda, ou fica a que lá estava.
   *
   * As posições são reescritas a partir da lista recebida, e não somadas ou
   * trocadas duas a duas. Trocar aos pares depende de o servidor e o ecrã
   * concordarem no estado inicial, e basta uma gravação perdida para deixarem
   * de concordar.
   */
  async ordenarCartoes(contentId: string, ids: string[], adminId: string) {
    const existentes = await this.prisma.contentBlock.findMany({
      where: { contentId },
      select: { id: true },
    })
    const conhecidos = new Set(existentes.map((b) => b.id))
    const pedidos = ids.filter((id) => conhecidos.has(id))
    if (pedidos.length !== ids.length) {
      throw new BadRequestException('A lista tem cartões que não são desta letra.')
    }

    // O que não vier na lista fica a seguir, pela ordem que já tinha. Assim uma
    // lista parcial nunca faz desaparecer um cartão do fim da página.
    const resto = existentes.map((b) => b.id).filter((id) => !pedidos.includes(id))
    const ordem = [...pedidos, ...resto]

    await this.prisma.$transaction(
      ordem.map((id, i) =>
        this.prisma.contentBlock.update({ where: { id }, data: { position: i + 1 } }),
      ),
    )

    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { projectId: true },
    })
    await this.auditar(adminId, content!.projectId, 'card.order', 'Content', contentId, {
      total: ordem.length,
    })
    return { ordenados: ordem.length }
  }

  /** O projeto pelo slug, para as rotas que só têm o slug na mão. */
  async projetoPorSlug(slug: string) {
    const p = await this.prisma.project.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    })
    if (!p) throw new NotFoundException('Projeto não encontrado')
    return p
  }

  private async auditar(
    userId: string,
    projectId: string,
    action: string,
    entityType: string,
    entityId: string,
    changes: Record<string, unknown>,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        userId,
        projectId,
        action,
        entityType,
        entityId,
        changes: changes as Prisma.InputJsonValue,
      },
    })
  }
}
