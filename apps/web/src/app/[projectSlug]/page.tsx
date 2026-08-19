import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { SeloProdutoVivo } from '@/components/SeloProdutoVivo'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'
import { CabecalhoDePerfil } from '@/components/CabecalhoDePerfil'
import { CartaoDoProjeto } from '@/components/CartaoDoProjeto'
import { GradeDeLetras } from '@/components/GradeDeLetras'
import { BotaoImprimir } from '@/components/BotaoImprimir'
import { BotaoDenunciar } from '@/components/BotaoDenunciar'

/**
 * A página inicial do projeto, montada segundo os mockups de 19/08.
 *
 * A ordem é a que ele desenhou e faz sentido: primeiro quem a pessoa é, depois
 * o que há para ouvir, e só então a grade das 26 letras. Perfil no topo porque
 * o produto que se está a vender não é o conteúdo — é a família aparecer
 * dentro dele.
 */
export default async function IndiceDoProjeto({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const dados = await api.indice(projectSlug)
  if (!dados) notFound()

  const { project, contents, progresso, comunidade } = dados

  return (
    <main className="envoltorio">
      <RastreadorDeVisita projectId={project.id} type="PAGE_VIEW" />

      <CabecalhoDePerfil
        projectSlug={projectSlug}
        projectId={project.id}
        perfisCriados={comunidade.perfis}
      />

      <CartaoDoProjeto projectSlug={projectSlug} project={project} contents={contents} />

      <div className="secao-com-acao">
        <div>
          <h2>Conheça o {project.name}</h2>
          {project.description && <p className="subtitulo">{project.description}</p>}
        </div>
        <BotaoDenunciar projectId={project.id} targetType="CONTENT" targetId={contents[0]?.id ?? project.id} />
      </div>

      <div className="secao-com-acao">
        <div>
          <h2>Conheça o alfabeto</h2>
          <p className="subtitulo">Toque nas músicas em sequência, da letra A à letra Z</p>
        </div>
        <BotaoImprimir projectId={project.id} impressoes={comunidade.impressoes} />
      </div>

      {/* Os filtros levam à playlist já com a escolha feita, para o toque
          daqui e o toque de lá significarem a mesma coisa. */}
      <div className="filtros-linha">
        <Link className="filtro-link destaque" href={`/${projectSlug}/playlist`}>
          ▶ Ouvir tudo
        </Link>
        <Link className="filtro-link" href={`/${projectSlug}/playlist?filtro=explicacao`}>
          ? Só explicações
        </Link>
        <Link className="filtro-link" href={`/${projectSlug}/playlist?filtro=musica`}>
          ♪ Só músicas
        </Link>
      </div>

      {contents.length === 0 ? (
        <div className="vazio">
          <p>Os conteúdos ainda estão sendo preparados.</p>
          <p>Volte em breve.</p>
        </div>
      ) : (
        <GradeDeLetras projectSlug={projectSlug} contents={contents} progresso={progresso} />
      )}

      <SeloProdutoVivo projectSlug={projectSlug} />
      <BannerDeConsentimento projectId={project.id} />
    </main>
  )
}
