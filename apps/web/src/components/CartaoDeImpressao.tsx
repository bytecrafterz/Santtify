'use client'

import { useState } from 'react'
import { rastrear } from '@/lib/track'

/**
 * O fim de uma letra: o convite a imprimir, e o cartão para imprimir.
 *
 * Ele fixou a ordem em 23/08 e é esta — depois da última publicação vem
 * "Continue para imprimir a Letra A", depois o cartão, e só depois a letra
 * seguinte. Faz sentido: o cartão é o fecho desta letra, não uma opção solta a
 * meio do caminho. Antes disto a impressão estava lá em cima, ao lado do título
 * do projeto, onde ninguém chega no fim de nada.
 *
 * O CONTADOR SÓ SOBE COM ACÇÃO CONCLUÍDA. É a regra que ele impôs em 20/08,
 * depois de tocar várias vezes no botão e ver o número subir sem ter impresso
 * nada. O navegador não conta a ninguém se saiu papel — nada conta. O que dá
 * para saber é se a pessoa levou a acção até ao fim, e é isso que se regista.
 */
export function CartaoDeImpressao({
  projectId,
  contentId,
  titulo,
  letra,
  ficheiro,
  nomeDoFicheiro,
  capa,
  qrSvgUrl,
}: {
  projectId: string
  contentId: string
  titulo: string
  letra: string
  ficheiro: string | null
  nomeDoFicheiro: string | null
  capa: string | null
  qrSvgUrl: string | null
}) {
  const [aviso, definirAviso] = useState<string | null>(null)

  async function contar(via: string) {
    try {
      await rastrear({ projectId, contentId, type: 'CUSTOM', props: { acao: 'imprimir', via } })
    } catch {
      // Falhar a contar não pode impedir a acção que a pessoa pediu.
    }
  }

  function imprimirAgora() {
    // `afterprint` dispara quando a caixa do sistema se fecha. Não garante que
    // saiu papel — nada garante — mas garante que a pessoa chegou ao fim.
    const aoTerminar = () => {
      window.removeEventListener('afterprint', aoTerminar)
      void contar('impressora')
      definirAviso('Obrigado por imprimir.')
    }
    window.addEventListener('afterprint', aoTerminar)
    window.print()
  }

  const nome = letra ? `Letra ${letra}` : titulo

  return (
    <section className="bloco-impressao">
      <p className="chamada-impressao">
        Continue para imprimir a {nome}
        <span className="seta-baixo" aria-hidden>
          ⌄
        </span>
      </p>

      <article className="cartao-impressao">
        {capa && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="arte-impressao" src={capa} alt={titulo} />
        )}

        <div className="corpo-impressao">
          <p className="etiqueta-gratis">IMPRESSÃO GRATUITA</p>
          <h3>Cartão da {nome}</h3>
          <p className="nota-impressao">
            Imprima em casa e leve a {nome} para fora do telemóvel. O QR Code do cartão traz de
            volta a esta página.
          </p>

          {qrSvgUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="qr-impressao" src={qrSvgUrl} alt={`QR Code da ${nome}`} />
          )}

          <div className="acoes-impressao">
            {ficheiro ? (
              <a
                className="botao-acao"
                href={ficheiro}
                download={nomeDoFicheiro ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void contar('download')}
              >
                ⬇ BAIXAR PDF GRÁTIS
              </a>
            ) : (
              <button type="button" className="botao-acao" onClick={imprimirAgora}>
                🖨 IMPRIMIR GRÁTIS
              </button>
            )}
          </div>

          {aviso && <p className="nota-ok">{aviso}</p>}
        </div>
      </article>
    </section>
  )
}
