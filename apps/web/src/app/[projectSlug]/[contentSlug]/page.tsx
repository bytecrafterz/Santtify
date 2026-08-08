import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { api } from '@/lib/api'
import { BlocosDeConteudo } from '@/components/BlocosDeConteudo'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { SeloProdutoVivo } from '@/components/SeloProdutoVivo'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'

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
  return {
    title: `${dados.content.title} — ${dados.project.name}`,
    description: dados.content.summary ?? dados.project.description ?? undefined,
    openGraph: {
      title: dados.content.title,
      description: dados.content.summary ?? undefined,
      images: dados.content.coverUrl ? [dados.content.coverUrl] : undefined,
      type: 'article',
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

  const { project, content, navegacao } = dados

  return (
    <main className="envoltorio">
      <RastreadorDeVisita projectId={project.id} contentId={content.id} type="CONTENT_VIEW" />

      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← {project.name}</Link>
      </div>

      <h1>{content.title}</h1>
      {content.subtitle && <p className="subtitulo">{content.subtitle}</p>}

      <BlocosDeConteudo blocos={content.blocks} projectId={project.id} contentId={content.id} />

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
    </main>
  )
}
