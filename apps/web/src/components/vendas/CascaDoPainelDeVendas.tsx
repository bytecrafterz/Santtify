'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/components/ProvedorDeAuth'
import { Icone, ProvedorDoPeriodo, type NomeDoIcone } from './comum'

const MENU: Array<{ rota: string; rotulo: string; icone: NomeDoIcone }> = [
  { rota: '', rotulo: 'Pedidos', icone: 'carrinho' },
  { rota: '/clientes', rotulo: 'Clientes', icone: 'pessoa' },
  { rota: '/afiliados', rotulo: 'Afiliados', icone: 'pessoas' },
  { rota: '/produtos', rotulo: 'Produtos', icone: 'caixa' },
  { rota: '/financeiro', rotulo: 'Financeiro', icone: 'dinheiro' },
  { rota: '/relatorios', rotulo: 'Relatórios', icone: 'grafico' },
  { rota: '/configuracoes', rotulo: 'Configurações', icone: 'engrenagem' },
]

/**
 * O painel de vendas: o menu do lado e a página ao meio.
 *
 * O menu é o do mockup dele de 25/09 — Pedidos, Clientes, Afiliados,
 * Produtos, Financeiro, Relatórios, Configurações — e só isso. No telemóvel
 * passa a uma fila no topo que desliza para o lado.
 */
export function CascaDoPainelDeVendas({ projectSlug, children }: { projectSlug: string; children: ReactNode }) {
  const { usuario, carregando } = useAuth()
  const router = useRouter()
  const caminho = usePathname()
  const base = `/${projectSlug}/admin/vendas`

  useEffect(() => {
    if (carregando || usuario) return
    router.replace(`/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
  }, [carregando, usuario, projectSlug, router])

  if (carregando || !usuario) {
    return (
      <main className="vd-sem-acesso">
        <p className="vazio">Carregando...</p>
      </main>
    )
  }
  if (usuario.role !== 'ADMIN') {
    return (
      <main className="vd-sem-acesso">
        <p className="erro">Esta área é restrita ao administrador.</p>
      </main>
    )
  }

  return (
    <ProvedorDoPeriodo>
      <div className="vd">
        <aside className="vd-menu">
          <Link className="vd-marca" href={`/${projectSlug}/admin`}>
            <span className="vd-marca-coroa" aria-hidden="true">
              ♛
            </span>
            <span>
              Santtify
              <small>Vendas</small>
            </span>
          </Link>
          <nav aria-label="Painel de vendas">
            {MENU.map((m) => {
              const href = `${base}${m.rota}`
              const actual = m.rota === '' ? caminho === base : caminho?.startsWith(href)
              return (
                <Link key={m.rota} href={href} className={actual ? 'actual' : ''} aria-current={actual ? 'page' : undefined}>
                  <Icone nome={m.icone} />
                  <span>{m.rotulo}</span>
                </Link>
              )
            })}
          </nav>
          <Link className="vd-sair" href={`/${projectSlug}/admin`}>
            <Icone nome="voltar" />
            <span>Voltar ao painel</span>
          </Link>
        </aside>
        <div className="vd-conteudo">{children}</div>
      </div>
    </ProvedorDoPeriodo>
  )
}
