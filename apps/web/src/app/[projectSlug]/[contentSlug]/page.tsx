import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { api } from '@/lib/api'
import { PublicacaoDaLetra } from '@/components/PublicacaoDaLetra'
import { publicacoesDe } from '@/lib/publicacoes-da-letra'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { VisualizacoesDasPublicacoes } from '@/components/VisualizacoesDasPublicacoes'
import { SeloProdutoVivo } from '@/components/SeloProdutoVivo'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'
import { OfertaDaLetra } from '@/components/OfertaDaLetra'
import { BarraInferior } from '@/components/BarraInferior'
import { Voltar } from '@/components/Voltar'
import { artigoDefinido, nomeDaCasa } from '@/lib/unidade'
import type { CasaVizinha } from '@/lib/api'

/**
 * Um dos dois caminhos do fim da página: a casa anterior ou a seguinte.
 *
 * ── PORQUE É UM BOTÃO COM MINIATURA, E NÃO UMA ARTE INTEIRA ─────────
 *
 * Aqui estava só a seguinte, com a arte em tamanho grande. Num telemóvel isso
 * lê-se bem; num ecrã de computador a arte enchia a largura toda e o fim da
 * página passava a ser um cartaz. E não havia caminho para trás nenhum.
 *
 * Agora são dois alvos do mesmo tamanho, cada um com a sua arte em miniatura —
 * o suficiente para se reconhecer para onde se vai antes de tocar, que era o
 * que a arte grande fazia bem e é a única coisa dela que interessa guardar.
 *
 * O LADO VAZIO NÃO SE DESENHA. Na primeira casa não há anterior, e um botão
 * apagado a dizer que não há nada antes ocupa espaço para não informar nada.
 * A grelha aguenta: quem fica sozinho encosta ao seu lado.
 */
function CasaAoLado({
  casa,
  lado,
  unidade,
  projectSlug,
}: {
  casa: CasaVizinha | null
  lado: 'anterior' | 'proximo'
  unidade: string
  projectSlug: string
}) {
  if (!casa) return null

  const feminino = artigoDefinido(unidade) === 'a'
  const rotulo =
    lado === 'anterior'
      ? `${unidade} anterior`
      : `Próxim${feminino ? 'a' : 'o'} ${unidade.toLowerCase()}`
  const nome = nomeDaCasa(
    unidade,
    casa.letra ?? casa.ordinal,
    casa.publicado ? casa.title : null,
  )

  const dentro = (
    <>
      <span className="vizinha-arte">
        {casa.publicado && casa.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={casa.coverUrl} alt="" loading="lazy" />
        ) : (
          <span className="vizinha-cadeado" aria-hidden="true">
            🔒
          </span>
        )}
      </span>
      <span className="vizinha-texto">
        <small>{rotulo}</small>
        <strong>{nome}</strong>
        {!casa.publicado && <em>Em breve</em>}
      </span>
    </>
  )

  const classe = `vizinha vizinha-${lado}${casa.publicado ? '' : ' trancada'}`

  return casa.publicado && casa.slug ? (
    <Link className={classe} href={`/${projectSlug}/${casa.slug}`}>
      {dentro}
    </Link>
  ) : (
    <div className={classe}>{dentro}</div>
  )
}

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

  const descricao = dados.content.summary ?? textoProprio ?? dados.project.description ?? undefined

  return {
    // Ver a nota em [projectSlug]/page.tsx: o `<title>` é o nome da aplicação.
    title: 'Santtify',
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
  /** "Letra", "Dia", "Atributo" — para anunciar a seguinte pelo nome certo. */
  const unidade = project.unidade ?? 'Letra'
  /* Calculado uma vez: a capa precisa de saber se alguma faixa traz arte,
     e a lista precisa das faixas. Chamar duas vezes percorreria os blocos
     duas vezes para dar a mesma resposta. */
  const publicacoes = publicacoesDe(dados)

  return (
    <main className="envoltorio com-barra">
      <RastreadorDeVisita projectId={project.id} contentId={content.id} type="CONTENT_VIEW" />

      {/* E uma por cartão. Quem chega pelo QR Code impresso abre esta página e
          não passa por `ExperienciaContinua`, que é quem emitia estes eventos:
          sem isto, a leitura vinda do papel não conta para publicação nenhuma. */}
      <VisualizacoesDasPublicacoes
        projectId={project.id}
        contentId={content.id}
        blocos={content.blocks.filter((b) => b.type === 'AUDIO').map((b) => b.id)}
      />

      <div className="cabecalho">
        <Voltar href={`/${projectSlug}`}>{project.name}</Voltar>
      </div>

      <h1>{content.title}</h1>
      {content.subtitle && <p className="subtitulo">{content.subtitle}</p>}

      {/* A arte da letra, logo abaixo do título e antes do player: é o fluxo que
          o cliente descreveu — a pessoa abre, vê a imagem, e aperta Play.
          A altura é limitada porque a arte é retrato A4; sem limite, ela
          empurraria o botão de tocar para fora da tela do celular, e quem chega
          pelo QR Code vem para ouvir. */}
      {/*
        A CAPA SÓ SE DESENHA QUANDO AS FAIXAS NÃO TRAZEM ARTE (24/09).

        Cada faixa de áudio tem arte própria, e a capa é outra coisa: é ela que
        vai na grade do projecto e na prévia do link quando alguém partilha no
        WhatsApp. Só que as duas apareciam aqui, uma por cima da outra — no Dia
        1, assim que a faixa ganhou arte, a mesma imagem passou a ser desenhada
        duas vezes seguidas.

        Não se resolve apagando a capa: sem ela a casa fica sem quadrado na
        grade e o link partilhado perde a prévia. Resolve-se aqui, onde a
        duplicação acontece. A capa continua a ser o retrato desta página para
        quem chega de fora; dentro dela, quem manda é a arte de cada faixa.
      */}
      {content.coverUrl && !publicacoes.some((pub) => pub.imagem) && (
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
      {publicacoes.map((pub) => (
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
        A FILA DE COMENTÁRIOS DO FIM DA PÁGINA SAIU.

        Estava aqui porque os comentários antigos estão presos ao CONTEÚDO e não
        a uma faixa, e tirá-la apagava-os do ecrã. A troco disso, ficavam todos
        empilhados no fim — e ele apanhou exactamente o que isso parece:

          "Essas mensagens que aparecem todas acumuladas no final da página não
           podem ficar aí. (...) um comentário feito em outro cartão não pode
           aparecer embaixo do AVISO IMPORTANTE simplesmente porque esse é o
           final da página."

        Tinha razão, e a regra que escreveu a seguir é a certa: "cartão/áudio
        específico → comentários daquele conteúdo → campo para comentar naquele
        conteúdo". Cada publicação acima já faz isso, com o seu próprio contador
        e a sua própria caixa.

        E NADA SE PERDE, que era o motivo de a secção ficar. Duas coisas
        seguram os comentários antigos: a migração `comentarios_no_cartao`
        pendura-os no primeiro cartão do conteúdo onde foram escritos, e a lista
        do card do projeto passou a trazer o acumulado de tudo — as letras, as
        faixas e a página do projeto. Deixaram de ter um só sítio onde aparecer.
      */}
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

      {/*
        A PRÓXIMA ANUNCIA-SE COM A ARTE DELA, como na página inicial.

        Aqui havia duas caixas de texto lado a lado — "Anterior · Letra C" e
        "Próximo · Letra E". Ele viu-as em 22/09: "não quero que apareça desta
        forma, apareça a próxima letra".

        A página inicial já fazia isto bem, com a arte e o nome por baixo, e
        esta — que é a que TODOS os QR Codes impressos abrem — ficava com a
        versão pobre. Passa a ser a mesma peça, com as mesmas classes.

        O ANTERIOR SAI. A saída para trás já está no cabeçalho, em cima, e ele
        pediu a PRÓXIMA: numa sequência que se percorre da A à Z, o que
        interessa depois de ouvir é o que vem a seguir.
      */}
      {/*
        A CASA SEGUINTE ANUNCIA-SE MESMO QUANDO AINDA NÃO ABRIU.

        Ele viu a Letra N acabar a dizer "Próxima letra — Letra B" e escreveu em
        22/09 "têm que aparecer a próxima letra visível". Eram dois defeitos ao
        mesmo tempo: a seguinte era procurada pela posição na lista e caía numa
        Letra B que ficou fora do sítio, e o nome saía a dobrar porque a casa se
        chama "Letra B" e o título dela também. Um vai em `casaSeguinte`, no
        servidor; o outro em `nomeDaCasa`.

        Trancada mostra-se na mesma, como na grade da página inicial: quem acaba
        de ouvir uma letra tem de saber que a seguinte existe e ainda não abriu.
        Era isso, e não mais texto, que faltava aqui.
      */}
      {(navegacao.anterior || navegacao.proximo) && (
        <nav
          className="vizinhas"
          aria-label={`${unidade} anterior e seguinte`}
        >
          <CasaAoLado
            casa={navegacao.anterior}
            lado="anterior"
            unidade={unidade}
            projectSlug={projectSlug}
          />
          <CasaAoLado
            casa={navegacao.proximo}
            lado="proximo"
            unidade={unidade}
            projectSlug={projectSlug}
          />
        </nav>
      )}

      {/*
        O QR NÃO APARECE AQUI — SÓ NO PAINEL.

        Ele pediu-o de volta ontem e eu pu-lo nesta página. Hoje, a olhar para o
        resultado, corrigiu: o QR é para o PAINEL, não para quem visita.

        E a razão é a própria função dele. Esta é a página que os QR Codes
        impressos abrem: quem cá chega já escaneou um. Desenhar-lhe um QR da
        página onde ela já está não lhe serve de nada — serve a quem prepara a
        impressão, e essa pessoa entra pelo painel.

        Continua a viver em `EditorDeConteudo`, com o endereço e o botão de
        baixar em SVG, e nos endereços directos `/qr.svg` e `/qr.png`.
      */}

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
