import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { api } from '@/lib/api'
import { VistaDoCartao } from '@/components/VistaDoCartao'

export const metadata: Metadata = { title: 'Cartão para impressão' }

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
