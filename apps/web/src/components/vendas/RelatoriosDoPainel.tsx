'use client'

import { fraccao, reais } from '@/lib/dinheiro'
import { vendas, type Relatorios } from '@/lib/vendas'
import { CabecalhoDaPagina, Carregando, CartaoKpi, SeletorDePeriodo, Vazio, useDados, usePeriodo } from './comum'

interface Barra {
  rotulo: string
  titulo: string
  pedidos: number
  brutoCent: number
}

/**
 * Os dias do período em barras. Até dois meses, uma barra por dia; até pouco
 * mais de um ano, por semana; acima disso, por mês — 365 barras num
 * telemóvel são uma mancha, e ninguém lê uma mancha.
 */
function agrupar(serie: Relatorios['serie']): { barras: Barra[]; unidade: string } {
  const dia = (ymd: string) => ymd.split('-').reverse().slice(0, 2).join('/')
  if (serie.length <= 62) {
    return {
      unidade: 'dia',
      barras: serie.map((s) => ({ rotulo: dia(s.dia), titulo: dia(s.dia), pedidos: s.pedidos, brutoCent: s.brutoCent })),
    }
  }
  if (serie.length <= 400) {
    const barras: Barra[] = []
    for (let i = 0; i < serie.length; i += 7) {
      const semana = serie.slice(i, i + 7)
      barras.push({
        rotulo: dia(semana[0].dia),
        titulo: `${dia(semana[0].dia)} a ${dia(semana[semana.length - 1].dia)}`,
        pedidos: semana.reduce((t, s) => t + s.pedidos, 0),
        brutoCent: semana.reduce((t, s) => t + s.brutoCent, 0),
      })
    }
    return { unidade: 'semana', barras }
  }
  const meses = new Map<string, Barra>()
  for (const s of serie) {
    const chave = s.dia.slice(0, 7)
    const [a, m] = chave.split('-')
    const b = meses.get(chave) ?? { rotulo: `${m}/${a.slice(2)}`, titulo: `${m}/${a}`, pedidos: 0, brutoCent: 0 }
    b.pedidos += s.pedidos
    b.brutoCent += s.brutoCent
    meses.set(chave, b)
  }
  return { unidade: 'mês', barras: [...meses.values()] }
}

function Divisao({ itens }: { itens: Array<{ rotulo: string; valorCent: number; pedidos: number; cor: string }> }) {
  const total = itens.reduce((t, i) => t + i.valorCent, 0)
  if (total === 0) return <Vazio>Sem vendas no período.</Vazio>
  return (
    <div className="vd-divisao">
      <div className="vd-divisao-barra">
        {itens.map((i) =>
          i.valorCent > 0 ? <span key={i.rotulo} className={i.cor} style={{ width: `${(i.valorCent / total) * 100}%` }} /> : null,
        )}
      </div>
      <ul>
        {itens.map((i) => (
          <li key={i.rotulo}>
            <span className={`vd-ponto ${i.cor}`} aria-hidden="true" />
            <strong>{i.rotulo}</strong>
            <span>
              {reais(i.valorCent)} · {i.pedidos} {i.pedidos === 1 ? 'pedido' : 'pedidos'} · {fraccao(i.valorCent / total, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * RELATÓRIOS — o período inteiro de uma vez, e comparado com o anterior do
 * mesmo tamanho: por dia, por meio de pagamento, por origem, o funil do
 * checkout e os afiliados que mais venderam.
 */
export function RelatoriosDoPainel() {
  const { de, ate } = usePeriodo()
  const dados = useDados(() => vendas.relatorios({ de, ate }), [de, ate])
  const d = dados.dados

  const { barras, unidade } = d ? agrupar(d.serie) : { barras: [], unidade: 'dia' }
  const maximo = Math.max(1, ...barras.map((b) => b.brutoCent))
  const r = d?.resumo

  return (
    <>
      <CabecalhoDaPagina titulo="Relatórios" subtitulo="Como as vendas se comportaram no período.">
        <SeletorDePeriodo />
      </CabecalhoDaPagina>
      {dados.erro && <p className="erro">{dados.erro}</p>}
      {!d && dados.aCarregar && <Carregando />}
      {d && r && (
        <>
          <div className="vd-kpis">
            <CartaoKpi icone="carrinho" cor="azul" valor={r.pedidos.toLocaleString('pt-BR')} rotulo="Pedidos pagos" variacao={r.variacao.pedidos} />
            <CartaoKpi icone="dinheiro" cor="verde" valor={reais(r.brutoCent)} rotulo="Faturamento bruto" variacao={r.variacao.brutoCent} />
            <CartaoKpi icone="recibo" cor="cinza" valor={reais(r.ticketMedioCent)} rotulo="Ticket médio" nota={`${r.conjuntos} conjuntos vendidos`} />
            <CartaoKpi icone="carteira" cor="roxo" valor={reais(r.liquidoCent)} rotulo="Seu líquido" variacao={r.variacao.liquidoCent} />
          </div>

          <div className="vd-cartao">
            <h2 className="vd-titulo-cartao">Faturamento por {unidade}</h2>
            {barras.every((b) => b.brutoCent === 0) ? (
              <Vazio>Sem vendas pagas no período.</Vazio>
            ) : (
              <div className="vd-grafico" role="img" aria-label={`Faturamento por ${unidade}`}>
                <div className="vd-grafico-barras">
                  {barras.map((b, i) => (
                    <div key={i} className="vd-grafico-coluna" title={`${b.titulo}: ${reais(b.brutoCent)} · ${b.pedidos} pedido${b.pedidos === 1 ? '' : 's'}`}>
                      <span style={{ height: `${(b.brutoCent / maximo) * 100}%` }} className={b.brutoCent ? '' : 'zero'} />
                    </div>
                  ))}
                </div>
                <div className="vd-grafico-eixo">
                  <span>{barras[0]?.rotulo}</span>
                  {barras.length > 2 && <span>{barras[Math.floor(barras.length / 2)]?.rotulo}</span>}
                  <span>{barras[barras.length - 1]?.rotulo}</span>
                </div>
                <p className="vd-nota">Maior {unidade}: {reais(maximo)}</p>
              </div>
            )}
          </div>

          <div className="vd-duas-colunas">
            <div className="vd-cartao">
              <h2 className="vd-titulo-cartao">Por meio de pagamento</h2>
              <Divisao
                itens={[
                  { rotulo: 'Pix', cor: 'verde', ...valores(d.porMeio.find((m) => m.meio === 'PIX')) },
                  { rotulo: 'Cartão', cor: 'azul', ...valores(d.porMeio.find((m) => m.meio === 'CARTAO')) },
                ]}
              />
            </div>
            <div className="vd-cartao">
              <h2 className="vd-titulo-cartao">Por origem</h2>
              <Divisao
                itens={[
                  { rotulo: 'Afiliados', cor: 'ambar', ...valores(d.porOrigem.find((o) => o.origem === 'afiliado')) },
                  { rotulo: 'Direto', cor: 'cinza', ...valores(d.porOrigem.find((o) => o.origem === 'direto')) },
                ]}
              />
            </div>
          </div>

          <div className="vd-duas-colunas">
            <div className="vd-cartao">
              <h2 className="vd-titulo-cartao">Funil do checkout</h2>
              <ol className="vd-funil">
                <li>
                  <strong>{d.funil.criados.toLocaleString('pt-BR')}</strong>
                  <span>começaram a personalizar</span>
                </li>
                <li>
                  <strong>{d.funil.chegaramAoPagamento.toLocaleString('pt-BR')}</strong>
                  <span>chegaram ao pagamento · {fraccao(d.funil.criados ? d.funil.chegaramAoPagamento / d.funil.criados : null)}</span>
                </li>
                <li>
                  <strong>{d.funil.pagos.toLocaleString('pt-BR')}</strong>
                  <span>pagaram · {fraccao(d.funil.chegaramAoPagamento ? d.funil.pagos / d.funil.chegaramAoPagamento : null)} de quem chegou ao pagamento</span>
                </li>
              </ol>
            </div>
            <div className="vd-cartao">
              <h2 className="vd-titulo-cartao">Links de afiliados</h2>
              <ol className="vd-funil">
                <li>
                  <strong>{d.afiliados.cliques.toLocaleString('pt-BR')}</strong>
                  <span>cliques (uma pessoa por dia)</span>
                </li>
                <li>
                  <strong>{d.afiliados.vendas.toLocaleString('pt-BR')}</strong>
                  <span>vendas por afiliados · conversão {fraccao(d.afiliados.conversao)}</span>
                </li>
              </ol>
            </div>
          </div>

          <div className="vd-cartao">
            <h2 className="vd-titulo-cartao">Afiliados que mais venderam</h2>
            {d.topAfiliados.length === 0 ? (
              <Vazio>Nenhuma venda por afiliados no período.</Vazio>
            ) : (
              <div className="vd-tabela-caixa">
                <table className="vd-tabela">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Afiliado</th>
                      <th className="num">Vendas</th>
                      <th className="num">Faturamento</th>
                      <th className="num">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.topAfiliados.map((a, i) => (
                      <tr key={a.id}>
                        <td data-rotulo="#">{i + 1}</td>
                        <td data-rotulo="Afiliado">
                          <strong>{a.nome}</strong>
                          <small>@{a.codigo}</small>
                        </td>
                        <td className="num" data-rotulo="Vendas">
                          {a.vendas}
                        </td>
                        <td className="num" data-rotulo="Faturamento">
                          {reais(a.brutoCent)}
                        </td>
                        <td className="num" data-rotulo="Comissão">
                          {reais(a.comissaoCent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

function valores(x: { pedidos: number; brutoCent: number } | undefined) {
  return { valorCent: x?.brutoCent ?? 0, pedidos: x?.pedidos ?? 0 }
}
