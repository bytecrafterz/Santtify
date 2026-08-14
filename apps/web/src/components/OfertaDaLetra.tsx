'use client'

import { useState } from 'react'
import { social } from '@/lib/social'
import { rastrear } from '@/lib/track'

/**
 * O fim da página da letra: experimentar grátis e comprar.
 *
 * É o fluxo que o cliente descreveu em 14/08 — a pessoa ouve a música, conhece
 * o conteúdo, baixa o cartão da letra A para imprimir em casa, e se gostar
 * clica para comprar o produto completo.
 *
 * Os dois botões aparecem só quando existe o que mostrar: sem PDF cadastrado,
 * não há botão de baixar; sem link de compra, não há botão de comprar. Assim a
 * demonstração grátis fica só na letra A sem nenhum caso especial no código —
 * é a presença do arquivo que decide.
 */
export function OfertaDaLetra({
  contentId,
  projectId,
  titulo,
  arquivoGratis,
  nomeDoArquivo,
  linkDeCompra,
}: {
  contentId: string
  projectId: string
  titulo: string
  arquivoGratis: string | null
  nomeDoArquivo: string | null
  linkDeCompra: string | null
}) {
  const [indoParaCompra, definirIndoParaCompra] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  if (!arquivoGratis && !linkDeCompra) return null

  /**
   * Registra o clique ANTES de sair do site.
   *
   * Depois que a pessoa vai para a Hotmart não há segunda chance: aquele
   * clique é o último ponto do funil que ainda pertence a nós. Por isso a
   * navegação espera o registro — e segue mesmo se ele falhar, porque perder o
   * dado é ruim, perder a venda é pior.
   */
  async function irComprar() {
    definirIndoParaCompra(true)
    definirErro(null)
    try {
      const { url } = await social.cliqueDeCompra(contentId, projectId)
      window.location.href = url
    } catch {
      if (linkDeCompra) window.location.href = linkDeCompra
      else {
        definirErro('Não foi possível abrir a página de compra.')
        definirIndoParaCompra(false)
      }
    }
  }

  return (
    <div className="bloco oferta">
      {arquivoGratis && (
        <>
          <span className="bloco-rotulo">Experimente em casa</span>
          <p className="nota">
            Baixe o cartão da {titulo} em PDF e imprima para ver como é o material físico.
          </p>
          <a
            className="botao-baixar"
            href={arquivoGratis}
            download={nomeDoArquivo ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              void rastrear({
                projectId,
                contentId,
                type: 'CUSTOM',
                props: { acao: 'download_gratis', arquivo: nomeDoArquivo },
              })
            }
          >
            Baixar cartão grátis — {titulo}
          </a>
        </>
      )}

      {linkDeCompra && (
        <>
          <p className="nota oferta-chamada">
            Gostou? O produto completo tem as 26 letras, com música, conteúdo e os cartões
            para imprimir.
          </p>
          <button type="button" className="botao-comprar" onClick={irComprar} disabled={indoParaCompra}>
            {indoParaCompra ? 'Abrindo...' : 'Conhecer o produto completo'}
          </button>
        </>
      )}

      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
