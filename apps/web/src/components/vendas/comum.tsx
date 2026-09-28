'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ErroDeApi } from '@/lib/auth'
import { hojeLocal, variacaoEmTexto } from '@/lib/dinheiro'
import { NOME_DO_STATUS, type StatusDoPedido } from '@/lib/vendas'
import { NOME_DO_ESTADO, type EstadoDaVenda } from '@/lib/afiliados'

// ── O período, partilhado por todas as páginas do painel ──────────────

export interface Periodo {
  de: string
  ate: string
}

interface ContextoDoPeriodo extends Periodo {
  definir: (p: Periodo) => void
}

const CHAVE = 'pv-vendas-periodo'

/** Os últimos 30 dias, até hoje — o que o painel abre a mostrar. */
function periodoPadrao(): Periodo {
  return { de: hojeLocal(-29), ate: hojeLocal() }
}

const Contexto = createContext<ContextoDoPeriodo>({ ...periodoPadrao(), definir: () => {} })

/**
 * O período escolhido fica ao mudar de página: quem olha "setembro" nos
 * pedidos quer ver setembro no financeiro. Guarda-se na sessão do separador —
 * é conveniência, e um separador novo abre nos últimos 30 dias.
 */
export function ProvedorDoPeriodo({ children }: { children: ReactNode }) {
  const [periodo, definirPeriodo] = useState<Periodo>(periodoPadrao)

  useEffect(() => {
    try {
      const guardado = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null') as Periodo | null
      if (guardado?.de && guardado?.ate) definirPeriodo(guardado)
    } catch {
      /* sem armazenamento: fica o padrão */
    }
  }, [])

  const definir = useCallback((p: Periodo) => {
    definirPeriodo(p)
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(p))
    } catch {
      /* idem */
    }
  }, [])

  return <Contexto.Provider value={{ ...periodo, definir }}>{children}</Contexto.Provider>
}

export function usePeriodo() {
  return useContext(Contexto)
}

function inicioDoMes(desloc = 0): string {
  const d = new Date()
  const m = new Date(d.getFullYear(), d.getMonth() + desloc, 1)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
}

function fimDoMes(desloc = 0): string {
  const d = new Date()
  const m = new Date(d.getFullYear(), d.getMonth() + desloc + 1, 0)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`
}

const ATALHOS: Array<{ rotulo: string; periodo: () => Periodo }> = [
  { rotulo: 'Hoje', periodo: () => ({ de: hojeLocal(), ate: hojeLocal() }) },
  { rotulo: '7 dias', periodo: () => ({ de: hojeLocal(-6), ate: hojeLocal() }) },
  { rotulo: '30 dias', periodo: () => ({ de: hojeLocal(-29), ate: hojeLocal() }) },
  { rotulo: 'Este mês', periodo: () => ({ de: inicioDoMes(), ate: hojeLocal() }) },
  { rotulo: 'Mês passado', periodo: () => ({ de: inicioDoMes(-1), ate: fimDoMes(-1) }) },
  { rotulo: '90 dias', periodo: () => ({ de: hojeLocal(-89), ate: hojeLocal() }) },
  { rotulo: 'Este ano', periodo: () => ({ de: `${new Date().getFullYear()}-01-01`, ate: hojeLocal() }) },
]

/** O seletor de datas do topo de cada página, com os atalhos de sempre. */
export function SeletorDePeriodo() {
  const { de, ate, definir } = usePeriodo()
  const [aberto, definirAberto] = useState(false)
  const caixa = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) definirAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const legivel = (ymd: string) => ymd.split('-').reverse().join('/')

  return (
    <div className="vd-periodo" ref={caixa}>
      <button type="button" className="vd-periodo-botao" onClick={() => definirAberto((a) => !a)} aria-expanded={aberto}>
        <Icone nome="calendario" />
        <span>
          {legivel(de)} – {legivel(ate)}
        </span>
        <Icone nome="abaixo" />
      </button>
      {aberto && (
        <div className="vd-periodo-caixa" role="dialog" aria-label="Escolher período">
          <div className="vd-periodo-atalhos">
            {ATALHOS.map((a) => (
              <button
                key={a.rotulo}
                type="button"
                onClick={() => {
                  definir(a.periodo())
                  definirAberto(false)
                }}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <div className="vd-periodo-datas">
            <label>
              De
              <input type="date" value={de} max={ate} onChange={(e) => e.target.value && definir({ de: e.target.value, ate })} />
            </label>
            <label>
              Até
              <input type="date" value={ate} min={de} onChange={(e) => e.target.value && definir({ de, ate: e.target.value })} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Carregar dados ────────────────────────────────────────────────────

/**
 * Os dados de uma página: carregando, erro, e o recarregar depois de uma
 * acção. Um pedido antigo que chegue depois de um novo é ignorado — senão,
 * mudar de filtro depressa mostrava o resultado do filtro anterior.
 */
export function useDados<T>(carregar: () => Promise<T>, chaves: unknown[]) {
  const [dados, definirDados] = useState<T | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aCarregar, definirACarregar] = useState(true)
  const vez = useRef(0)

  const recarregar = useCallback(() => {
    const minha = ++vez.current
    definirACarregar(true)
    carregar()
      .then((d) => {
        if (minha !== vez.current) return
        definirDados(d)
        definirErro(null)
      })
      .catch((e) => {
        if (minha !== vez.current) return
        definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível carregar. Verifique a conexão.')
      })
      .finally(() => {
        if (minha === vez.current) definirACarregar(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, chaves)

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { dados, erro, aCarregar, recarregar }
}

/** Um valor que só muda depois de a pessoa parar de escrever. */
export function useAtrasado<T>(valor: T, ms = 350): T {
  const [atrasado, definir] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => definir(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return atrasado
}

// ── Peças do ecrã ─────────────────────────────────────────────────────

export function CabecalhoDaPagina({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children?: ReactNode
}) {
  return (
    <header className="vd-cabecalho">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {children && <div className="vd-cabecalho-acoes">{children}</div>}
    </header>
  )
}

export type CorDoCartao = 'azul' | 'verde' | 'ambar' | 'roxo' | 'vermelho' | 'cinza'

export function CartaoKpi({
  icone,
  cor,
  valor,
  rotulo,
  variacao,
  nota,
}: {
  icone: NomeDoIcone
  cor: CorDoCartao
  valor: ReactNode
  rotulo: string
  variacao?: number | null
  nota?: ReactNode
}) {
  const texto = variacao === undefined ? null : variacaoEmTexto(variacao)
  const sobe = (variacao ?? 0) > 0
  const desce = (variacao ?? 0) < 0
  return (
    <div className={`vd-kpi ${cor}`}>
      <span className="vd-kpi-icone" aria-hidden="true">
        <Icone nome={icone} />
      </span>
      <div className="vd-kpi-corpo">
        <strong>{valor}</strong>
        <span>{rotulo}</span>
        {variacao !== undefined && (
          <small className={sobe ? 'sobe' : desce ? 'desce' : ''}>
            {texto ? (
              <>
                {sobe ? '↑' : desce ? '↓' : ''} {texto} <em>vs. período anterior</em>
              </>
            ) : (
              <em>sem período anterior</em>
            )}
          </small>
        )}
        {nota && <small className="vd-kpi-nota">{nota}</small>}
      </div>
    </div>
  )
}

export function SeloDoPedido({ status, parcial }: { status: StatusDoPedido; parcial?: boolean }) {
  return (
    <span className={`vd-selo s-${status.toLowerCase()}`}>
      {NOME_DO_STATUS[status]}
      {parcial ? ' · reemb. parcial' : ''}
    </span>
  )
}

export function SeloDaComissao({ estado }: { estado: EstadoDaVenda }) {
  return <span className={`vd-selo c-${estado.toLowerCase()}`}>{NOME_DO_ESTADO[estado]}</span>
}

export function Rosto({ nome, avatarUrl, tamanho = 36 }: { nome: string | null; avatarUrl: string | null; tamanho?: number }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="vd-rosto" src={avatarUrl} alt="" width={tamanho} height={tamanho} />
  }
  return (
    <span className="vd-rosto vd-inicial" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42 }} aria-hidden="true">
      {(nome ?? '?').trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

export function Paginacao({
  pagina,
  total,
  porPagina,
  aoMudar,
  coisa,
}: {
  pagina: number
  total: number
  porPagina: number
  aoMudar: (p: number) => void
  coisa: string
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  if (total === 0) return null
  const de = (pagina - 1) * porPagina + 1
  const ate = Math.min(total, pagina * porPagina)
  const botoes: Array<number | '…'> = []
  for (let p = 1; p <= paginas; p++) {
    if (p === 1 || p === paginas || Math.abs(p - pagina) <= 1) botoes.push(p)
    else if (botoes[botoes.length - 1] !== '…') botoes.push('…')
  }
  return (
    <nav className="vd-paginacao" aria-label="Páginas">
      <span>
        Mostrando {de.toLocaleString('pt-BR')}–{ate.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} {coisa}
      </span>
      {paginas > 1 && (
        <div>
          <button type="button" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)} aria-label="Página anterior">
            ‹
          </button>
          {botoes.map((b, i) =>
            b === '…' ? (
              <span key={`r${i}`} className="vd-reticencias">
                …
              </span>
            ) : (
              <button key={b} type="button" className={b === pagina ? 'actual' : ''} onClick={() => aoMudar(b)}>
                {b}
              </button>
            ),
          )}
          <button type="button" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)} aria-label="Página seguinte">
            ›
          </button>
        </div>
      )}
    </nav>
  )
}

/**
 * O painel de detalhe: a coluna da direita no computador, a folha que sobe
 * no telemóvel. Fecha com o ✕, com Esc, e tocando fora.
 */
export function Gaveta({
  titulo,
  aberta,
  aoFechar,
  children,
}: {
  titulo: string
  aberta: boolean
  aoFechar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!aberta) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [aberta, aoFechar])

  if (!aberta) return null
  return (
    <>
      <div className="vd-gaveta-fundo" onClick={aoFechar} aria-hidden="true" />
      <aside className="vd-gaveta" role="dialog" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button type="button" className="vd-fechar" onClick={aoFechar} aria-label="Fechar">
            ✕
          </button>
        </header>
        <div className="vd-gaveta-corpo">{children}</div>
      </aside>
    </>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="vd-vazio">{children}</p>
}

export function Carregando() {
  return (
    <div className="vd-carregando" aria-label="Carregando">
      <span />
      <span />
      <span />
    </div>
  )
}

/** Copiar para a área de transferência, com recurso para navegadores antigos. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    const feito = document.execCommand('copy')
    campo.remove()
    return feito
  }
}

export function BotaoCopiar({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [estado, definirEstado] = useState<'parado' | 'feito' | 'falhou'>('parado')
  return (
    <button
      type="button"
      className="vd-botao secundario"
      title={estado === 'falhou' ? texto : undefined}
      onClick={async () => {
        definirEstado((await copiar(texto)) ? 'feito' : 'falhou')
        setTimeout(() => definirEstado('parado'), 2200)
      }}
    >
      <Icone nome="copiar" /> {estado === 'feito' ? 'Copiado!' : estado === 'falhou' ? 'Não copiou' : rotulo}
    </button>
  )
}

/**
 * A capa de um produto, ou o ícone da caixa se ela não carregar. Uma imagem
 * partida no painel lê-se como defeito, mesmo quando é só uma capa que ainda
 * não foi enviada.
 */
export function Capa({ src, tamanho }: { src: string | null; tamanho?: number }) {
  const [falhou, definirFalhou] = useState(false)
  const estilo = tamanho ? { width: tamanho, height: tamanho } : undefined
  if (!src || falhou) {
    return (
      <span className="vd-produto-sem-capa" style={estilo} aria-hidden="true">
        <Icone nome="caixa" />
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={estilo} onError={() => definirFalhou(true)} />
}

// ── Ícones: traços simples, na cor do texto ───────────────────────────

export type NomeDoIcone =
  | 'carrinho'
  | 'pessoa'
  | 'pessoas'
  | 'caixa'
  | 'dinheiro'
  | 'grafico'
  | 'engrenagem'
  | 'moedas'
  | 'carteira'
  | 'calendario'
  | 'abaixo'
  | 'copiar'
  | 'exportar'
  | 'cursor'
  | 'relogio'
  | 'seta'
  | 'voltar'
  | 'recibo'
  | 'percentagem'
  | 'buscar'
  | 'check'
  | 'bloquear'
  | 'link'

const TRACOS: Record<NomeDoIcone, ReactNode> = {
  carrinho: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.5-6.8H6.2" />
    </>
  ),
  pessoa: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.9-3.6 3.4-5.5 6.5-5.5s5.6 1.9 6.5 5.5" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M16.5 14.6c2.5.2 4.3 1.9 5 4.9" />
    </>
  ),
  caixa: (
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>
  ),
  dinheiro: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 8.8c-.6-.9-1.7-1.3-3-1.3-1.8 0-3 .9-3 2.2 0 3.3 6 1.7 6 5 0 1.3-1.3 2.3-3.1 2.3-1.4 0-2.6-.5-3.2-1.5M12 5.5v13" />
    </>
  ),
  grafico: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  moedas: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 10v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4M5 14v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4" />
    </>
  ),
  carteira: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M16 13.5h2" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  abaixo: <path d="m6 9 6 6 6-6" />,
  copiar: (
    <>
      <rect x="8" y="8" width="12.5" height="12.5" rx="2.5" />
      <path d="M16 8V5.5A2 2 0 0 0 14 3.5H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8" />
    </>
  ),
  exportar: <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />,
  cursor: <path d="m5 3 14 7.5-6.2 1.7L10.5 19z" />,
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  voltar: <path d="M19 12H5M11 6l-6 6 6 6" />,
  recibo: (
    <>
      <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21 6 19.4z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  percentagem: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  bloquear: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </>
  ),
}

export function Icone({ nome, tamanho = 20 }: { nome: NomeDoIcone; tamanho?: number }) {
  return (
    <svg
      className="vd-icone"
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRACOS[nome]}
    </svg>
  )
}
