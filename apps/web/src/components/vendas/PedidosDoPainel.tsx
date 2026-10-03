'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErroDeApi } from '@/lib/auth'
import { dataEHora, percentagem, reais } from '@/lib/dinheiro'
import { NOME_DO_MEIO, NOME_DO_STATUS, vendas, type AbaDePedidos, type DetalheDoPedido } from '@/lib/vendas'
import {
  CabecalhoDaPagina,
  Capa,
  Carregando,
  CartaoKpi,
  Gaveta,
  Icone,
  Paginacao,
  Rosto,
  SeletorDePeriodo,
  SeloDaComissao,
  SeloDoPedido,
  Vazio,
  useAtrasado,
  useDados,
  usePeriodo,
} from './comum'

const ABAS: Array<{ id: AbaDePedidos | null; rotulo: string }> = [
  { id: null, rotulo: 'Todos' },
  { id: 'AGUARDANDO', rotulo: 'Aguardando' },
  { id: 'EM_PRODUCAO', rotulo: 'Em produção' },
  { id: 'CONCLUIDO', rotulo: 'Concluídos' },
  { id: 'CANCELADO', rotulo: 'Cancelados' },
]

/**
 * PEDIDOS — o painel do mockup de 25/09.
 *
 * "No topo aparecem quatro números principais: total de pedidos, faturamento
 * bruto, total de comissões dos afiliados e quanto fica líquido para você. No
 * centro fica a parte mais importante: a lista dos pedidos." Tudo entra
 * sozinho à medida que as compras acontecem; nada aqui se faz pedido a pedido.
 */
export function PedidosDoPainel({ projectSlug }: { projectSlug: string }) {
  const { de, ate } = usePeriodo()
  const [aba, definirAba] = useState<AbaDePedidos | null>(null)
  const [busca, definirBusca] = useState('')
  const [meio, definirMeio] = useState('')
  const [origem, definirOrigem] = useState('')
  const [categoria, definirCategoria] = useState('')
  const [pagina, definirPagina] = useState(1)
  const [aberto, definirAberto] = useState<string | null>(null)
  const [aExportar, definirAExportar] = useState(false)
  const buscaAtrasada = useAtrasado(busca)

  const filtros = { de, ate, status: aba, meio, origem, categoria, busca: buscaAtrasada, pagina }
  const resumo = useDados(() => vendas.resumo({ de, ate }), [de, ate])
  const lista = useDados(() => vendas.pedidos(filtros), [de, ate, aba, meio, origem, categoria, buscaAtrasada, pagina])
  const opcoes = useDados(() => vendas.filtros(), [])

  // Um filtro novo volta à primeira página.
  useEffect(() => definirPagina(1), [de, ate, aba, meio, origem, categoria, buscaAtrasada])

  const r = resumo.dados
  return (
    <>
      <CabecalhoDaPagina titulo="Pedidos" subtitulo="Gerencie todos os pedidos da sua plataforma.">
        <SeletorDePeriodo />
        <button
          type="button"
          className="vd-botao primario"
          disabled={aExportar}
          onClick={async () => {
            definirAExportar(true)
            try {
              await vendas.exportarPedidos({ ...filtros, pagina: null })
            } finally {
              definirAExportar(false)
            }
          }}
        >
          <Icone nome="exportar" /> {aExportar ? 'Exportando...' : 'Exportar'}
        </button>
      </CabecalhoDaPagina>

      {resumo.erro && <p className="erro">{resumo.erro}</p>}
      <div className="vd-kpis">
        <CartaoKpi
          icone="carrinho"
          cor="azul"
          valor={r ? r.pedidos.toLocaleString('pt-BR') : '—'}
          rotulo="Total de pedidos pagos"
          variacao={r ? r.variacao.pedidos : undefined}
        />
        <CartaoKpi
          icone="dinheiro"
          cor="verde"
          valor={r ? reais(r.brutoCent) : '—'}
          rotulo="Faturamento bruto"
          variacao={r ? r.variacao.brutoCent : undefined}
        />
        <CartaoKpi
          icone="moedas"
          cor="ambar"
          valor={r ? reais(r.comissoesCent) : '—'}
          rotulo="Comissões de afiliados"
          variacao={r ? r.variacao.comissoesCent : undefined}
        />
        <CartaoKpi
          icone="carteira"
          cor="roxo"
          valor={r ? reais(r.liquidoCent) : '—'}
          rotulo="Seu líquido"
          variacao={r ? r.variacao.liquidoCent : undefined}
          nota={
            r && (r.taxasCent > 0 || r.reembolsosCent > 0)
              ? `já sem ${[r.taxasCent ? `taxas ${reais(r.taxasCent)}` : '', r.reembolsosCent ? `reembolsos ${reais(r.reembolsosCent)}` : '']
                  .filter(Boolean)
                  .join(' e ')}`
              : undefined
          }
        />
      </div>

      <div className="vd-cartao">
        <div className="vd-abas" role="tablist">
          {ABAS.map((a) => {
            const n = lista.dados ? (a.id ? lista.dados.abas[a.id] : lista.dados.abas.todos) : null
            return (
              <button
                key={a.rotulo}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                className={aba === a.id ? 'actual' : ''}
                onClick={() => definirAba(a.id)}
              >
                {a.rotulo}
                {n !== null && <span>({n.toLocaleString('pt-BR')})</span>}
              </button>
            )
          })}
        </div>

        <div className="vd-filtros">
          <label className="vd-busca">
            <Icone nome="buscar" />
            <input
              type="search"
              placeholder="Buscar por pedido, cliente ou e-mail..."
              value={busca}
              onChange={(e) => definirBusca(e.target.value)}
            />
          </label>
          <select value={categoria} onChange={(e) => definirCategoria(e.target.value)} aria-label="Produto">
            <option value="">Todos os produtos</option>
            {opcoes.dados?.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.projeto}
              </option>
            ))}
          </select>
          <select value={meio} onChange={(e) => definirMeio(e.target.value)} aria-label="Pagamento">
            <option value="">Todos os pagamentos</option>
            <option value="PIX">Pix</option>
            <option value="CARTAO">Cartão</option>
          </select>
          <select value={origem} onChange={(e) => definirOrigem(e.target.value)} aria-label="Afiliado">
            <option value="">Todos os afiliados</option>
            <option value="afiliado">Só vendas de afiliados</option>
            <option value="direto">Só vendas diretas</option>
          </select>
        </div>

        {lista.erro && <p className="erro">{lista.erro}</p>}
        {!lista.dados && lista.aCarregar && <Carregando />}
        {lista.dados && lista.dados.pedidos.length === 0 && (
          <Vazio>Nenhum pedido neste período{aba || buscaAtrasada || meio || origem || categoria ? ' com estes filtros' : ''}.</Vazio>
        )}
        {lista.dados && lista.dados.pedidos.length > 0 && (
          <div className={`vd-tabela-caixa ${lista.aCarregar ? 'a-carregar' : ''}`}>
            <table className="vd-tabela">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Produto</th>
                  <th>Valor</th>
                  <th>Pagamento</th>
                  <th>Afiliado</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {lista.dados.pedidos.map((p) => (
                  <tr key={p.id} onClick={() => definirAberto(p.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && definirAberto(p.id)}>
                    <td className="vd-numero" data-rotulo="Pedido">
                      #{p.numero}
                    </td>
                    <td data-rotulo="Cliente">
                      <div className="vd-pessoa">
                        <Rosto nome={p.cliente.nome ?? p.cliente.email} avatarUrl={p.cliente.avatarUrl} />
                        <div>
                          <strong>{p.cliente.nome ?? 'Sem conta'}</strong>
                          <small>{p.cliente.email ?? '—'}</small>
                        </div>
                      </div>
                    </td>
                    <td data-rotulo="Produto">
                      <strong>{p.produto.categoria ?? 'Cartões'}</strong>
                      <small>
                        {p.produto.conjuntos} {p.produto.conjuntos === 1 ? p.produto.rotuloSingular ?? 'conjunto' : p.produto.rotuloPlural ?? 'conjuntos'}
                      </small>
                    </td>
                    <td data-rotulo="Valor" className="vd-valor">
                      {reais(p.totalCent, p.moeda)}
                    </td>
                    <td data-rotulo="Pagamento">
                      <strong>{p.meio ? NOME_DO_MEIO[p.meio] : '—'}</strong>
                      <small className={p.pagoEm ? 'vd-ok' : ''}>{p.pagoEm ? 'Aprovado' : 'Pendente'}</small>
                    </td>
                    <td data-rotulo="Afiliado">
                      {p.afiliado ? (
                        <>
                          <strong>{p.afiliado.nome}</strong>
                          <small>
                            {p.afiliado.comissaoBp != null && p.afiliado.comissaoCent != null
                              ? `${percentagem(p.afiliado.comissaoBp)} (${reais(p.afiliado.comissaoCent)})`
                              : p.pagoEm
                                ? 'sem comissão'
                                : 'comissão ao pagar'}
                          </small>
                        </>
                      ) : (
                        <span className="vd-direto">Direto</span>
                      )}
                    </td>
                    <td data-rotulo="Status">
                      <SeloDoPedido status={p.status} parcial={p.reembolsoParcial} />
                    </td>
                    <td data-rotulo="Data" className="vd-data">
                      {dataEHora(p.criadoEm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lista.dados && (
          <Paginacao
            pagina={lista.dados.pagina}
            total={lista.dados.total}
            porPagina={lista.dados.porPagina}
            aoMudar={definirPagina}
            coisa="pedidos"
          />
        )}
      </div>

      <DetalheDoPedidoNaGaveta
        id={aberto}
        projectSlug={projectSlug}
        aoFechar={() => definirAberto(null)}
        aoMudar={() => {
          lista.recarregar()
          resumo.recarregar()
        }}
      />
    </>
  )
}

/** A coluna da direita do mockup: só este pedido, e o que ele valeu. */
export function DetalheDoPedidoNaGaveta({
  id,
  projectSlug,
  aoFechar,
  aoMudar,
}: {
  id: string | null
  projectSlug: string
  aoFechar: () => void
  aoMudar?: () => void
}) {
  const [pedido, definirPedido] = useState<DetalheDoPedido | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aAgir, definirAAgir] = useState(false)

  const carregar = (alvo: string) =>
    vendas
      .pedido(alvo)
      .then((p) => {
        definirPedido(p)
        definirErro(null)
      })
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível abrir o pedido.'))

  useEffect(() => {
    definirPedido(null)
    definirErro(null)
    if (id) void carregar(id)
  }, [id])

  const p = pedido
  const v = p?.valores
  const taxaPct = v && v.totalCent ? (v.taxaCent / v.totalCent) * 100 : 0

  async function reembolsar() {
    if (!p || !v) return
    const resposta = window.prompt(
      `Quanto foi devolvido ao cliente NO TOTAL (em reais)?\n\nDeixe ${(v.totalCent / 100).toFixed(2).replace('.', ',')} para o reembolso completo. ` +
        'Use isto só para um reembolso que o Mercado Pago não avisou — os reembolsos feitos lá entram sozinhos.',
      (v.totalCent / 100).toFixed(2).replace('.', ','),
    )
    if (resposta === null) return
    const valor = Math.round(Number(resposta.replace(/\./g, '').replace(',', '.')) * 100)
    if (!Number.isFinite(valor) || valor <= 0) {
      window.alert('Escreva um valor em reais, por exemplo 49,00.')
      return
    }
    definirAAgir(true)
    try {
      await vendas.reembolsar(p.id, Math.min(valor, v.totalCent), 'Registrado no painel de vendas')
      await carregar(p.id)
      aoMudar?.()
    } catch (e) {
      window.alert(e instanceof ErroDeApi ? e.message : 'Não foi possível registrar o reembolso.')
    } finally {
      definirAAgir(false)
    }
  }

  async function confirmar() {
    if (!p) return
    if (
      !window.confirm(
        'Confirmar manualmente que este pagamento foi recebido?\n\nSó para quando o dinheiro entrou e o aviso do Mercado Pago não chegou. ' +
          'Os cartões ficam disponíveis e a comissão do afiliado é registada.',
      )
    ) {
      return
    }
    definirAAgir(true)
    try {
      await vendas.confirmarPagamento(p.id)
      await carregar(p.id)
      aoMudar?.()
    } catch (e) {
      window.alert(e instanceof ErroDeApi ? e.message : 'Não foi possível confirmar.')
    } finally {
      definirAAgir(false)
    }
  }

  return (
    <Gaveta titulo={p ? `Detalhes do pedido #${p.numero}` : 'Detalhes do pedido'} aberta={id !== null} aoFechar={aoFechar}>
      {erro && <p className="erro">{erro}</p>}
      {!p && !erro && <Carregando />}
      {p && v && (
        <>
          <div className={`vd-estado-do-pedido s-${p.status.toLowerCase()}`}>
            <strong>{NOME_DO_STATUS[p.status]}</strong>
            <span>
              {p.status === 'CONCLUIDO' &&
                (p.arquivosExpirados
                  ? 'Entregue — o prazo para gerar de novo terminou'
                  : 'Entregue — o PDF foi gerado no aparelho do cliente')}
              {p.status === 'EM_PRODUCAO' && 'Pago — aguardando o cliente gerar o PDF no aparelho'}
              {p.status === 'AGUARDANDO' && 'Aguardando o pagamento'}
              {p.status === 'CANCELADO' && 'O pagamento não foi concluído'}
              {p.status === 'REEMBOLSADO' && 'O valor foi devolvido ao cliente'}
            </span>
            <small>{dataEHora(p.reembolsadoEm ?? p.prontoEm ?? p.pagoEm ?? p.criadoEm)}</small>
          </div>

          <section className="vd-secao">
            <h3>Cliente</h3>
            <div className="vd-pessoa grande">
              <Rosto nome={p.cliente.nome ?? p.cliente.email} avatarUrl={p.cliente.avatarUrl} tamanho={48} />
              <div>
                <strong>{p.cliente.nome ?? 'Compra sem conta'}</strong>
                <small>{p.cliente.email ?? 'e-mail não registrado'}</small>
                {p.cliente.userId && (
                  <Link href={`/${projectSlug}/pessoa/${p.cliente.userId}`} className="vd-link">
                    Ver perfil
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section className="vd-secao">
            <h3>Produto</h3>
            <div className="vd-produto">
              <Capa src={p.produto.capaUrl} />
              <div>
                <strong>{p.produto.categoria ?? 'Cartões personalizados'}</strong>
                <small>{p.produto.projeto}</small>
                <small>
                  {p.produto.conjuntos} {p.produto.conjuntos === 1 ? p.produto.rotuloSingular : p.produto.rotuloPlural}
                  {p.produto.nomes.length > 0 && `: ${p.produto.nomes.join(', ')}`}
                </small>
              </div>
              <strong className="vd-valor">{reais(v.totalCent, v.moeda)}</strong>
            </div>
          </section>

          <section className="vd-secao">
            <h3>Pagamento</h3>
            <p className="vd-linha-simples">
              <strong>{p.pagamento.meio ? NOME_DO_MEIO[p.pagamento.meio] : '—'}</strong>
              <span className={p.pagoEm ? 'vd-ok' : ''}>{p.pagoEm ? `Aprovado em ${dataEHora(p.pagoEm)}` : 'Ainda não pago'}</span>
            </p>
          </section>

          <section className="vd-secao">
            <h3>Afiliado</h3>
            {p.afiliado ? (
              <div className="vd-pessoa grande">
                <Rosto nome={p.afiliado.nome} avatarUrl={p.afiliado.avatarUrl} tamanho={48} />
                <div>
                  <strong>{p.afiliado.nome}</strong>
                  <small>
                    {p.afiliado.email} · @{p.afiliado.codigo}
                  </small>
                  {p.comissao ? (
                    <small>
                      Comissão: {percentagem(p.comissao.comissaoBp)} ({reais(p.comissao.valorCent - p.comissao.estornoCent)}) ·{' '}
                      <SeloDaComissao estado={p.comissao.estado} />
                    </small>
                  ) : (
                    <small>{p.pagoEm ? 'Sem comissão (autoindicação ou afiliado suspenso)' : 'A comissão nasce quando o pagamento for confirmado'}</small>
                  )}
                </div>
              </div>
            ) : (
              <p className="vd-direto">Venda direta — sem afiliado.</p>
            )}
          </section>

          <section className="vd-secao">
            <h3>Valores</h3>
            <dl className="vd-valores">
              <div>
                <dt>Valor do pedido</dt>
                <dd>{reais(v.totalCent, v.moeda)}</dd>
              </div>
              {v.descontoCent > 0 && (
                <div className="menor">
                  <dt>Desconto já aplicado</dt>
                  <dd>{reais(v.descontoCent, v.moeda)}</dd>
                </div>
              )}
              {p.pagoEm && (
                <>
                  <div className="menos">
                    <dt>
                      Taxa Mercado Pago ({taxaPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)
                      {v.taxaEstimada && <em> estimada</em>}
                    </dt>
                    <dd>− {reais(v.taxaCent, v.moeda)}</dd>
                  </div>
                  {v.reembolsadoCent > 0 && (
                    <div className="menos">
                      <dt>Reembolsado ao cliente</dt>
                      <dd>− {reais(v.reembolsadoCent, v.moeda)}</dd>
                    </div>
                  )}
                  <div className="forte">
                    <dt>Valor líquido</dt>
                    <dd>{reais(v.liquidoCent, v.moeda)}</dd>
                  </div>
                  {v.comissaoCent > 0 && (
                    <div className="menos">
                      <dt>Comissão do afiliado{p.comissao ? ` (${percentagem(p.comissao.comissaoBp)})` : ''}</dt>
                      <dd>− {reais(v.comissaoCent, v.moeda)}</dd>
                    </div>
                  )}
                  <div className="total">
                    <dt>Seu líquido</dt>
                    <dd>{reais(v.seuLiquidoCent, v.moeda)}</dd>
                  </div>
                </>
              )}
            </dl>
          </section>

          <div className="vd-acoes-da-gaveta">
            {p.status === 'AGUARDANDO' && (
              <button type="button" className="vd-botao secundario" disabled={aAgir} onClick={confirmar}>
                <Icone nome="check" /> Confirmar pagamento recebido
              </button>
            )}
            {p.pagoEm && v.reembolsadoCent < v.totalCent && (
              <button type="button" className="vd-botao perigo" disabled={aAgir} onClick={reembolsar}>
                Registrar reembolso
              </button>
            )}
          </div>

          {p.pagamento.eventos.length > 0 && (
            <details className="vd-historico">
              <summary>Histórico do pagamento ({p.pagamento.eventos.length})</summary>
              <ul>
                {p.pagamento.eventos.map((e, i) => (
                  <li key={i}>
                    <span>{dataEHora(e.recebidoEm)}</span>
                    <code>{e.tipo}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Gaveta>
  )
}
