import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { api } from '@/lib/api'
import { PublicacaoDaLetra } from '@/components/PublicacaoDaLetra'
import { publicacoesDe } from '@/lib/publicacoes-da-letra'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { SeloProdutoVivo } from '@/components/SeloProdutoVivo'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'
import { BarraSocial } from '@/components/BarraSocial'
import { OfertaDaLetra } from '@/components/OfertaDaLetra'
import { BarraInferior } from '@/components/BarraInferior'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string; contentSlug: string }>
}): Promise<Metadata> {
  const { projectSlug, contentSlug } = await params
  const dados = await api.conteudo(projectSlug, contentSlug)
  if (!dados) return { title: 'Conteúdo não encontrado' }

  // Importa para o compartilhamento: o cartão que aparece no WhatsApp é o que
  // faz a pessoa do outro lado clicar, e cada clique é propagação medida.
  //
  // Usa o cartão 1200x630 e não a capa: a arte das letras é retrato A4, e o
  // recorte que o WhatsApp faz numa imagem alta corta a marca no topo e o selo
  // embaixo — justamente o que o cliente pôs ali para ser visto.
  //
  // As dimensões vão declaradas porque sem elas alguns leitores de prévia
  // desistem da imagem em vez de baixá-la para descobrir o tamanho.
  const imagem = dados.content.shareCardUrl ?? dados.content.coverUrl
  /**
   * A descrição da prévia é a DESTE conteúdo, e só depois a do projeto.
   *
   * Antes caía logo no texto do projeto, e então todas as 26 letras
   * partilhavam a mesma frase — a prévia dizia sempre a mesma coisa fosse qual
   * fosse a letra. O primeiro texto da própria letra diz muito mais a quem
   * recebe o link.
   */
  const textoProprio = dados.content.blocks
    .find((b) => (b.type === 'RICH_TEXT' || b.type === 'TEXT') && b.text?.trim())
    ?.text?.trim()
    .replace(/\s+/g, ' ')
    .slice(0, 200)

  const descricao =
    dados.content.summary ?? textoProprio ?? dados.project.description ?? undefined

  return {
    title: `${dados.content.title} — ${dados.project.name}`,
    description: descricao,
    openGraph: {
      title: dados.content.title,
      description: descricao,
      siteName: dados.project.name,
      images: imagem
        ? [{ url: imagem, width: 1200, height: 630, alt: dados.content.title }]
        : undefined,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: dados.content.title,
      description: descricao,
      images: imagem ? [imagem] : undefined,
    },
  }
}

export default async function PaginaDeConteudo({
  params,
}: {
  params: Promise<{ projectSlug: string; contentSlug: string }>
}) {
  const { projectSlug, contentSlug } = await params
  const dados = await api.conteudo(projectSlug, contentSlug)
  if (!dados) notFound()

  /* As categorias do projeto, para o menu do tocador. Sem elas o menu tinha
     uma linha só, TODOS, e a faixa azul do que está a tocar não tinha onde
     aparecer. */
  const cats = await api.categorias(projectSlug).catch(() => null)

  const { project, content, navegacao } = dados

  return (
    <main className="envoltorio com-barra">
      <RastreadorDeVisita projectId={project.id} contentId={content.id} type="CONTENT_VIEW" />

      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← {project.name}</Link>
      </div>

      <h1>{content.title}</h1>
      {content.subtitle && <p className="subtitulo">{content.subtitle}</p>}

      {/* A arte da letra, logo abaixo do título e antes do player: é o fluxo que
          o cliente descreveu — a pessoa abre, vê a imagem, e aperta Play.
          A altura é limitada porque a arte é retrato A4; sem limite, ela
          empurraria o botão de tocar para fora da tela do celular, e quem chega
          pelo QR Code vem para ouvir. */}
      {content.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="capa-conteudo"
          src={content.coverUrl}
          alt={content.title}
          width={1200}
          height={1697}
        />
      )}

      {/*
        A LETRA VÊ-SE IGUAL, VENHA-SE POR ONDE SE VIER.

        Aqui desenhava-se uma capa e por baixo os sete tocadores empilhados,
        sem a arte de cada um. É a página que TODOS os QR Codes impressos
        abrem, e um QR Code impresso não se corrige depois.

        Ele apanhou-o em 01/09, num Android acabado de estrear: "escaneamos o
        QR Code e os áudios abriram sem as fotos correspondentes; depois de um
        refresh as imagens apareceram". A primeira metade era literal — nesta
        página as fotos não existiam de todo. A segunda foi ele a recarregar e
        a cair, por dentro do site, na página inicial, onde elas existem.

        Passa a desenhar as mesmas publicações da experiência contínua, pela
        mesma função.
      */}
      {publicacoesDe(dados).map((pub) => (
        <PublicacaoDaLetra
          somFazParteDaEstrutura
          key={pub.ancora}
          etiqueta={pub.etiqueta}
          imagem={pub.imagem}
          bloco={pub.bloco}
          titulo={pub.titulo}
          texto={pub.texto}
          alvo={pub.alvo}
          projectId={project.id}
          contentId={content.id}
          projectSlug={projectSlug}
          ligacao={`/${projectSlug}?letra=${content.slug}&pub=${pub.bloco.id}`}
          ancora={pub.ancora}
          categorias={cats?.categorias ?? []}
        />
      ))}

      {/*
        SÓ OS COMENTÁRIOS, e não a fila social outra vez.

        Cada publicação acima já tem os seus indicadores. Uma segunda fila aqui
        seria a camada social repetida de que ele se queixou no Produto Vivo em
        30/08, e teria razão outra vez. Mas os comentários têm de ficar: 21 dos
        30 comentários da plataforma estão presos ao CONTEÚDO e não a uma
        faixa, e são de pessoas reais. Tirar a secção apagava-os do ecrã.
      */}
      <BarraSocial
        soComentarios
        contentId={content.id}
        projectId={project.id}
        projectSlug={projectSlug}
        titulo={content.title}
      />

      {/* Depois do conteúdo e da área social: a pessoa ouviu, gostou, e é aí
          que faz sentido oferecer. Antes disso seria vender antes de mostrar. */}
      <OfertaDaLetra
        contentId={content.id}
        projectId={project.id}
        titulo={content.title}
        arquivoGratis={content.freeFileUrl}
        nomeDoArquivo={content.freeFileName}
        linkDeCompra={project.checkoutUrl ?? null}
      />

      <nav className="navegacao">
        {navegacao.anterior ? (
          <Link href={`/${projectSlug}/${navegacao.anterior.slug}`}>
            <span>Anterior</span>
            {navegacao.anterior.title}
          </Link>
        ) : (
          <span />
        )}
        {navegacao.proximo && (
          <Link className="direita" href={`/${projectSlug}/${navegacao.proximo.slug}`}>
            <span>Próximo</span>
            {navegacao.proximo.title}
          </Link>
        )}
      </nav>

      {content.qrUrl && (
        <div className="caixa-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={api.qrSvgUrl(projectSlug, contentSlug)} alt={`QR Code de ${content.title}`} />
          <div>
            QR Code desta página, gerado automaticamente pelo sistema.
            <br />
            <code>{content.qrUrl}</code>
          </div>
        </div>
      )}

      <SeloProdutoVivo projectSlug={projectSlug} />
      <BannerDeConsentimento projectId={project.id} />
      {/*
        A BARRA FICA, POR MAIS QUE SE DESÇA.

        Ele apanhou isto em 02/09 e o argumento é o certo: "desço dezenas de
        publicações para ouvir e depois quero ir para outra área; como a barra
        desapareceu, sou obrigado a subir a página inteira". Nesta página nunca
        houve barra, e antes quase não se notava porque ela era curta. Ao passar
        a desenhar as sete publicações da letra, tornou-se a página mais comprida
        do site — e a única sem saída.
      */}
      <BarraInferior projectSlug={projectSlug} linkPdf={project.checkoutUrl ?? null} />
    </main>
  )
}
