import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'
import { AvisosDeEntrada } from '@/components/AvisosDeEntrada'
import { CabecalhoDePerfil } from '@/components/CabecalhoDePerfil'
import { IntroducaoEmCartoes } from '@/components/IntroducaoEmCartoes'
import { ExperienciaContinua } from '@/components/ExperienciaContinua'
import { IntroducaoRecolhivel } from '@/components/IntroducaoRecolhivel'
import { BarraInferior } from '@/components/BarraInferior'

/**
 * A experiência inteira numa página só.
 *
 * A ordem é a que o cliente fixou em 20/08: perfil, capa do projeto, título,
 * imprimir, filtros, progresso, alfabeto, e a letra escolhida por baixo de
 * tudo. A regra que a governa é dele e é simples — a pessoa entra no perfil e
 * fica lá.
 */
import type { Metadata } from 'next'

/**
 * A prévia que aparece no WhatsApp quando alguém partilha a página inicial.
 *
 * Sem isto, o WhatsApp não encontrava nada e mostrava o ícone do Santtify —
 * a mesma imagem preta para todos os links, que não diz a ninguém o que está
 * do outro lado. O cliente apanhou-o ao partilhar o endereço no grupo.
 *
 * A imagem é a capa do projeto, e a descrição é a dele. Quem recebe o link vê
 * o produto, e não a marca da plataforma que o serve.
 */
/**
 * O CARTÃO QUE CHEGA AO WHATSAPP É O DA PUBLICAÇÃO PARTILHADA.
 *
 * Ele repetiu três vezes que o compartilhar "continua chegando de forma
 * genérica", e eu andei a corrigir o sítio errado. O endereço já estava certo
 * desde 01/09: abre na publicação e acende-a. O que continuava genérico era a
 * PRÉ-VISUALIZAÇÃO — a mensagem que chega ao outro lado trazia o nome do
 * projeto, a descrição do projeto e a capa do projeto, fosse qual fosse a
 * música partilhada. Do lado dele isso é indistinguível de partilhar a página
 * geral, e a frase dele descrevia exactamente o que ele via.
 *
 * Fui procurar isto sem esperar pela resposta dele porque a pergunta que eu lhe
 * fiz — de que ecrã partilhou — não era a que interessava. Qualquer ecrã dava
 * o mesmo cartão.
 *
 * Lê `?letra=&pub=`, que é o que o botão de partilhar produz, e devolve o
 * título, o texto e a arte daquela publicação. Se o endereço não trouxer nada
 * ou trouxer coisa que não existe, fica o cartão do projeto, como era.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { projectSlug } = await params
  const dados = await api.indice(projectSlug)
  if (!dados) return { title: 'Projeto não encontrado' }

  const q = await searchParams
  const letra = typeof q.letra === 'string' ? q.letra : null
  const pub = typeof q.pub === 'string' ? q.pub : null
  if (letra && pub) {
    const pagina = await api.conteudo(projectSlug, letra).catch(() => null)
    const bloco = pagina?.content.blocks.find((b) => b.id === pub)
    if (bloco) {
      /*
        O TÍTULO DIZ A FAIXA E DIZ A LETRA.

        Só o título do cartão dava "Música", que é o nome da casa no painel dele
        e não diz nada a quem recebe. Só o da letra dava "A de Amor e Abacate"
        em todas as faixas dessa letra, e voltava a parecer genérico. Junta as
        duas quando são diferentes: "Música · A de Amor e Abacate".
      */
      const daFaixa = bloco.titulo?.trim()
      const daLetra = pagina!.content.title
      const titulo = daFaixa && daFaixa !== daLetra ? `${daFaixa} · ${daLetra}` : daLetra
      const texto =
        bloco.text?.trim().replace(/\s+/g, ' ').slice(0, 200) ??
        pagina!.content.summary ??
        undefined
      const arte = bloco.arte ?? pagina!.content.coverUrl ?? undefined
      return {
        title: `${titulo} — ${dados.project.name}`,
        description: texto,
        openGraph: {
          title: titulo,
          description: texto,
          siteName: dados.project.name,
          images: arte ? [{ url: arte, alt: titulo }] : undefined,
          type: 'music.song',
        },
        twitter: {
          card: 'summary_large_image',
          title: titulo,
          description: texto,
          images: arte ? [arte] : undefined,
        },
      }
    }
  }

  const logo = dados.project.branding?.logoUrl
  const capa =
    (typeof logo === 'string' && logo) ||
    dados.contents.find((c) => c.coverUrl)?.coverUrl ||
    undefined
  const descricao = dados.project.description ?? undefined

  return {
    title: dados.project.name,
    description: descricao,
    openGraph: {
      title: dados.project.name,
      description: descricao,
      siteName: dados.project.name,
      images: capa ? [{ url: capa, alt: dados.project.name }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: dados.project.name,
      description: descricao,
      images: capa ? [capa] : undefined,
    },
  }
}

export default async function IndiceDoProjeto({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const dados = await api.indice(projectSlug)
  if (!dados) notFound()

  const { project, anfitriao, contents, progresso, comunidade } = dados

  /**
   * A introdução é o conteúdo SEM LETRA. Vai buscar-se por inteiro, com os
   * cartões dentro, porque a lista do índice só traz títulos e capas.
   *
   * Se falhar, a página abre à mesma sem introdução. Uma introdução é bom ter;
   * não é motivo para deixar 26 letras fora do ar.
   */
  const semLetra = contents.find((c) => !c.letra && c.publicado)
  const introducao = semLetra
    ? await api.conteudo(projectSlug, semLetra.slug).catch(() => null)
    : null

  // As categorias que ele criou no painel, para o filtro do tocador.
  const cats = await api.categorias(projectSlug).catch(() => null)

  return (
    <main className="envoltorio com-barra">
      {/* A BARRA PRETA DO TOPO SAIU.
          Ele desenhou-a em 23/08 e, a usar, concluiu que roubava altura à
          fotografia de perfil sem dar nada em troca — e tinha razão: as saídas
          que ela oferecia estão agora em baixo, onde o polegar chega. */}

      <RastreadorDeVisita
        projectId={project.id}
        type="PAGE_VIEW"
        props={anfitriao ? { perfilId: anfitriao.id } : undefined}
      />

      {/* 1. Perfil */}
      {/*
        Quem já tem conta entra no seu próprio perfil; quem chega de fora entra
        no do anfitrião, que é a apresentação do projecto. Pedido dele em 27/08.
      */}
      <CabecalhoDePerfil
        preferirOUtilizador
        projectSlug={projectSlug}
        projectId={project.id}
        perfisCriados={comunidade.perfis}
        anfitriao={anfitriao}
      />

      {/* 2, 3 e 4. A INTRODUÇÃO DO PROJETO, e ela recolhe-se depois da
          primeira visita. Ordem dele, 23/08: capa do perfil, introdução, e
          depois o alfabeto. Quem já viu a introdução vê o alfabeto logo por
          baixo do perfil, sem texto de apresentação a ocupar o ecrã. */}
      <IntroducaoRecolhivel nome={project.name}>
        {introducao && (
          <IntroducaoEmCartoes
            contentId={introducao.content.id}
            contentSlug={introducao.content.slug}
            blocos={introducao.content.blocks}
            projectId={project.id}
            projectSlug={projectSlug}
            categorias={cats?.categorias ?? []}
          />
        )}

        {/* A ÁREA "CONHEÇA O JESUS ALFABETO SAUDÁVEL" SAIU, com o escudo que
            estava dentro dela. Ele pediu-o duas vezes, e a razão que deu é boa:
            os textos passaram a viver dentro dos próprios conteúdos, e uma
            caixa de apresentação separada era a mesma explicação outra vez, num
            sítio onde já não faz falta. Acabam os áudios da introdução e segue
            directamente o alfabeto. */}
      </IntroducaoRecolhivel>

      {/* 6, 7 e 8. Progresso, alfabeto e a letra aberta — tudo aqui dentro. */}
      {contents.length === 0 ? (
        <div className="vazio">
          <p>Os conteúdos ainda estão sendo preparados.</p>
          <p>Volte em breve.</p>
        </div>
      ) : (
        <ExperienciaContinua
          projectSlug={projectSlug}
          projectId={project.id}
          contents={contents}
          progresso={progresso}
          categorias={cats?.categorias ?? []}
        />
      )}

      {/* O selo do Produto Vivo deixa de flutuar no fim da página: passou a
          ser um dos quatro acessos da barra de baixo, sempre à mão. */}
      {/*
        O aviso sobre nome e fotografia também aqui, e não só na página do
        perfil.

        Ele pediu em 27/08 que a pessoa RECEBA a mensagem ao cadastrar-se, e não
        que a encontre se por acaso for ao perfil. Quem acaba de se registar cai
        nesta página. O componente decide sozinho se se mostra: só a quem ainda
        não tem fotografia, e uma vez só.
      */}
      {/*
        O convite a instalar e o aviso sobre nome e fotografia, por esta ordem.

        Viviam os dois em páginas que era preciso ir procurar, e por isso ele
        disse em 27/08 que ninguém os vê. Passam a aparecer onde a pessoa cai
        depois de se registar. Quem os mostra decide a ordem, para que não se
        tapem um ao outro.
      */}
      <AvisosDeEntrada projectSlug={projectSlug} />
      <BannerDeConsentimento projectId={project.id} />
      <BarraInferior projectSlug={projectSlug} linkPdf={project.checkoutUrl ?? null} />
    </main>
  )
}
