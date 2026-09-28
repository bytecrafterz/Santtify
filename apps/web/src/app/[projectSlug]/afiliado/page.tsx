import { PainelDoAfiliado } from '@/components/PainelDoAfiliado'

export const metadata = { title: 'Santtify', robots: { index: false } }

/** A área inteira do afiliado: o "Ver todas" do perfil. */
export default async function PaginaDoAfiliado({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio">
      <PainelDoAfiliado projectSlug={projectSlug} />
    </main>
  )
}
