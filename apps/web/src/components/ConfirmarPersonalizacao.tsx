'use client'

import { useEffect, useId, useState } from 'react'

/**
 * A CONFIRMAÇÃO ANTES DE PAGAR.
 *
 * Pedido dele em 25/09, desenhado por ele: "Eu estava pensando em uma forma de
 * evitar problemas com cancelamentos depois que o cliente já recebeu o produto
 * personalizado." O cartão só serve para aquela criança — não há devolução que
 * se possa revender —, por isso a revisão tem de acontecer ANTES do dinheiro.
 *
 * "Confirmar e pagar" só acende com a caixa marcada. O servidor recusa a
 * cobrança sem ela e grava no pedido quando foi dada e a frase que se aceitou:
 * é isso que "fica registrada a aprovação" quer dizer.
 */
export function ConfirmarPersonalizacao({
  aPagar,
  aoConfirmar,
  aoRevisar,
  aoFechar,
}: {
  aPagar: boolean
  aoConfirmar: () => void
  aoRevisar: () => void
  aoFechar: () => void
}) {
  const [aprovou, definirAprovou] = useState(false)
  const titulo = useId()

  useEffect(() => {
    const fechaComEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !aPagar) aoFechar()
    }
    window.addEventListener('keydown', fechaComEsc)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', fechaComEsc)
      document.body.style.overflow = antes
    }
  }, [aoFechar, aPagar])

  return (
    <div className="confirmar-fundo" onClick={() => !aPagar && aoFechar()}>
      <div
        className="confirmar"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="confirmar-fechar"
          aria-label="Fechar"
          onClick={aoFechar}
          disabled={aPagar}
        >
          ✕
        </button>

        <header className="confirmar-topo">
          <svg className="confirmar-escudo" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z" fill="currentColor" />
            <path d="m8.5 12.2 2.4 2.4 4.7-4.9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 id={titulo}>
            Confirme sua <span>personalização</span>
          </h2>
        </header>

        <label className={aprovou ? 'confirmar-caixa marcada' : 'confirmar-caixa'}>
          <input
            type="checkbox"
            checked={aprovou}
            onChange={(e) => definirAprovou(e.target.checked)}
          />
          <span className="confirmar-visto" aria-hidden="true">
            ✓
          </span>
          <span>Confirmo que revisei e aprovei o nome e a foto dos meus cartões.</span>
        </label>

        <div className="confirmar-aviso">
          <span className="confirmar-exclamacao" aria-hidden="true">
            !
          </span>
          <p>
            <strong>Produto personalizado.</strong>
            <span>Não há devolução após o pagamento.</span>
          </p>
        </div>

        <div className="confirmar-accoes">
          <button type="button" className="confirmar-revisar" onClick={aoRevisar} disabled={aPagar}>
            <span aria-hidden="true">←</span> Voltar para revisar
          </button>
          <button
            type="button"
            className="confirmar-pagar"
            disabled={!aprovou || aPagar}
            onClick={aoConfirmar}
          >
            <span aria-hidden="true">🔒</span> {aPagar ? 'Abrindo o pagamento…' : 'Confirmar e pagar'}
          </button>
        </div>
      </div>
    </div>
  )
}
