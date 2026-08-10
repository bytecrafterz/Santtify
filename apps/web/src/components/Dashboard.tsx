'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'
import { useAuth } from '@/components/ProvedorDeAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

interface VisaoGeral {
  project: { name: string; slug: string }
  periodoDias: number
  totais: {
    visitantes: number
    cadastros: number
    conversao: number
    curtidas: number
    comentarios: number
    compartilhamentos: number
    cliquesEmPartilha: number
  }
  porDia: Array<{ dia: string; visitantes: number; cadastros: number }>
  origemVisitantes: Array<{ plataforma: string; visitantes: number }>
  origemCadastros: Array<{ plataforma: string; cadastros: number }>
  propagacao: {
    diretos: number
    porPartilha: number
    cadastrosPorPartilha: number
    percentualPorPartilha: number
    usuariosPorUsuario: number
  }
  conteudos: Array<{ titulo: string; slug: string; visualizacoes: number; visitantes: number }>
  diaZero: Array<{ platform: string; followers: number | null }>
}

async function buscar(projectSlug: string, dias: number, jaRenovou = false): Promise<VisaoGeral> {
  const res = await fetch(`${API_URL}/admin/analytics/${projectSlug}?dias=${dias}`, {
    credentials: 'include',
    headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
  })
  if (res.status === 401 && !jaRenovou && (await renovarSessao())) {
    return buscar(projectSlug, dias, true)
  }
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) throw new ErroDeApi(res.status, corpo?.message ?? 'Não foi possível carregar')
  // O Postgres devolve contagens como bigint; viram string no JSON.
  return corpo as VisaoGeral
}

const n = (v: unknown) => Number(v ?? 0)

/**
 * Painel de métricas essenciais.
 *
 * Deliberadamente sem biblioteca de gráficos: a curva é desenhada com barras
 * em CSS. Para os números desta fase isso é suficiente, carrega instantâneo no
 * celular e não adiciona 100 KB de JavaScript a um app que crianças abrem em
 * rede ruim. Quando os cruzamentos da Fase 2 chegarem, aí sim vale um gráfico
 * de verdade.
 */
export function Dashboard({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [dias, definirDias] = useState(30)
  const [dados, definirDados] = useState<VisaoGeral | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario) return router.replace(`/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
    if (usuario.role !== 'ADMIN') return definirErro('Esta área é restrita ao administrador.')
    buscar(projectSlug, dias).then(definirDados).catch((e) => definirErro(e.message))
  }, [usuario, carregando, projectSlug, dias, router])

  if (erro) return <p className="erro">{erro}</p>
  if (!dados) return <p className="vazio">Carregando...</p>

  const t = dados.totais
  const p = dados.propagacao
  const maxDia = Math.max(1, ...dados.porDia.map((d) => n(d.visitantes)))

  return (
    <>
      <div className="cabecalho">
        <Link href={`/${projectSlug}/admin`}>← Painel</Link>
        <select value={dias} onChange={(e) => definirDias(Number(e.target.value))}>
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
        </select>
      </div>

      <h1>Métricas</h1>
      <p className="subtitulo">{dados.project.name}</p>

      <div className="numeros">
        <Cartao valor={n(t.visitantes)} rotulo="Visitantes" />
        <Cartao valor={n(t.cadastros)} rotulo="Cadastros" />
        <Cartao valor={`${t.conversao}%`} rotulo="Conversão" />
        <Cartao valor={n(t.compartilhamentos)} rotulo="Compartilhamentos" />
      </div>

      <h2>Crescimento</h2>
      {dados.porDia.length === 0 ? (
        <p className="bloco-vazio">Ainda sem visitas no período.</p>
      ) : (
        <div className="bloco grafico">
          {dados.porDia.map((d) => (
            <div className="coluna" key={String(d.dia)} title={`${d.dia}: ${n(d.visitantes)} visitantes, ${n(d.cadastros)} cadastros`}>
              <div className="barra" style={{ height: `${(n(d.visitantes) / maxDia) * 100}%` }}>
                <div className="parte-cadastro" style={{ height: `${(n(d.cadastros) / Math.max(1, n(d.visitantes))) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="legenda">
        <span className="ponto visitante" /> visitantes
        <span className="ponto cadastro" /> cadastros
      </p>

      <h2>De onde vieram</h2>
      <p className="nota">
        Contado pela origem que iniciou a cadeia. Quem chegou por um
        compartilhamento de WhatsApp vindo do Instagram conta para o Instagram — foi
        ele que trouxe a pessoa para dentro.
      </p>
      <Barras
        itens={dados.origemVisitantes.map((o) => ({ nome: o.plataforma, valor: n(o.visitantes) }))}
        vazio="Nenhum visitante ainda."
      />

      <h2>Origem dos cadastros</h2>
      <Barras
        itens={dados.origemCadastros.map((o) => ({ nome: o.plataforma, valor: n(o.cadastros) }))}
        vazio="Nenhum cadastro ainda."
      />

      <h2>Propagação do Produto Vivo</h2>
      <div className="numeros">
        <Cartao valor={n(p.diretos)} rotulo="Vieram das redes" />
        <Cartao valor={n(p.porPartilha)} rotulo="Vieram de partilha" />
        <Cartao valor={`${p.percentualPorPartilha}%`} rotulo="Do crescimento" />
        <Cartao valor={p.usuariosPorUsuario} rotulo="Cada um trouxe" />
      </div>

      <h2>Conteúdos mais acessados</h2>
      {dados.conteudos.length === 0 ? (
        <p className="bloco-vazio">Ainda sem visualizações.</p>
      ) : (
        <ul className="lista">
          {dados.conteudos.map((c) => (
            <li className="bloco linha" key={c.slug}>
              <span>{c.titulo}</span>
              <small>
                {n(c.visualizacoes)} visualizações · {n(c.visitantes)} pessoas
              </small>
            </li>
          ))}
        </ul>
      )}

      <h2>Dia Zero</h2>
      <p className="nota">
        A linha de base do lançamento. É contra ela que o crescimento é medido.
      </p>
      <ul className="lista">
        {dados.diaZero.map((d) => (
          <li className="bloco linha" key={d.platform}>
            <span>{d.platform}</span>
            <small>{n(d.followers)} no lançamento</small>
          </li>
        ))}
      </ul>
    </>
  )
}

function Cartao({ valor, rotulo }: { valor: number | string; rotulo: string }) {
  return (
    <div className="numero">
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  )
}

function Barras({ itens, vazio }: { itens: Array<{ nome: string; valor: number }>; vazio: string }) {
  if (itens.length === 0) return <p className="bloco-vazio">{vazio}</p>
  const max = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <ul className="barras">
      {itens.map((i) => (
        <li key={i.nome}>
          <span className="rotulo">{i.nome}</span>
          <span className="trilho">
            <span className="preenchimento" style={{ width: `${(i.valor / max) * 100}%` }} />
          </span>
          <strong>{i.valor}</strong>
        </li>
      ))}
    </ul>
  )
}
