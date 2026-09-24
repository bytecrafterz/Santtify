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
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectSlug } = await params

  /*
    `?categoria=` é o que o cartaz da oferta traz consigo.

    Ele disse "quanto clica ja aparece o cartao para editar", e sem isto não
    aparecia: a pessoa tocava no cartaz das crianças e caía num ecrã a perguntar
    se queria crianças ou adultos — uma pergunta a que ela já tinha respondido
    com o dedo.

    Quando o projeto só tem uma categoria, o editor já a saltava sozinho. Isto
    faz o mesmo quando tem duas e a pessoa veio por uma delas.
  */
  const q = await searchParams
  const categoria = typeof q.categoria === 'string' ? q.categoria : null

  return <EditorDeCartoes projectSlug={projectSlug} categoriaInicial={categoria} />
}
