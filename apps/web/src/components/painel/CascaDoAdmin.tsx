'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/components/ProvedorDeAuth'
import { admin } from '@/lib/admin'
import { mensagens } from '@/lib/mensagens'
import { IconeDoPainel, type NomeDoIconeDoPainel } from './IconesDoPainel'

const PROJETO_PADRAO = process.env.NEXT_PUBLIC_PROJETO_PADRAO ?? 'jesus-alfabeto-saudavel'

type ChaveDaArea =
  | 'projetos'
  | 'vendas'
  | 'afiliados'
  | 'conteudo'
  | 'comunidade'
  | 'mensagens'
  | 'analise'
  | 'configuracoes'

interface Aba {
  rotulo: string
  href: string
  /** Só conta como aberta no endereço exacto, e não nos que começam por ele. */
  exacto?: boolean
}

interface Area {
  chave: ChaveDaArea
  rotulo: string
  icone: NomeDoIconeDoPainel
  href: (projeto: string) => string
  abas?: (projeto: string) => Aba[]
  /** Neste ecrã os dados são de um projeto: mostra-se a escolha do projeto. */
  porProjeto?: (resto: string) => boolean
}

/**
 * AS OITO ÁREAS DO PAINEL, na ordem do mockup dele de 03/10.
 *
 * "Não quero mais essas funções misturadas em uma única página longa. Cada área
 * precisa ter seu próprio espaço." Cada área é uma entrada do menu; as que têm
 * mais de um ecrã mostram-nos em abas por cima da página, e não numa lista.
 *
 * Os ecrãs são os que já existiam — nenhum foi reescrito. Mudou o sítio por
 * onde se chega a eles.
 */
const AREAS: Area[] = [
  { chave: 'projetos', rotulo: 'Projetos', icone: 'pasta', href: () => '/admin' },
  {
    chave: 'vendas',
    rotulo: 'Vendas',
    icone: 'carrinho',
    href: (p) => `/${p}/admin/vendas`,
    abas: (p) => [
      { rotulo: 'Pedidos', href: `/${p}/admin/vendas`, exacto: true },
      { rotulo: 'Clientes', href: `/${p}/admin/vendas/clientes` },
      { rotulo: 'Produtos', href: `/${p}/admin/vendas/produtos` },
    ],
  },
  {
    chave: 'afiliados',
    rotulo: 'Afiliados',
    icone: 'afiliados',
    href: (p) => `/${p}/admin/vendas/afiliados`,
    abas: (p) => [
      { rotulo: 'Afiliados', href: `/${p}/admin/vendas/afiliados` },
      { rotulo: 'Pagamentos', href: `/${p}/admin/vendas/financeiro` },
    ],
  },
  {
    chave: 'conteudo',
    rotulo: 'Conteúdo',
    icone: 'conteudo',
    href: () => '/admin/conteudo',
    abas: (p) => [
      { rotulo: 'Por projeto', href: '/admin/conteudo' },
      { rotulo: 'Página inicial', href: `/${p}/admin/carrossel` },
    ],
  },
  {
    chave: 'comunidade',
    rotulo: 'Comunidade',
    icone: 'comunidade',
    href: (p) => `/${p}/admin/comunidade`,
    porProjeto: () => true,
    abas: (p) => [
      { rotulo: 'Comentários e contas', href: `/${p}/admin/comunidade` },
      { rotulo: 'Aprovações', href: `/${p}/admin/moderacao` },
      { rotulo: 'Ajuda e suporte', href: `/${p}/admin/suporte` },
    ],
  },
  { chave: 'mensagens', rotulo: 'Mensagens', icone: 'mensagens', href: () => '/admin/mensagens' },
  {
    chave: 'analise',
    rotulo: 'Análise',
    icone: 'analise',
    href: (p) => `/${p}/admin/metricas`,
    porProjeto: (resto) => resto.startsWith('/metricas'),
    abas: (p) => [
      { rotulo: 'Métricas', href: `/${p}/admin/metricas` },
      { rotulo: 'Relatórios de vendas', href: `/${p}/admin/vendas/relatorios` },
    ],
  },
  {
    chave: 'configuracoes',
    rotulo: 'Configurações',
    icone: 'configuracoes',
    href: (p) => `/${p}/admin/vendas/configuracoes`,
  },
]

/** De que projeto é o endereço, e o que vem depois de `/admin`. */
function lerCaminho(caminho: string): { projeto: string | null; resto: string } {
  if (caminho === '/admin' || caminho.startsWith('/admin/')) {
    return { projeto: null, resto: caminho.slice('/admin'.length) }
  }
  const m = caminho.match(/^\/([^/]+)\/admin(\/.*)?$/)
  if (m) return { projeto: m[1], resto: m[2] ?? '' }
  return { projeto: null, resto: '' }
}

/** A área a que um endereço pertence. Tudo o que é de um projeto cai em Projetos. */
function areaDoCaminho(caminho: string): ChaveDaArea {
  const { projeto, resto } = lerCaminho(caminho)
  if (projeto === null) {
    if (resto.startsWith('/conteudo')) return 'conteudo'
    if (resto.startsWith('/mensagens')) return 'mensagens'
    if (resto.startsWith('/configuracoes')) return 'configuracoes'
    return 'projetos'
  }
  if (resto.startsWith('/vendas/afiliados') || resto.startsWith('/vendas/financeiro')) return 'afiliados'
  if (resto.startsWith('/vendas/relatorios') || resto.startsWith('/metricas')) return 'analise'
  if (resto.startsWith('/vendas/configuracoes')) return 'configuracoes'
  if (resto.startsWith('/vendas')) return 'vendas'
  if (resto.startsWith('/carrossel')) return 'conteudo'
  if (resto.startsWith('/comunidade') || resto.startsWith('/moderacao') || resto.startsWith('/suporte')) {
    return 'comunidade'
  }
  return 'projetos'
}

/**
 * A CASCA DO PAINEL: o menu das oito áreas, o topo, e a página ao meio.
 *
 * Envolve TODO o painel — a entrada (`/admin`) e cada ecrã de um projeto
 * (`/<projeto>/admin/...`) — para o menu estar sempre no mesmo sítio, seja
 * qual for o ecrã. Era o que faltava: cada página tinha o seu caminho de volta,
 * e a única forma de ir de uma área a outra era regressar à lista longa.
 *
 * No telemóvel o menu passa a uma faixa no topo que desliza para o lado, como
 * já era o das vendas, que ele aprovou.
 */
export function CascaDoAdmin({ children }: { children: ReactNode }) {
  const { usuario, carregando, sair } = useAuth()
  const router = useRouter()
  const caminho = usePathname() ?? '/admin'
  const { projeto: projetoDoEndereco, resto } = lerCaminho(caminho)
  // As áreas que não são de um projeto (vendas, afiliados…) usam o endereço do
  // projeto em que se está, ou o principal. Os dados delas são de todos.
  const projeto = projetoDoEndereco ?? PROJETO_PADRAO
  const areaActual = areaDoCaminho(caminho)
  const area = AREAS.find((a) => a.chave === areaActual)!

  useEffect(() => {
    if (carregando || usuario) return
    router.replace(`/${projeto}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
  }, [carregando, usuario, projeto, router])

  if (carregando || !usuario) {
    return (
      <main className="adm-sem-acesso">
        <p className="vazio">Carregando...</p>
      </main>
    )
  }
  if (usuario.role !== 'ADMIN') {
    return (
      <main className="adm-sem-acesso">
        <p className="erro">Esta área é restrita ao administrador.</p>
      </main>
    )
  }

  const abas = area.abas?.(projeto) ?? null
  const comEscolhaDoProjeto = Boolean(projetoDoEndereco && area.porProjeto?.(resto))

  return (
    <div className="adm">
      <aside className="adm-menu">
        <Link className="adm-marca" href="/admin" aria-label="Santtify — Meus Projetos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icone-192.png?v=20261003" alt="" width={40} height={40} />
          <span>
            Santtify
            <small>Painel</small>
          </span>
        </Link>
        <nav aria-label="Áreas do painel">
          {AREAS.map((a) => {
            const actual = a.chave === areaActual
            return (
              <Link
                key={a.chave}
                href={a.href(projeto)}
                className={`adm-area adm-area-${a.chave}${actual ? ' actual' : ''}`}
                aria-current={actual ? 'page' : undefined}
              >
                <IconeDoPainel nome={a.icone} />
                <span>{a.rotulo}</span>
                {a.chave === 'mensagens' && <ContadorDeMensagens />}
              </Link>
            )
          })}
        </nav>
        <button
          type="button"
          className="adm-sair"
          onClick={async () => {
            await sair()
            router.replace('/')
          }}
        >
          <IconeDoPainel nome="sair" />
          <span>Sair</span>
        </button>
      </aside>

      <div className="adm-corpo">
        <header className="adm-topo">
          <Avisos projeto={projeto} />
          <span className="adm-quem">
            {usuario.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={usuario.avatarUrl} alt="" />
            ) : (
              <span className="adm-quem-inicial" aria-hidden="true">
                {usuario.displayName.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span>
              <strong>{usuario.displayName}</strong>
              <small>Administrador</small>
            </span>
          </span>
        </header>

        {(abas || comEscolhaDoProjeto) && (
          <div className="adm-abas-linha">
            {abas && (
              <nav className="adm-abas" aria-label={area.rotulo}>
                {abas.map((aba) => {
                  const aberta = aba.exacto ? caminho === aba.href : caminho.startsWith(aba.href)
                  return (
                    <Link
                      key={aba.href}
                      href={aba.href}
                      className={aberta ? 'aberta' : ''}
                      aria-current={aberta ? 'page' : undefined}
                    >
                      {aba.rotulo}
                    </Link>
                  )
                })}
              </nav>
            )}
            {comEscolhaDoProjeto && projetoDoEndereco && (
              <EscolhaDoProjeto projeto={projetoDoEndereco} caminho={caminho} />
            )}
          </div>
        )}

        <div className="adm-conteudo">{children}</div>
      </div>
    </div>
  )
}

/**
 * O projeto de que se vêem os dados, nas áreas em que eles são por projeto
 * (comentários, aprovações, ajuda). Trocar mantém o ecrã e muda só o projeto.
 */
function EscolhaDoProjeto({ projeto, caminho }: { projeto: string; caminho: string }) {
  const router = useRouter()
  const [projetos, definirProjetos] = useState<Array<{ slug: string; nome: string }> | null>(null)

  useEffect(() => {
    admin
      .projetosDoPainel()
      .then(definirProjetos)
      .catch(() => definirProjetos(null))
  }, [])

  if (!projetos || projetos.length < 2) return null
  return (
    <label className="adm-projeto">
      <span>Projeto</span>
      <select
        value={projeto}
        onChange={(e) => router.push(caminho.replace(`/${projeto}/admin`, `/${e.target.value}/admin`))}
      >
        {projetos.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.nome}
          </option>
        ))}
      </select>
    </label>
  )
}

function ContadorDeMensagens() {
  const [porLer, definirPorLer] = useState(0)
  useEffect(() => {
    mensagens
      .naoLidas()
      .then((r) => definirPorLer(r.naoLidas))
      .catch(() => {})
  }, [])
  if (!porLer) return null
  return (
    <em className="adm-contador" aria-label={`${porLer} por ler`}>
      {porLer > 99 ? '99+' : porLer}
    </em>
  )
}

/**
 * O sino: o que está à espera dele, num sítio só.
 *
 * Os avisos de ajuda e de fotos por aprovar estavam no topo da lista longa, e
 * só se viam ao entrar no painel. Agora acompanham-no em qualquer ecrã.
 */
function Avisos({ projeto }: { projeto: string }) {
  const [aberto, definirAberto] = useState(false)
  const [itens, definirItens] = useState<Array<{ texto: string; href: string; n: number }>>([])

  useEffect(() => {
    let vivo = true
    Promise.allSettled([
      mensagens.naoLidas(),
      admin.pedidosDeReposicao(projeto),
      admin.publicacoesPendentes(projeto),
    ]).then(([m, ajuda, fotos]) => {
      if (!vivo) return
      const lista: Array<{ texto: string; href: string; n: number }> = []
      if (m.status === 'fulfilled' && m.value.naoLidas) {
        const n = m.value.naoLidas
        lista.push({ n, texto: n === 1 ? 'mensagem por ler' : 'mensagens por ler', href: '/admin/mensagens' })
      }
      if (ajuda.status === 'fulfilled') {
        const n = ajuda.value.pedidos.filter((p) => !p.usedAt && !p.atendidoEm).length
        if (n) {
          lista.push({
            n,
            texto: n === 1 ? 'pessoa esperando ajuda para entrar' : 'pessoas esperando ajuda para entrar',
            href: `/${projeto}/admin/suporte`,
          })
        }
      }
      if (fotos.status === 'fulfilled' && fotos.value.posts.length) {
        const n = fotos.value.posts.length
        lista.push({
          n,
          texto: n === 1 ? 'foto aguardando aprovação' : 'fotos aguardando aprovação',
          href: `/${projeto}/admin/moderacao`,
        })
      }
      definirItens(lista)
    })
    return () => {
      vivo = false
    }
  }, [projeto])

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && definirAberto(false)
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  const total = itens.reduce((t, i) => t + i.n, 0)

  return (
    <div className="adm-avisos">
      <button
        type="button"
        className="adm-sino"
        aria-label={total ? `${total} avisos` : 'Sem avisos'}
        aria-expanded={aberto}
        onClick={() => definirAberto((v) => !v)}
      >
        <IconeDoPainel nome="sino" tamanho={24} />
        {total > 0 && <em className="adm-contador">{total > 99 ? '99+' : total}</em>}
      </button>
      {aberto && (
        <>
          <button type="button" className="adm-avisos-fundo" aria-label="Fechar" onClick={() => definirAberto(false)} />
          <div className="adm-avisos-caixa" role="dialog" aria-label="Avisos">
            {itens.length === 0 ? (
              <p>Nada à sua espera agora.</p>
            ) : (
              <ul>
                {itens.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} onClick={() => definirAberto(false)}>
                      <strong>{i.n}</strong> {i.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
