import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { EntrarNoGrupoPv } from '@/components/EntrarNoGrupoPv'

export const metadata = { title: 'Esqueci minha senha' }

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
        <Link href={`/${projectSlug}/entrar`}>← Voltar para entrar</Link>
      </div>

      <h1>Esqueci minha senha</h1>

      <div className="bloco">
        <p>
          A recuperação automática por e-mail está a ser preparada e ainda não funciona. Para
          não a deixar sem saída, o caminho por agora é este:
        </p>
        <p className="nota">
          Fale com o responsável no grupo do WhatsApp, diga qual é o seu e-mail de acesso, e ele
          repõe a sua entrada. Não partilhe a sua senha antiga com ninguém, nem no grupo.
        </p>
      </div>

      {process.env.NEXT_PUBLIC_PV_GRUPO_URL && (
        <EntrarNoGrupoPv
          projectId={project.id}
          url={process.env.NEXT_PUBLIC_PV_GRUPO_URL}
        />
      )}

      <p className="nota">
        Se ainda se lembra da senha, pode <Link href={`/${projectSlug}/entrar`}>entrar aqui</Link>.
        Já dentro da sua conta, no perfil, existe o botão de trocar a senha.
      </p>
    </main>
  )
}
