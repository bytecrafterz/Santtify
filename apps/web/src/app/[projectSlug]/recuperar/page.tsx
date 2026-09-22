import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { PedirReposicao } from '@/components/PedirReposicao'
import { Voltar } from '@/components/Voltar'

// O `<title>` é o nome da aplicação: o iPhone usa-o ao instalar.
export const metadata = { title: 'Santtify' }

/**
 * Recuperação de senha — versão honesta enquanto o envio de e-mail não existe.
 *
 * O link tinha de existir: uma pessoa que esquece a senha e não encontra por
 * onde recuperar conclui que perdeu a conta, e não volta. Mas prometer um
 * e-mail que o site ainda não sabe enviar seria pior do que não ter link
 * nenhum — ela ficava à espera de uma mensagem que nunca chega.
 *
 * Então esta página diz a verdade e dá um caminho que funciona hoje: falar com
 * o responsável no grupo. Quando o serviço de e-mail estiver configurado, esta
 * página passa a pedir o endereço e a enviar o link, e o resto do fluxo já fica
 * feito por baixo.
 */
export default async function PaginaDeRecuperacao({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const project = await api.projeto(projectSlug)
  if (!project) notFound()

  return (
    <main className="envoltorio estreito">
      <div className="cabecalho">
        <Voltar href={`/${projectSlug}/entrar`}>Voltar para entrar</Voltar>
      </div>

      <h1>Esqueci minha senha</h1>

      <PedirReposicao projectId={project.id} projectSlug={projectSlug} />

      <p className="nota">
        Se ainda se lembra da senha, pode <Link href={`/${projectSlug}/entrar`}>entrar aqui</Link>.
        Já dentro da sua conta, no perfil, existe o botão de trocar a senha.
      </p>
    </main>
  )
}
