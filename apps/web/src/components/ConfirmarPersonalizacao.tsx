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
 *
 * E, desde 03/10, A DO RESPONSÁVEL: "são dados de criança (LGPD, art. 14).
 * Caixa de confirmação do responsável antes de gerar, e aviso na tela: 'A foto
 * não é enviada nem guardada. Guarde seu PDF.'" O PDF é gerado logo a seguir
 * ao pagamento, por isso a caixa está aqui — e volta a aparecer no passo de
 * gerar se a página tiver sido recarregada entretanto (ver `EditorDeCartoes`).
 */
export const TEXTO_DO_CONSENTIMENTO =
  'Sou o pai, a mãe ou o responsável legal pela criança e autorizo usar a foto dela apenas para gerar este PDF, neste aparelho.'

/** A caixa do responsável, igual aqui e no passo de gerar. */
export function CaixaDoResponsavel({
  marcada,
  aoMudar,
}: {
  marcada: boolean
  aoMudar: (v: boolean) => void
}) {
  return (
    <label className={marcada ? 'confirmar-caixa marcada' : 'confirmar-caixa'}>
      <input type="checkbox" checked={marcada} onChange={(e) => aoMudar(e.target.checked)} />
      <span className="confirmar-visto" aria-hidden="true">
        ✓
      </span>
      <span>
        {TEXTO_DO_CONSENTIMENTO} <small className="confirmar-lei">(LGPD, art. 14)</small>
      </span>
    </label>
  )
}

/** O aviso que ele escreveu, palavra por palavra. */
export function AvisoDaFoto() {
  return (
    <p className="confirmar-privacidade">
      <span aria-hidden="true">🔒</span>
      <strong>A foto não é enviada nem guardada. Guarde seu PDF.</strong>
    </p>
  )
}
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
  const [consentiu, definirConsentiu] = useState(false)
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

        <CaixaDoResponsavel marcada={consentiu} aoMudar={definirConsentiu} />
        <AvisoDaFoto />

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
            disabled={!aprovou || !consentiu || aPagar}
            onClick={aoConfirmar}
          >
            <span aria-hidden="true">🔒</span> {aPagar ? 'Abrindo o pagamento…' : 'Confirmar e pagar'}
          </button>
        </div>
      </div>
    </div>
  )
}
