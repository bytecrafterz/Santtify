import Link from 'next/link'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { EntrarNoGrupoPv } from '@/components/EntrarNoGrupoPv'
import { IntroducaoEmCartoes } from '@/components/IntroducaoEmCartoes'
import { BarraInferior } from '@/components/BarraInferior'

/**
 * Página institucional do Produto Vivo.
 *
 * A arte e os textos definitivos vêm do cliente. O que está aqui é a
 * ESTRUTURA que ele pediu — a página existe, está ligada ao selo PV de todo o
 * app e tem o botão de WhatsApp no lugar certo. Trocar texto e arte depois não
 * mexe em nada além deste arquivo.
 *
 * Rota estática: tem precedência sobre [contentSlug], então nenhum conteúdo
 * com slug "produto-vivo" conflita com ela.
 */

/**
 * Link de convite do grupo oficial do Produto Vivo.
 *
 * Fica em variável de ambiente, e não no código, por dois motivos: o cliente
 * pode trocar o convite no WhatsApp a qualquer momento (é o que se faz quando
 * um grupo recebe spam), e assim a troca é uma linha de configuração em vez de
 * uma alteração de código com novo deploy.
 */
const GRUPO_PV = process.env.NEXT_PUBLIC_PV_GRUPO_URL ?? ''

export const metadata = {
  title: 'Produto Vivo — a tecnologia por trás desta plataforma',
  description:
    'O Produto Vivo transforma qualquer site ou aplicativo em uma mini rede social comercial.',
}

export default async function PaginaProdutoVivo({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  const project = await api.projeto(projectSlug)

  const cats = await api.categorias(projectSlug).catch(() => null)

  /**
   * As publicações do Produto Vivo. Se falharem, a página abre à mesma com o
   * grupo e a nota da patente: o convite às empresas é o que esta página existe
   * para dar, e não pode depender de já haver conteúdo preenchido.
   */
  const pv = await api.conteudo(projectSlug, 'produto-vivo').catch(() => null)

  // Aceita só convite de grupo do WhatsApp. Um endereço qualquer colado aqui
  // por engano viraria um botão levando a lugar nenhum, numa página que é a
  // porta de entrada comercial do projeto.
  const linkGrupo = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(GRUPO_PV) ? GRUPO_PV : null

  return (
    <main className="envoltorio com-barra">
      {project && <RastreadorDeVisita projectId={project.id} type="PAGE_VIEW" />}

      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← Voltar</Link>
      </div>

      <h1>Produto Vivo</h1>
      <p className="subtitulo">dando vida aos produtos</p>

      {/* O TEXTO INSTITUCIONAL SAIU. Ele disse-o em 25/08: era grande e
          confuso, e não explicava o que aquilo é. No lugar ficam as publicações
          do Produto Vivo, com a mesma estrutura dos áudios — foto, som, título,
          texto e os quatro indicadores — que ele preenche e duplica no painel,
          sem depender de mim para trocar uma palavra. */}
      {pv && (
        <IntroducaoEmCartoes
          contentId={pv.content.id}
          blocos={pv.content.blocks}
          projectId={project?.id ?? ''}
          projectSlug={projectSlug}
          categorias={cats?.categorias ?? []}
        />
      )}

      <div className="bloco chamada-pv">
        <p className="bloco-texto">
          Tem uma empresa e gostaria de conhecer ou acompanhar o desenvolvimento do Produto Vivo?
        </p>
        {/* Diz que é grupo ANTES do toque. Quem espera conversa privada e cai
            num grupo com desconhecidos sai na hora — e teria sido um contato
            perdido por surpresa, não por falta de interesse. */}
        <p className="nota">
          Entre no grupo oficial no WhatsApp: lá saem as novidades, as demonstrações e os números do
          projeto, e dá para acompanhar a evolução junto com outras empresas.
        </p>
        {linkGrupo ? (
          <EntrarNoGrupoPv projectId={project?.id ?? ''} url={linkGrupo} />
        ) : (
          <p className="bloco-vazio">Botão aguardando o link do grupo.</p>
        )}
      </div>

      {/* Discreto, como ele pediu, e com a palavra certa: o pedido foi
          depositado, não concedido. Escrever "patenteado" seria afirmar uma
          coisa que ainda não aconteceu. */}
      <p className="nota nota-patente">
        Produto Vivo — tecnologia com pedido de patente depositado.
      </p>

      <BarraInferior projectSlug={projectSlug} linkPdf={project?.checkoutUrl ?? null} />
    </main>
  )
}
