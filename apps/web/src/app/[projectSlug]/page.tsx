import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { SeloProdutoVivo } from '@/components/SeloProdutoVivo'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'
import { CabecalhoDePerfil } from '@/components/CabecalhoDePerfil'
import { CapaComPlaylist } from '@/components/CapaComPlaylist'
import { BotaoImprimir } from '@/components/BotaoImprimir'
import { BotaoDenunciar } from '@/components/BotaoDenunciar'
import { ExperienciaContinua } from '@/components/ExperienciaContinua'

/**
 * A experiência inteira numa página só.
 *
 * A ordem é a que o cliente fixou em 20/08: perfil, capa do projeto, título,
 * imprimir, filtros, progresso, alfabeto, e a letra escolhida por baixo de
 * tudo. A regra que a governa é dele e é simples — a pessoa entra no perfil e
 * fica lá.
 */
export default async function IndiceDoProjeto({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  // As duas leituras vão em paralelo: a playlist é precisa logo na primeira
  // pintura, porque o play da capa passou a tocar aqui dentro.
  const [dados, tocador] = await Promise.all([
    api.indice(projectSlug),
    api.playlist(projectSlug),
  ])
  if (!dados) notFound()

  const { project, contents, progresso, comunidade } = dados

  return (
    <main className="envoltorio">
      <RastreadorDeVisita projectId={project.id} type="PAGE_VIEW" />

      {/* 1. Perfil */}
      <CabecalhoDePerfil
        projectSlug={projectSlug}
        projectId={project.id}
        perfisCriados={comunidade.perfis}
      />

      {/* 2 e 5. Capa que toca aqui mesmo, com os filtros que a comandam */}
      <CapaComPlaylist
        projectSlug={projectSlug}
        project={project}
        contents={contents}
        categorias={tocador?.categorias ?? []}
        faixas={tocador?.faixas ?? []}
      />

      {/* 3. Título e descrição */}
      <div className="secao-com-acao">
        <div>
          <h2>Conheça o {project.name}</h2>
          {project.description && <p className="subtitulo">{project.description}</p>}
        </div>
        <BotaoDenunciar
          projectId={project.id}
          targetType="CONTENT"
          targetId={contents[0]?.id ?? project.id}
        />
      </div>

      {/* 4. Imprimir e exportar */}
      <BotaoImprimir projectId={project.id} impressoes={comunidade.impressoes} />

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
        />
      )}

      <SeloProdutoVivo projectSlug={projectSlug} />
      <BannerDeConsentimento projectId={project.id} />
    </main>
  )
}
