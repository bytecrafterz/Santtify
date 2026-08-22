import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { FormularioDeAuth } from "@/components/FormularioDeAuth";
import { FolhaDeInstalacao } from "@/components/FolhaDeInstalacao";
import { DecoracaoPastel } from "@/components/DecoracaoPastel";

export const metadata = { title: "Bem-vindo à Santtify" };

/**
 * A tela de entrada com a folha de instalação por cima — o desenho de 22/08.
 *
 * Antes daqui havia duas telas seguidas: uma a convidar a instalar e outra a
 * pedir os dados. Ele desenhou-as sobrepostas, e tem razão: instalar e entrar
 * são a mesma visita. Quem instala volta e o formulário está no sítio onde o
 * deixou; quem não quer instalar afasta a folha e já está no formulário. Em
 * nenhum dos dois casos se muda de página.
 */
export default async function PaginaDeInstalacao({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const project = await api.projeto(projectSlug);
  if (!project) notFound();

  return (
    <main className="tela-boas-vindas">
      <DecoracaoPastel />

      <div className="boas-vindas-conteudo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="marca-boas-vindas"
          src="/logo-santtify.png"
          alt="Santtify"
        />

        <h1>
          BEM-VINDO À <span className="realce">SANTTIFY</span>
        </h1>
        <p className="subtitulo">Entre para continuar</p>

        <Suspense fallback={null}>
          <FormularioDeAuth
            modo="entrar"
            projectId={project.id}
            projectSlug={projectSlug}
          />
        </Suspense>

        <p className="saidas-entrada">
          <Link href={`/${projectSlug}`}>Continuar no navegador</Link>
        </p>

        {/* Os dois logotipos, como ele pediu em 22/08. Ficam no rodapé porque
            assinam a tela sem disputar espaço com o que a pessoa veio fazer. */}
        <div className="assinatura-marcas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-santtify.png" alt="Santtify" />
          <span className="risco" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-produto-vivo.png" alt="Produto Vivo" />
        </div>
      </div>

      <FolhaDeInstalacao />
    </main>
  );
}
