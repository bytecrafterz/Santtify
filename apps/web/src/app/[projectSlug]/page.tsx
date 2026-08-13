import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { SeloProdutoVivo } from '@/components/SeloProdutoVivo'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'

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

      {/* A porta de entrada da playlist fica antes da grade das letras: é o
          jeito mais rápido de ouvir tudo, e quem chega pelo QR de uma letra só
          descobre aqui que existem outras 25. */}
      {contents.length > 0 && (
        <Link className="bloco linha atalho-playlist" href={`/${projectSlug}/playlist`}>
          <span>▶ Reproduzir todas</span>
          <small>ouça as músicas em sequência, da letra A à letra Z</small>
        </Link>
      )}

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
      <BannerDeConsentimento projectId={project.id} />
    </main>
  )
}
