import { Voltar } from '@/components/Voltar'
import { SincronizadorDoKaraoke } from '@/components/SincronizadorDoKaraoke'

export const metadata = { title: 'Sincronizar a letra' }

export default async function PaginaDoSincronizador({
  params,
}: {
  params: Promise<{ projectSlug: string; blocoId: string }>
}) {
  const { projectSlug, blocoId } = await params
  return (
    <main className="envoltorio">
      <Voltar href={`/${projectSlug}/admin/karaoke`}>Modo Karaokê</Voltar>
      <h1>Sincronizar a letra</h1>
      <SincronizadorDoKaraoke projectSlug={projectSlug} blocoId={blocoId} />
    </main>
  )
}
