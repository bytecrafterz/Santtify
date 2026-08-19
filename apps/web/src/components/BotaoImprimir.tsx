'use client'

import { useState } from 'react'
import { rastrear } from '@/lib/track'
import { abreviar } from '@/lib/numeros'

/**
 * "Imprimir", com o contador público ao lado.
 *
 * O contador é o pedido do cliente de 19/08, e a razão dele é comercial: um
 * número visível de impressões diz a uma família que chega agora que aquele
 * material já foi parar à parede da casa de muita gente.
 *
 * O registo acontece ANTES de abrir a janela de impressão, e não depois. A
 * caixa de impressão do sistema bloqueia a página enquanto está aberta, e há
 * aparelhos onde o que ficou para trás nunca chega a correr — o clique seria
 * perdido justamente nas impressões que de facto aconteceram.
 */
export function BotaoImprimir({
  projectId,
  impressoes,
}: {
  projectId: string
  impressoes: number
}) {
  const [total, definirTotal] = useState(impressoes)

  async function imprimir() {
    try {
      await rastrear({ projectId, type: 'CUSTOM', props: { acao: 'imprimir' } })
      definirTotal((n) => n + 1)
    } catch {
      // Contar é bom, imprimir é o que a pessoa pediu: uma falha no registo
      // não pode impedir a impressão.
    }
    window.print()
  }

  return (
    <div className="linha-acoes sem-margem">
      <button type="button" className="botao-acao" onClick={imprimir}>
        🖨 Imprimir
      </button>
      <span className="pilula-contador" title="Impressões">
        🖨 {abreviar(total)}
      </span>
    </div>
  )
}
