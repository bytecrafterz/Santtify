import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { api } from '@/lib/api'
import { VistaDoCartao } from '@/components/VistaDoCartao'

/**
 * O CARTÃO DE PARTILHA DO CARTÃO É O PRÓPRIO CARTÃO.
 *
 * Ele apanhou-o em 02/09: "se compartilhar Cartão, precisa representar aquele
 * cartão". Chegava a capa do projeto. E aqui existe a imagem certa desde
 * sempre: o `cartao.jpg` que o servidor já gera para impressão é exactamente a
 * peça que a pessoa está a partilhar.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string; contentSlug: string }>
}): Promise<Metadata> {
  const { projectSlug, contentSlug } = await params
  const dados = await api.conteudo(projectSlug, contentSlug).catch(() => null)
  if (!dados) return { title: 'Cartão para impressão' }

  const nome = dados.content.title
  const titulo = `Cartão da ${nome}`
  const descricao = `O cartão da ${nome} para imprimir em A4, com o QR Code que abre o conteúdo.`
  const imagem = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/projects/${projectSlug}/contents/${contentSlug}/cartao.jpg`

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      siteName: dados.project.name,
      images: [{ url: imagem, alt: titulo }],
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descricao, images: [imagem] },
  }
}

/**
 * O cartão sozinho, em página própria.
 *
 * Ele pediu em 27/08 quatro opções ao abrir o cartão: Voltar, Baixar PDF,
 * Imprimir e Compartilhar. Antes, tocar em imprimir abria o PDF em bruto, e um
 * PDF em bruto no telemóvel é um beco: não tem como voltar sem fechar o
 * separador, e não tem como partilhar sem descarregar primeiro.
 *
 * A folha continua a ser gerada no servidor e continua a ser um cartão, uma
 * página A4, um ficheiro. O que muda é que há uma página à volta dela com as
 * quatro coisas que se querem fazer a seguir.
 */
export default async function PaginaDoCartao({
  params,
}: {
  params: Promise<{ projectSlug: string; contentSlug: string }>
}) {
  const { projectSlug, contentSlug } = await params
  const dados = await api.conteudo(projectSlug, contentSlug)
  if (!dados) notFound()

  const impressao = dados.content.blocks.find((b) => b.papel === 'IMPRESSAO')
  const folha = (impressao?.meta?.folhaA4 as string | undefined) ?? impressao?.arte ?? null
  if (!impressao || !folha) notFound()

  return (
    <VistaDoCartao
      projectSlug={projectSlug}
      contentSlug={contentSlug}
      letra={dados.content.letra ?? ''}
      titulo={dados.content.title}
      folha={folha}
    />
  )
}
