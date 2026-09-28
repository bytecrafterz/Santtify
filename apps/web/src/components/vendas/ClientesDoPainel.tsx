'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErroDeApi } from '@/lib/auth'
import { dataCurta, dataEHora, reais } from '@/lib/dinheiro'
import { NOME_DO_MEIO, vendas, type DetalheDoCliente } from '@/lib/vendas'
import {
  CabecalhoDaPagina,
  Carregando,
  Gaveta,
  Icone,
  Paginacao,
  Rosto,
  SeloDoPedido,
  Vazio,
  useAtrasado,
  useDados,
} from './comum'
import { DetalheDoPedidoNaGaveta } from './PedidosDoPainel'

/**
 * CLIENTES — quem comprou, uma linha por pessoa.
 *
 * Uma pessoa é a conta, quando comprou com sessão; senão, o e-mail com que
 * pagou. Não depende do período: um cliente é cliente desde a primeira compra.
 */
export function ClientesDoPainel({ projectSlug }: { projectSlug: string }) {
  const [busca, definirBusca] = useState('')
  const [pagina, definirPagina] = useState(1)
  const [aberto, definirAberto] = useState<string | null>(null)
  const [pedido, definirPedido] = useState<string | null>(null)
  const buscaAtrasada = useAtrasado(busca)
  const lista = useDados(() => vendas.clientes({ busca: buscaAtrasada, pagina }), [buscaAtrasada, pagina])
  useEffect(() => definirPagina(1), [buscaAtrasada])

  return (
    <>
      <CabecalhoDaPagina titulo="Clientes" subtitulo="Quem já comprou, e quanto." />
      <div className="vd-cartao">
        <div className="vd-filtros">
          <label className="vd-busca">
            <Icone nome="buscar" />
            <input type="search" placeholder="Buscar por nome ou e-mail..." value={busca} onChange={(e) => definirBusca(e.target.value)} />
          </label>
        </div>
        {lista.erro && <p className="erro">{lista.erro}</p>}
        {!lista.dados && lista.aCarregar && <Carregando />}
        {lista.dados && lista.dados.clientes.length === 0 && <Vazio>{buscaAtrasada ? 'Ninguém com esse nome ou e-mail.' : 'Ainda não há compras pagas.'}</Vazio>}
        {lista.dados && lista.dados.clientes.length > 0 && (
          <div className={`vd-tabela-caixa ${lista.aCarregar ? 'a-carregar' : ''}`}>
            <table className="vd-tabela">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="num">Pedidos</th>
                  <th className="num">Total gasto</th>
                  <th>Primeira compra</th>
                  <th>Última compra</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {lista.dados.clientes.map((c) => (
                  <tr key={c.chave} onClick={() => definirAberto(c.chave)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && definirAberto(c.chave)}>
                    <td data-rotulo="Cliente">
                      <div className="vd-pessoa">
                        <Rosto nome={c.nome ?? c.email} avatarUrl={c.avatarUrl} />
                        <div>
                          <strong>
                            {c.nome ?? 'Sem conta'}
                            {c.eAfiliado && <span className="vd-selo a-ativo pequeno">afiliado</span>}
                          </strong>
                          <small>{c.email ?? '—'}</small>
                        </div>
                      </div>
                    </td>
                    <td className="num" data-rotulo="Pedidos">
                      {c.pedidos}
                    </td>
                    <td className="num" data-rotulo="Total gasto">
                      <strong>{reais(c.gastoCent)}</strong>
                    </td>
                    <td data-rotulo="Primeira compra">{dataCurta(c.primeira)}</td>
                    <td data-rotulo="Última compra">{dataCurta(c.ultima)}</td>
                    <td data-rotulo="Origem">
                      {c.viaAfiliado > 0 ? `${c.viaAfiliado} por afiliado` : <span className="vd-direto">Direto</span>}
                      {!c.temConta && <small>sem conta</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lista.dados && (
          <Paginacao pagina={lista.dados.pagina} total={lista.dados.total} porPagina={lista.dados.porPagina} aoMudar={definirPagina} coisa="clientes" />
        )}
        {lista.dados && lista.dados.semIdentificacao > 0 && (
          <p className="vd-nota">
            {lista.dados.semIdentificacao === 1
              ? '1 compra antiga sem conta ficou de fora: foi paga antes de o sistema guardar o e-mail de quem comprou.'
              : `${lista.dados.semIdentificacao} compras antigas sem conta ficaram de fora: foram pagas antes de o sistema guardar o e-mail de quem comprou.`}
          </p>
        )}
      </div>

      <DetalheDoCliente chave={aberto} projectSlug={projectSlug} aoFechar={() => definirAberto(null)} aoAbrirPedido={definirPedido} />
      <DetalheDoPedidoNaGaveta id={pedido} projectSlug={projectSlug} aoFechar={() => definirPedido(null)} aoMudar={lista.recarregar} />
    </>
  )
}

function DetalheDoCliente({
  chave,
  projectSlug,
  aoFechar,
  aoAbrirPedido,
}: {
  chave: string | null
  projectSlug: string
  aoFechar: () => void
  aoAbrirPedido: (id: string) => void
}) {
  const [c, definirC] = useState<DetalheDoCliente | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    definirC(null)
    definirErro(null)
    if (!chave) return
    vendas
      .cliente(chave)
      .then(definirC)
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível abrir o cliente.'))
  }, [chave])

  return (
    <Gaveta titulo="Cliente" aberta={chave !== null} aoFechar={aoFechar}>
      {erro && <p className="erro">{erro}</p>}
      {!c && !erro && <Carregando />}
      {c && (
        <>
          <div className="vd-pessoa grande">
            <Rosto nome={c.nome ?? c.email} avatarUrl={c.avatarUrl} tamanho={56} />
            <div>
              <strong>{c.nome ?? 'Compra sem conta'}</strong>
              <small>{c.email ?? '—'}</small>
              {c.username && <small>@{c.username}</small>}
              {c.temConta && (
                <Link className="vd-link" href={`/${projectSlug}/pessoa/${c.chave}`}>
                  Ver perfil
                </Link>
              )}
            </div>
          </div>
          <div className="vd-mini-kpis dois">
            <div className="verde">
              <Icone nome="dinheiro" />
              <strong>{reais(c.gastoCent)}</strong>
              <span>Total gasto</span>
            </div>
            <div className="azul">
              <Icone nome="carrinho" />
              <strong>{c.pedidos.length}</strong>
              <span>Pedidos</span>
            </div>
          </div>
          {c.afiliado && (
            <p className="vd-linha-simples">
              <span>Também é afiliado</span>
              <strong>@{c.afiliado.codigo}</strong>
            </p>
          )}
          <section className="vd-secao">
            <h3>Pedidos</h3>
            <ul className="vd-historico-lista">
              {c.pedidos.map((p) => (
                <li key={p.id} className="clicavel" onClick={() => aoAbrirPedido(p.id)}>
                  <div>
                    <strong>
                      #{p.numero} · {reais(p.totalCent)}
                    </strong>
                    <small>
                      {p.categoria ?? 'Cartões'} · {p.conjuntos} conjunto{p.conjuntos === 1 ? '' : 's'} · {p.meio ? NOME_DO_MEIO[p.meio] : '—'}
                    </small>
                    <small>
                      {dataEHora(p.pagoEm ?? p.criadoEm)}
                      {p.afiliado ? ` · por ${p.afiliado}` : ''}
                    </small>
                  </div>
                  <SeloDoPedido status={p.status} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Gaveta>
  )
}
