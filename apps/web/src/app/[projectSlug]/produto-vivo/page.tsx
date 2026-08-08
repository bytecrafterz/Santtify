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
      <p className="subtitulo">
        Esta plataforma utiliza a tecnologia Produto Vivo.
      </p>

      <div className="bloco">
        <span className="bloco-rotulo">O que é</span>
        <p className="bloco-texto">
          O Produto Vivo transforma qualquer site ou aplicativo em uma mini rede social
          comercial. Em vez de um produto mostrar apenas foto, preço e descrição, ele ganha
          um card social com visualizações, curtidas, comentários e compartilhamentos.
          {'\n\n'}
          Cada empresa mantém a sua identidade visual e usa a mesma infraestrutura social.
          O utilizador tem um só perfil e interage com várias empresas, sem precisar criar
          uma conta para cada aplicativo.
        </p>
      </div>

      <div className="bloco">
        <span className="bloco-rotulo">Para empresas</span>
        {linkWhatsapp ? (
          <p className="bloco-texto">
            Quer aplicar o Produto Vivo no seu negócio?{' '}
            <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer">
              Fale comigo pelo WhatsApp
            </a>
            .
          </p>
        ) : (
          <p className="bloco-vazio">
            Botão de WhatsApp aguardando o número de contato do cliente.
          </p>
        )}
      </div>
    </main>
  )
}
