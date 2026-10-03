'use client'

import { useState } from 'react'
import { admin } from '@/lib/admin'

/**
 * O link externo de compra do projeto.
 *
 * Fica no painel principal e não em cada letra: o produto é um só, então ele
 * cola uma vez e o botão aparece nas 26. Por letra seriam 26 lugares para
 * errar e depois manter.
 *
 * O clique no botão do site é registrado antes de a pessoa sair, e o endereço
 * leva junto um código da origem dela — é o que vai permitir, no dia em que a
 * confirmação da Hotmart for ligada, saber de qual canal veio cada venda.
 */
export function LinkDeCompra({
  projectSlug,
  atual,
  aoMudar,
}: {
  projectSlug: string
  atual: string | null
  aoMudar: () => Promise<void>
}) {
  const [valor, definirValor] = useState(atual ?? '')
  const [salvando, definirSalvando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const [salvo, definirSalvo] = useState(false)

  async function salvar() {
    if (valor.trim() === (atual ?? '')) return
    definirSalvando(true)
    definirErro(null)
    try {
      await admin.definirLinkDeCompra(projectSlug, valor.trim() || null)
      await aoMudar()
      definirSalvo(true)
      setTimeout(() => definirSalvo(false), 2500)
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível salvar')
    } finally {
      definirSalvando(false)
    }
  }

  return (
    <div className="cp-campo-link">
      <span className="cp-campo-link-texto">
        <strong>
          Link de compra
          {atual ? <em className="pi-estado ok">ligado</em> : <em className="pi-estado">vazio</em>}
        </strong>
        <small>O endereço da Hotmart. O botão de comprar aparece no fim de cada página do projeto.</small>
        <input
          type="url"
          inputMode="url"
          value={valor}
          placeholder="https://pay.hotmart.com/..."
          aria-label="Link de compra da Hotmart"
          onChange={(e) => definirValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {salvando && <small>Salvando...</small>}
        {salvo && <small className="pi-ok">Salvo.</small>}
        {!atual && !valor && !salvando && <small>Enquanto estiver vazio, nenhum botão de compra aparece no site.</small>}
        {erro && <small className="pi-erro">{erro}</small>}
      </span>
    </div>
  )
}
