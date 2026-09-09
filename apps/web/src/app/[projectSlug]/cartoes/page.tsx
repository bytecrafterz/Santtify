import type { Metadata } from 'next'
import { EditorDeCartoes } from '@/components/EditorDeCartoes'

export const metadata: Metadata = {
  title: 'Cartões personalizados · Santtify',
  description:
    'Personalize os cartões com o nome e a foto da criança e receba um PDF pronto para imprimir em A4.',
}

/**
 * A página dos cartões personalizados.
 *
 * Fina de propósito: o trabalho todo é do editor, que precisa de estado e
 * portanto vive no navegador. Aqui só se resolve o endereço do projeto.
 */
export default async function PaginaDeCartoes({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return <EditorDeCartoes projectSlug={projectSlug} />
}
