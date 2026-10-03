import { PainelDoProjeto } from '@/components/painel/PainelDoProjeto'

export const metadata = { title: 'Projeto' }

/**
 * A administração de um projeto: o que se abre ao tocar num cartão de "Meus
 * Projetos". Até 03/10 era aqui a lista longa de tudo (`ListaAdmin`).
 */
export default async function PaginaDoProjetoNoPainel({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectSlug } = await params
  const busca = await searchParams
  return (
    <PainelDoProjeto
      projectSlug={projectSlug}
      acabadoDeCriar={busca.novo === '1'}
      incompleto={busca.incompleto === '1'}
    />
  )
}
