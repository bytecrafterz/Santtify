import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { CabecalhoDePerfil } from '@/components/CabecalhoDePerfil'
import { PainelDePerfil } from '@/components/PainelDePerfil'
import { IntroducaoEmCartoes } from '@/components/IntroducaoEmCartoes'
import { ExperienciaContinua } from '@/components/ExperienciaContinua'
import { IntroducaoRecolhivel } from '@/components/IntroducaoRecolhivel'
import { BarraInferior } from '@/components/BarraInferior'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'
import { AvisoDeIdentidade } from '@/components/AvisoDeIdentidade'

export const metadata = { title: 'Meu perfil' }

/**
 * O perfil de quem entrou — com a MESMA estrutura da página inicial.
 *
 * O que aqui estava era uma página de definições: um avatar de letra, quatro
 * números e três botões. Uma pessoa registou-se a sério em 25/08, não encontrou
 * o próprio perfil, não encontrou como pôr a fotografia, e ele apanhou-o antes
 * de mim. A frase dele é a especificação inteira: "cadastrou, entrou, vê o
 * próprio perfil, consegue editar nome e foto, e abaixo encontra todo o
 * conteúdo da plataforma".
 *
 * Por isso esta página é a inicial com outra pessoa no topo, e não uma página à
 * parte. Foi a página à parte que criou o problema: duas estruturas para a mesma
 * coisa divergem sempre, e a que diverge é a que menos gente vê.
 */
export default async function PaginaDePerfil({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const dados = await api.indice(projectSlug)
  if (!dados) notFound()

  const { project, contents, progresso, comunidade } = dados

  const semLetra = contents.find((c) => !c.letra && c.publicado)
  const introducao = semLetra
    ? await api.conteudo(projectSlug, semLetra.slug).catch(() => null)
    : null

  // As categorias que ele criou no painel, para o filtro do tocador.
  const cats = await api.categorias(projectSlug).catch(() => null)

  return (
    <main className="envoltorio com-barra">
      {/* O topo é o perfil de quem entrou: foto, escudo, três pontos e os
          quatro indicadores. Os três pontos levam a editar. */}
      <CabecalhoDePerfil
        projectSlug={projectSlug}
        projectId={project.id}
        perfisCriados={comunidade.perfis}
        anfitriao={dados.anfitriao}
        donoEhOUtilizador
      />

      {/* Editar nome, foto e senha. Fica logo por baixo do perfil, e não escondido
          noutro sítio: é a primeira coisa que quem acaba de se registar procura. */}
      <PainelDePerfil projectSlug={projectSlug} />

      {/* E por baixo, a plataforma inteira — igual ao perfil do anfitrião. */}
      <IntroducaoRecolhivel nome={project.name}>
        {introducao && (
          <IntroducaoEmCartoes
            contentId={introducao.content.id}
            blocos={introducao.content.blocks}
            projectId={project.id}
            projectSlug={projectSlug}
          />
        )}
      </IntroducaoRecolhivel>

      {contents.length > 0 && (
        <ExperienciaContinua
          projectSlug={projectSlug}
          projectId={project.id}
          contents={contents}
          progresso={progresso}
          categorias={cats?.categorias ?? []}
        />
      )}

      {/* Logo depois do cadastro: é aqui que quem se regista cai. */}
      <AvisoDeIdentidade projectSlug={projectSlug} />
      <BannerDeConsentimento projectId={project.id} />
      <BarraInferior projectSlug={projectSlug} linkPdf={project.checkoutUrl ?? null} />
    </main>
  )
}
