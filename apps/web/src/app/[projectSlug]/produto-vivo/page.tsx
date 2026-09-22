import type { Metadata } from 'next'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { EntrarNoGrupoPv } from '@/components/EntrarNoGrupoPv'
import { ChegouAoFimDoPv } from '@/components/ChegouAoFimDoPv'
import { IntroducaoEmCartoes } from '@/components/IntroducaoEmCartoes'
import { BarraInferior } from '@/components/BarraInferior'
import { VisualizacoesDasPublicacoes } from '@/components/VisualizacoesDasPublicacoes'
import { Voltar } from '@/components/Voltar'

/**
 * Página institucional do Produto Vivo.
 *
 * A arte e os textos definitivos vêm do cliente. O que está aqui é a
 * ESTRUTURA que ele pediu — a página existe, está ligada ao selo PV de todo o
 * app e tem o botão de WhatsApp no lugar certo. Trocar texto e arte depois não
 * mexe em nada além deste arquivo.
 *
 * Rota estática: tem precedência sobre [contentSlug], então nenhum conteúdo
 * com slug "produto-vivo" conflita com ela.
 */

/**
 * Link de convite do grupo oficial do Produto Vivo.
 *
 * Fica em variável de ambiente, e não no código, por dois motivos: o cliente
 * pode trocar o convite no WhatsApp a qualquer momento (é o que se faz quando
 * um grupo recebe spam), e assim a troca é uma linha de configuração em vez de
 * uma alteração de código com novo deploy.
 */
const GRUPO_PV = process.env.NEXT_PUBLIC_PV_GRUPO_URL ?? ''

/**
 * O CARTÃO DE PARTILHA DO PRODUTO VIVO É O PRODUTO VIVO.
 *
 * Ele apanhou-o em 02/09: "se compartilhar Produto Vivo, o cartão precisa
 * representar Produto Vivo". Havia título e descrição, e faltava a imagem — e
 * sem imagem própria o WhatsApp vai buscar a do projeto, que é a capa do
 * alfabeto. Esta página é a porta de entrada comercial dele; chegar com a capa
 * de um projeto infantil é o contrário do que ela existe para fazer.
 *
 * A imagem é a PRIMEIRA ARTE da publicação dele, e não uma escolhida por mim:
 * assim, no dia em que ele trocar a arte, o cartão troca sozinho.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}): Promise<Metadata> {
  const { projectSlug } = await params
  const pv = await api.conteudo(projectSlug, 'produto-vivo').catch(() => null)
  const arte = pv?.content.blocks.find((b) => b.arte)?.arte ?? pv?.content.coverUrl ?? undefined

  const descricao =
    'O Produto Vivo transforma qualquer site ou aplicativo em uma mini rede social comercial.'

  return {
    // Ver a nota em [projectSlug]/page.tsx: o `<title>` é o nome da aplicação.
    title: 'Santtify',
    description: descricao,
    openGraph: {
      title: 'Produto Vivo',
      description: descricao,
      images: arte ? [{ url: arte, alt: 'Produto Vivo' }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Produto Vivo',
      description: descricao,
      images: arte ? [arte] : undefined,
    },
  }
}

export default async function PaginaProdutoVivo({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const project = await api.projeto(projectSlug)

  const cats = await api.categorias(projectSlug).catch(() => null)

  /**
   * As publicações do Produto Vivo. Se falharem, a página abre à mesma com o
   * grupo e a nota da patente: o convite às empresas é o que esta página existe
   * para dar, e não pode depender de já haver conteúdo preenchido.
   */
  const pv = await api.conteudo(projectSlug, 'produto-vivo').catch(() => null)

  // Aceita só convite de grupo do WhatsApp. Um endereço qualquer colado aqui
  // por engano viraria um botão levando a lugar nenhum, numa página que é a
  // porta de entrada comercial do projeto.
  const linkGrupo = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(GRUPO_PV) ? GRUPO_PV : null

  return (
    <main className="envoltorio com-barra">
      {project && <RastreadorDeVisita projectId={project.id} type="PAGE_VIEW" />}

      {/*
        A VISITA TAMBÉM CONTA PARA A PUBLICAÇÃO, e não só para a página.

        Ele apanhou-o em 02/09: seis partilhas contadas e zero visualizações.
        As duas coisas vêm de sítios diferentes e só uma estava ligada aqui.

        O contador de uma publicação conta eventos CONTENT_VIEW com o id do
        conteúdo. Esta página emitia PAGE_VIEW sem id nenhum, e por isso o
        número não podia ser outra coisa senão zero — não é que estivesse a
        contar mal, é que nunca teve o que contar. São 1835 visitas registadas
        assim desde que a página existe.

        O PAGE_VIEW fica: é dele que vivem os números da página no painel, e
        tirá-lo para acrescentar este trocaria um defeito por outro.
      */}
      {project && pv && (
        <RastreadorDeVisita projectId={project.id} contentId={pv.content.id} type="CONTENT_VIEW" />
      )}

      <div className="cabecalho">
        <Voltar href={`/${projectSlug}`}>Voltar</Voltar>
      </div>

      <h1>Produto Vivo</h1>
      <p className="subtitulo">dando vida aos produtos</p>

      {/* O TEXTO INSTITUCIONAL SAIU. Ele disse-o em 25/08: era grande e
          confuso, e não explicava o que aquilo é. No lugar ficam as publicações
          do Produto Vivo, com a mesma estrutura dos áudios — foto, som, título,
          texto e os quatro indicadores — que ele preenche e duplica no painel,
          sem depender de mim para trocar uma palavra. */}
      {/* Uma visualização por publicação desenhada aqui. A de cima é da
          PÁGINA; o olho de cada cartão conta eventos com o `blockId`, e esta
          página nunca emitiu nenhum. Ver a nota no componente. */}
      {project && pv && (
        <VisualizacoesDasPublicacoes
          projectId={project.id}
          contentId={pv.content.id}
          blocos={pv.content.blocks.filter((b) => b.type === 'AUDIO').map((b) => b.id)}
        />
      )}

      {pv && (
        <IntroducaoEmCartoes
          contentId={pv.content.id}
          blocos={pv.content.blocks}
          projectId={project?.id ?? ''}
          projectSlug={projectSlug}
          categorias={cats?.categorias ?? []}
          publicacaoUnica
        />
      )}

      {/*
        O QUADRO EXPLICATIVO SAIU, E FICA SÓ O BOTÃO.

        Ele pediu-o em 30/08 e diz que já o tinha pedido antes: "retire todo
        esse texto explicativo, não quero esse quadro nem essas explicações,
        quero deixar somente o botão verde para entrar no grupo".

        O MARCADOR DO FIM FICA, E FICA FORA DE QUALQUER CONDIÇÃO. Chegar ao fim
        da página é um facto sobre a pessoa, não sobre o que está desenhado à
        volta. Já o perdi uma vez, em 26/08, por o ter deixado dentro do ramo
        que só existia quando havia link de grupo: o degrau do meio do funil
        dele ficou a zero durante dias sem nada dizer porquê. Não se repete.
      */}
      <ChegouAoFimDoPv projectId={project?.id ?? ''} />

      {linkGrupo && <EntrarNoGrupoPv projectId={project?.id ?? ''} url={linkGrupo} />}

      {/* Discreto, como ele pediu, e com a palavra certa: o pedido foi
          depositado, não concedido. Escrever "patenteado" seria afirmar uma
          coisa que ainda não aconteceu. */}
      <p className="nota nota-patente">
        Produto Vivo — tecnologia com pedido de patente depositado.
      </p>

      <BarraInferior projectSlug={projectSlug} linkPdf={project?.checkoutUrl ?? null} />
    </main>
  )
}
