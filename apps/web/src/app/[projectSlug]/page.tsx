import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'
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
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}): Promise<Metadata> {
  const { projectSlug } = await params
  const dados = await api.indice(projectSlug)
  if (!dados) return { title: 'Projeto não encontrado' }

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
      <CabecalhoDePerfil
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
            blocos={introducao.content.blocks}
            projectId={project.id}
            projectSlug={projectSlug}
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
      <BannerDeConsentimento projectId={project.id} />
      <BarraInferior projectSlug={projectSlug} linkPdf={project.checkoutUrl ?? null} />
    </main>
  )
}
