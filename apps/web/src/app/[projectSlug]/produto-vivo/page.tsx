import Link from 'next/link'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { EntrarNoGrupoPv } from '@/components/EntrarNoGrupoPv'

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

  // Aceita só convite de grupo do WhatsApp. Um endereço qualquer colado aqui
  // por engano viraria um botão levando a lugar nenhum, numa página que é a
  // porta de entrada comercial do projeto.
  const linkGrupo = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(GRUPO_PV)
    ? GRUPO_PV
    : null

  return (
    <main className="envoltorio">
      {project && <RastreadorDeVisita projectId={project.id} type="PAGE_VIEW" />}

      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← Voltar</Link>
      </div>

      <h1>Produto Vivo</h1>
      <p className="subtitulo">dando vida aos produtos</p>

      <div className="bloco">
        <p className="bloco-texto">
          O Produto Vivo é uma tecnologia que adiciona uma camada social a um site ou
          aplicativo já existente. Um produto que antes era apenas uma imagem ou item de
          catálogo passa a ter visualizações, curtidas, comentários, compartilhamentos,
          perfis e interação entre usuários.
        </p>
      </div>

      <div className="bloco">
        <span className="bloco-rotulo">Você acabou de ver funcionando</span>
        <p className="bloco-texto">
          É exatamente o que estamos demonstrando aqui com o Jesus Alfabeto Saudável: o
          conteúdo deixou de ser apenas uma página estática e ganhou vida social.
        </p>
        <p className="bloco-texto">
          A proposta futura é permitir que empresas façam isso também dentro dos próprios
          sites e aplicativos, através da integração do Produto Vivo.
        </p>
      </div>

      <div className="bloco chamada-pv">
        <p className="bloco-texto">
          Tem uma empresa e gostaria de conhecer ou acompanhar o desenvolvimento do Produto
          Vivo?
        </p>
        {/* Diz que é grupo ANTES do toque. Quem espera conversa privada e cai
            num grupo com desconhecidos sai na hora — e teria sido um contato
            perdido por surpresa, não por falta de interesse. */}
        <p className="nota">
          Entre no grupo oficial no WhatsApp: lá saem as novidades, as demonstrações e os
          números do projeto, e dá para acompanhar a evolução junto com outras empresas.
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
    </main>
  )
}
