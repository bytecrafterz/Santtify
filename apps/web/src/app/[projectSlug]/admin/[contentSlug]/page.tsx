import { EditorDeConteudo } from '@/components/EditorDeConteudo'

export const metadata = { title: 'Editar conteúdo' }

export default async function PaginaDeEdicao({
  params,
}: {
  params: Promise<{ projectSlug: string; contentSlug: string }>
}) {
  const { projectSlug, contentSlug } = await params
  return (
    <main className="envoltorio">
      <EditorDeConteudo projectSlug={projectSlug} contentSlug={contentSlug} />
    </main>
  )
}
