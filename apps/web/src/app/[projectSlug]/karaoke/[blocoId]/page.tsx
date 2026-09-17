import type { Metadata } from 'next'
import { KaraokeDaFaixa } from '@/components/KaraokeDaFaixa'

// Ver a nota em [projectSlug]/page.tsx: o `<title>` é o nome da aplicação.
export const metadata: Metadata = { title: 'Santtify' }

/**
 * O Modo Karaokê de uma faixa.
 *
 * Uma página própria, e não um modo dentro da página da letra: ocupa o ecrã
 * inteiro, tem o seu próprio som, e sair dela devolve a experiência de sempre
 * tal e qual estava. Foi a condição do cliente — o karaokê acrescenta, não
 * substitui.
 *
 * Carrega no navegador porque o projeto pode exigir conta, e a sessão vive lá.
 */
export default async function PaginaDoKaraoke({
  params,
}: {
  params: Promise<{ projectSlug: string; blocoId: string }>
}) {
  const { projectSlug, blocoId } = await params
  return <KaraokeDaFaixa projectSlug={projectSlug} blocoId={blocoId} />
}
