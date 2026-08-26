'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

/**
 * A folha A4 na tela, e as quatro coisas que se fazem com ela.
 *
 * IMPRIMIR ABRE O PDF, e não manda imprimir esta página. É a mesma decisão de
 * 26/08 e pela mesma razão: o navegador imprime o que está no ecrã, e o que
 * está no ecrã tem botões. O PDF só tem o cartão, e sai numa folha certa em
 * qualquer impressora.
 *
 * COMPARTILHAR usa a partilha do próprio telemóvel quando existe, que é a que
 * já tem o WhatsApp dele lá dentro. Onde não existe, copia o endereço, porque
 * um botão que não faz nada é pior do que um botão que faz o mínimo.
 */
export function VistaDoCartao({
  projectSlug,
  contentSlug,
  letra,
  titulo,
  folha,
}: {
  projectSlug: string
  contentSlug: string
  letra: string
  titulo: string
  folha: string
}) {
  const router = useRouter()
  const [aviso, definirAviso] = useState<string | null>(null)
  const nome = letra ? `Letra ${letra}` : titulo
  const pdf = api.cartaoPdfUrl(projectSlug, contentSlug)
  const pdfParaBaixar = api.cartaoPdfUrl(projectSlug, contentSlug, true)

  async function partilhar() {
    const endereco = typeof window === 'undefined' ? '' : window.location.href
    const dados = {
      title: `Cartão da ${nome}`,
      text: `Cartão da ${nome} para imprimir`,
      url: endereco,
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(dados)
        return
      }
      await navigator.clipboard.writeText(endereco)
      definirAviso('Endereço copiado. É só colar onde quiser enviar.')
    } catch {
      // Fechar a folha de partilha do sistema cai aqui, e não é um erro.
    }
  }

  return (
    <main className="vista-cartao">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="folha-do-cartao" src={folha} alt={`Cartão da ${nome} em folha A4`} />

      {aviso && <p className="nota-ok">{aviso}</p>}

      <div className="acoes-do-cartao">
        <button
          type="button"
          className="acao-do-cartao"
          onClick={() => {
            // `back()` respeita de onde a pessoa veio. Quem chegou por um
            // endereço directo não tem para onde voltar, e por isso há destino.
            if (window.history.length > 1) router.back()
            else router.push(`/${projectSlug}`)
          }}
        >
          <span aria-hidden>←</span>
          VOLTAR
        </button>

        <a
          className="acao-do-cartao"
          href={pdfParaBaixar}
          download={`cartao-${letra ? `letra-${letra.toLowerCase()}` : contentSlug}.pdf`}
        >
          <span aria-hidden>⬇</span>
          BAIXAR PDF
        </a>

        <a className="acao-do-cartao" href={pdf} target="_blank" rel="noopener noreferrer">
          <span aria-hidden>🖨</span>
          IMPRIMIR
        </a>

        <button type="button" className="acao-do-cartao" onClick={() => void partilhar()}>
          <span aria-hidden>↗</span>
          COMPARTILHAR
        </button>
      </div>
    </main>
  )
}
