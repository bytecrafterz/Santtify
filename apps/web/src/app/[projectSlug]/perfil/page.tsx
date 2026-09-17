import { IrParaOMeuPerfil } from '@/components/IrParaOMeuPerfil'

// O `<title>` é o nome da aplicação: o iPhone usa-o ao instalar.
export const metadata = { title: 'Santtify' }

/**
 * O perfil de quem entrou.
 *
 * É o mesmo ecrã que qualquer outra pessoa vê desse perfil, e não uma página à
 * parte. Duas estruturas para a mesma coisa divergem sempre, e a que diverge é a
 * que menos gente vê: foi assim que a página de definições antiga ficou
 * empilhada aqui até 17/09. Ver `IrParaOMeuPerfil`.
 *
 * A sessão só existe no navegador, por isso a decisão é tomada lá: com sessão,
 * vai para o próprio perfil; sem sessão, vai entrar e volta aqui.
 */
export default async function PaginaDePerfil({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio com-barra">
      <IrParaOMeuPerfil projectSlug={projectSlug} />
    </main>
  )
}
