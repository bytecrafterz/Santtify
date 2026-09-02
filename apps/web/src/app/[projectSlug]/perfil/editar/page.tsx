import { PaginaDeEdicaoDoPerfil } from '@/components/PaginaDeEdicaoDoPerfil'

// O `<title>` é o nome da aplicação: o iPhone usa-o ao instalar.
export const metadata = { title: 'Santtify' }

/**
 * A edição do perfil, numa página só dela.
 *
 * Vivia dentro do perfil, aberta por um botão, e por isso era uma coisa a meio:
 * abria-se por baixo do que já estava no ecrã, e sair dela era procurar um
 * botão no meio da página. Ele pediu a separação em 29/08 e tem razão — uma
 * página tem endereço próprio, tem uma coisa só lá dentro, e sabe-se sempre
 * onde se está.
 *
 * Gravar aqui devolve a pessoa ao perfil público, sozinho. Era isso que faltava:
 * "eu não deveria precisar sair da página manualmente para voltar".
 */
export default async function PaginaEditarPerfil({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  return (
    <main className="envoltorio com-barra">
      <PaginaDeEdicaoDoPerfil projectSlug={projectSlug} />
    </main>
  )
}
