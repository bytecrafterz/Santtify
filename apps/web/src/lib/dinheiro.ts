/**
 * Dinheiro, percentagens e datas como o painel de vendas e a área de afiliado
 * os mostram. Os valores chegam em cêntimos inteiros; a vírgula e o "R$" são
 * só de quem lê.
 */

export function reais(cent: number | null | undefined, moeda = 'BRL'): string {
  return ((cent ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: moeda })
}

/** 4000 pontos-base → "40%"; 3750 → "37,5%". */
export function percentagem(bp: number): string {
  return `${(bp / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

/** Uma fracção como percentagem: 0.035 → "3,5%". */
export function fraccao(f: number | null | undefined, casas = 1): string {
  if (f == null || !Number.isFinite(f)) return '—'
  return `${(f * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`
}

/** A variação do "vs. período anterior": "+12%", "−5%", ou nada sem base. */
export function variacaoEmTexto(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null
  const pct = Math.round(v * 100)
  if (pct === 0) return '0%'
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function dataEHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** "22/09 · 21:45" — para as linhas estreitas do telemóvel. */
export function diaEHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** "2026-09-28" do fuso de quem está a ver. */
export function hojeLocal(deslocDias = 0): string {
  const d = new Date(Date.now() + deslocDias * 86_400_000)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
