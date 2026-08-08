'use client'

import { useEffect, useState } from 'react'
import { consentimento } from '@/lib/auth'

/**
 * Banner de consentimento LGPD/GDPR.
 *
 * Três decisões que não são estéticas:
 *
 * 1. "Aceitar" e "Só o essencial" têm o MESMO peso visual. Sob GDPR, recusar
 *    precisa ser tão fácil quanto aceitar — um botão apagado ao lado de um
 *    botão colorido é padrão escuro e invalida o consentimento.
 * 2. Nada é pré-marcado. Consentimento tem de ser ato afirmativo.
 * 3. O banner não bloqueia a página. A criança que escaneou o QR consegue ver
 *    a letra mesmo sem decidir nada; o que fica suspenso é a medição, não o
 *    conteúdo.
 */
export function BannerDeConsentimento({ projectId }: { projectId: string }) {
  const [visivel, definirVisivel] = useState(false)
  const [enviando, definirEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    consentimento
      .situacao()
      .then((s) => {
        if (!cancelado && s.precisaPerguntar) definirVisivel(true)
      })
      .catch(() => {
        // API fora do ar não deve gerar banner fantasma.
      })
    return () => {
      cancelado = true
    }
  }, [])

  async function responder(aceitou: boolean) {
    definirEnviando(true)
    try {
      await consentimento.registrar({
        projectId,
        granted: aceitou,
        analytics: aceitou,
        marketing: false,
      })
      definirVisivel(false)
    } catch {
      definirEnviando(false)
    }
  }

  if (!visivel) return null

  return (
    <div className="consentimento" role="dialog" aria-label="Privacidade">
      <p>
        Usamos dados de navegação para entender como as pessoas chegam até aqui e melhorar o
        conteúdo. Não usamos para publicidade.{' '}
        <a href="/privacidade" target="_blank" rel="noopener noreferrer">
          Política de privacidade
        </a>
      </p>
      <div className="consentimento-botoes">
        <button type="button" onClick={() => responder(false)} disabled={enviando}>
          Só o essencial
        </button>
        <button type="button" onClick={() => responder(true)} disabled={enviando}>
          Aceitar
        </button>
      </div>
    </div>
  )
}
