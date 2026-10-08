'use client'

import { useState } from 'react'
import { dataEHora, reais } from '@/lib/dinheiro'
import { NOME_DA_CHAVE } from '@/lib/afiliados'
import { vendas } from '@/lib/vendas'
import {
  BotaoCopiar,
  CabecalhoDaPagina,
  Carregando,
  CartaoKpi,
  Icone,
  Rosto,
  SeletorDePeriodo,
  Vazio,
  useDados,
  usePeriodo,
} from './comum'
import { DetalheDoAfiliadoNaGaveta, pagarAfiliado } from './AfiliadosDoPainel'

/**
 * FINANCEIRO — o dinheiro do período e o controlo dos pagamentos aos
 * afiliados: quem tem saldo para receber agora, e o que já se pagou.
 *
 * O pagamento é feito pelo Pix, no banco do cliente; aqui regista-se que foi
 * feito, e o saldo do afiliado desce na hora.
 */
export function FinanceiroDoPainel() {
  const { de, ate } = usePeriodo()
  const dados = useDados(() => vendas.financeiro({ de, ate }), [de, ate])
  const [aExportar, definirAExportar] = useState(false)
  const [aPagar, definirAPagar] = useState<string | null>(null)
  const [aberto, definirAberto] = useState<string | null>(null)
  const f = dados.dados
  const r = f?.resumo

  return (
    <>
      <CabecalhoDaPagina titulo="Financeiro" subtitulo="Faturamento, taxas, comissões e pagamentos aos afiliados.">
        <SeletorDePeriodo />
        <button
          type="button"
          className="vd-botao secundario"
          disabled={aExportar}
          onClick={async () => {
            definirAExportar(true)
            try {
              await vendas.exportarPagamentos({ de, ate })
            } finally {
              definirAExportar(false)
            }
          }}
        >
          <Icone nome="exportar" /> Exportar pagamentos
        </button>
      </CabecalhoDaPagina>

      {dados.erro && <p className="erro">{dados.erro}</p>}
      {!f && dados.aCarregar && <Carregando />}
      {r && f && (
        <>
          <div className="vd-cartao vd-extrato">
            <h2>Resultado do período</h2>
            <dl className="vd-valores largo">
              <div>
                <dt>Faturamento bruto ({r.pedidos} {r.pedidos === 1 ? 'pedido' : 'pedidos'})</dt>
                <dd>{reais(r.brutoCent)}</dd>
              </div>
              <div className="menos">
                <dt>Reembolsos e contestações</dt>
                <dd>− {reais(r.reembolsosCent)}</dd>
              </div>
              <div className="menos">
                <dt>
                  Taxas do Mercado Pago <em>(estimadas quando o aviso não as diz)</em>
                </dt>
                <dd>− {reais(r.taxasCent)}</dd>
              </div>
              <div className="menos">
                <dt>Comissões de afiliados</dt>
                <dd>− {reais(r.comissoesCent)}</dd>
              </div>
              <div className="total">
                <dt>Seu líquido</dt>
                <dd>{reais(r.liquidoCent)}</dd>
              </div>
            </dl>
          </div>

          <div className="vd-kpis">
            <CartaoKpi icone="relogio" cor="ambar" valor={reais(f.comissoes.pendenteCent)} rotulo="Comissões pendentes" nota="ainda no prazo de carência" />
            <CartaoKpi
              icone="carteira"
              cor="roxo"
              valor={reais(f.comissoes.aPagarCent)}
              rotulo="A pagar agora"
              nota={`${f.comissoes.afiliadosAPagar} afiliado${f.comissoes.afiliadosAPagar === 1 ? '' : 's'}${f.comissoes.aDescontarCent > 0 ? ` · ${reais(f.comissoes.aDescontarCent)} a descontar` : ''}`}
            />
            <CartaoKpi
              icone="check"
              cor="verde"
              valor={reais(f.comissoes.pagoNoPeriodoCent)}
              rotulo="Pago no período"
              nota={`${f.comissoes.pagamentosNoPeriodo} pagamento${f.comissoes.pagamentosNoPeriodo === 1 ? '' : 's'}`}
            />
          </div>

          {f.comissoes.acimaDoMinimo > 0 && (
            <p className="vd-lembrete">
              <Icone nome="moedas" /> {f.comissoes.acimaDoMinimo} afiliado{f.comissoes.acimaDoMinimo === 1 ? ' tem' : 's têm'} pelo menos{' '}
              {reais(f.comissoes.minimoParaPagamentoCent)} para receber. Pague pelo Pix e marque como pago abaixo.
            </p>
          )}

          <div className="vd-cartao">
            <h2 className="vd-titulo-cartao">A pagar agora</h2>
            {f.aPagar.length === 0 ? (
              <Vazio>Nenhum afiliado com saldo disponível.</Vazio>
            ) : (
              <div className="vd-tabela-caixa">
                <table className="vd-tabela">
                  <thead>
                    <tr>
                      <th>Afiliado</th>
                      <th>Chave Pix</th>
                      <th className="num">A pagar</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {f.aPagar.map((a) => (
                      <tr key={a.id} className={a.acimaDoMinimo ? '' : 'abaixo-do-minimo'}>
                        <td data-rotulo="Afiliado" onClick={() => definirAberto(a.id)} className="clicavel">
                          <div className="vd-pessoa">
                            <Rosto nome={a.nome} avatarUrl={a.avatarUrl} />
                            <div>
                              <strong>{a.nome}</strong>
                              <small>@{a.codigo}</small>
                              {a.saqueSolicitadoEm && (
                                <span className="vd-saque-pedido">Pediu saque em {dataEHora(a.saqueSolicitadoEm)}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td data-rotulo="Chave Pix">
                          {a.pix ? (
                            <div className="vd-pix compacto">
                              <div>
                                <small>{a.pix.tipo ? NOME_DA_CHAVE[a.pix.tipo] : 'Chave'}</small>
                                <strong>{a.pix.chave}</strong>
                              </div>
                              <BotaoCopiar texto={a.pix.chave} rotulo="" />
                            </div>
                          ) : (
                            <span className="vd-alerta">sem chave Pix</span>
                          )}
                        </td>
                        <td className="num" data-rotulo="A pagar">
                          <strong>{reais(a.aPagarCent)}</strong>
                          {!a.acimaDoMinimo && <small>abaixo do mínimo</small>}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="vd-botao sucesso pequeno"
                            disabled={aPagar === a.id || a.estado !== 'ATIVO'}
                            onClick={async () => {
                              definirAPagar(a.id)
                              const feito = await pagarAfiliado({ id: a.id, nome: a.nome, aPagarCent: a.aPagarCent, pix: a.pix })
                              definirAPagar(null)
                              if (feito) dados.recarregar()
                            }}
                          >
                            Marcar como pago
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="vd-cartao">
            <h2 className="vd-titulo-cartao">Pagamentos no período</h2>
            {f.pagamentos.length === 0 ? (
              <Vazio>Nenhum pagamento a afiliados neste período.</Vazio>
            ) : (
              <div className="vd-tabela-caixa">
                <table className="vd-tabela">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Afiliado</th>
                      <th className="num">Valor</th>
                      <th>Chave Pix</th>
                      <th>Observação</th>
                      <th>Marcado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.pagamentos.map((p) => (
                      <tr key={p.id} onClick={() => definirAberto(p.afiliadoId)}>
                        <td data-rotulo="Data" className="vd-data">
                          {dataEHora(p.pagoEm)}
                        </td>
                        <td data-rotulo="Afiliado">
                          <strong>{p.afiliado}</strong>
                          <small>@{p.codigo}</small>
                        </td>
                        <td className="num" data-rotulo="Valor">
                          <strong>{reais(p.valorCent)}</strong>
                          {p.descontosCent > 0 && <small>− {reais(p.descontosCent)} descontados</small>}
                        </td>
                        <td data-rotulo="Chave Pix">{p.chavePix ?? '—'}</td>
                        <td data-rotulo="Observação">{p.observacao ?? '—'}</td>
                        <td data-rotulo="Marcado por">{p.pagoPor ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <DetalheDoAfiliadoNaGaveta id={aberto} aoFechar={() => definirAberto(null)} aoMudar={dados.recarregar} />
    </>
  )
}

