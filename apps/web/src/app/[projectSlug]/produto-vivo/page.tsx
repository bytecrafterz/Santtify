import Link from 'next/link'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'

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

// Substituir pelo número que o cliente enviar.
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_PV ?? ''

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

  const linkWhatsapp = WHATSAPP
    ? `https://wa.me/${WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent(
        'Olá! Vi o Produto Vivo e gostaria de saber mais para a minha empresa.',
      )}`
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
        {linkWhatsapp ? (
          <a
            className="botao-whatsapp"
            href={linkWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            Falar pelo WhatsApp
          </a>
        ) : (
          <p className="bloco-vazio">
            Botão de WhatsApp aguardando o número de contato.
          </p>
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
