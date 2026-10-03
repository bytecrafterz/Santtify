'use client'

import type { ReactNode } from 'react'
import { ProvedorDoPeriodo } from './comum'

/**
 * Os ecrãs de vendas e afiliados: o período partilhado e as cores deles.
 *
 * Tinha aqui o menu escuro do lado, do mockup de 25/09. Desde 03/10 esse menu é
 * o do painel inteiro (`CascaDoAdmin`), com as oito áreas, e as entradas que
 * eram só das vendas passaram a abas dentro das áreas Vendas, Afiliados,
 * Análise e Configurações. O acesso também é verificado lá.
 */
export function CascaDoPainelDeVendas({ children }: { projectSlug: string; children: ReactNode }) {
  return (
    <ProvedorDoPeriodo>
      <div className="vd">
        <div className="vd-conteudo">{children}</div>
      </div>
    </ProvedorDoPeriodo>
  )
}
