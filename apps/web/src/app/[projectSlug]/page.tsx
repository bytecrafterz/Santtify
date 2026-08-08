import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { SeloProdutoVivo } from '@/components/SeloProdutoVivo'

export default async function IndiceDoProjeto({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const dados = await api.indice(projectSlug)
  if (!dados) notFound()

  const { project, contents } = dados

  return (
    <main className="envoltorio">
      <RastreadorDeVisita projectId={project.id} type="PAGE_VIEW" />

      <h1>{project.name}</h1>
      {project.description && <p className="subtitulo">{project.description}</p>}

      {contents.length === 0 ? (
        <div className="vazio">
          <p>Os conteúdos ainda estão sendo preparados.</p>
          <p>Volte em breve.</p>
        </div>
      ) : (
        <div className="grade">
          {contents.map((c) => (
            <Link className="cartao" href={`/${projectSlug}/${c.slug}`} key={c.id}>
              {c.title.replace(/^Letra\s+/i, '')}
              <small>{c.subtitle ?? ''}</small>
            </Link>
          ))}
        </div>
      )}

      <SeloProdutoVivo projectSlug={projectSlug} />
    </main>
  )
}
