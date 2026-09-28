'use client'

import { useEffect, useState } from 'react'
import { ErroDeApi } from '@/lib/auth'
import { dataCurta, dataEHora, fraccao, percentagem, reais } from '@/lib/dinheiro'
import { NOME_DA_CHAVE } from '@/lib/afiliados'
import { vendas, type DetalheDoAfiliado } from '@/lib/vendas'
import {
  BotaoCopiar,
  CabecalhoDaPagina,
  Carregando,
  CartaoKpi,
  Gaveta,
  Icone,
  Paginacao,
  Rosto,
  SeletorDePeriodo,
  SeloDaComissao,
  Vazio,
  useAtrasado,
  useDados,
  usePeriodo,
} from './comum'

type Aba = '' | 'ATIVO' | 'SUSPENSO'

/**
 * AFILIADOS — o mockup dele de 25/09, lado do administrador.
 *
 * A lista entra sozinha: ninguém aqui aprova, gera link ou lança venda. O que
 * o painel faz é o que ele escreveu: monitorar, suspender quando for preciso,
 * e marcar como pago depois de pagar pelo Pix.
 */
export function AfiliadosDoPainel() {
  const { de, ate } = usePeriodo()
  const [aba, definirAba] = useState<Aba>('')
  const [busca, definirBusca] = useState('')
  const [ordem, definirOrdem] = useState('vendas')
  const [pagina, definirPagina] = useState(1)
  const [aberto, definirAberto] = useState<string | null>(null)
  const [aExportar, definirAExportar] = useState(false)
  const buscaAtrasada = useAtrasado(busca)

  const lista = useDados(
    () => vendas.afiliados({ de, ate, estado: aba, busca: buscaAtrasada, ordem, pagina }),
    [de, ate, aba, buscaAtrasada, ordem, pagina],
  )
  useEffect(() => definirPagina(1), [aba, buscaAtrasada, ordem])

  const k = lista.dados?.kpis
  return (
    <>
      <CabecalhoDaPagina titulo="Afiliados" subtitulo="Gerencie seus afiliados e acompanhe as comissões.">
        <SeletorDePeriodo />
        <BotaoLiberar aoLiberar={lista.recarregar} />
        <button
          type="button"
          className="vd-botao secundario"
          disabled={aExportar}
          onClick={async () => {
            definirAExportar(true)
            try {
              await vendas.exportarAfiliados({ estado: aba, busca: buscaAtrasada })
            } finally {
              definirAExportar(false)
            }
          }}
        >
          <Icone nome="exportar" /> Exportar
        </button>
      </CabecalhoDaPagina>

      <div className="vd-kpis">
        <CartaoKpi
          icone="pessoas"
          cor="azul"
          valor={k ? k.afiliados.toLocaleString('pt-BR') : '—'}
          rotulo="Total de afiliados"
          nota={k ? `${k.novosNoPeriodo.toLocaleString('pt-BR')} novos no período` : undefined}
          variacao={k ? k.novosVariacao : undefined}
        />
        <CartaoKpi
          icone="carrinho"
          cor="verde"
          valor={k ? k.vendasNoPeriodo.toLocaleString('pt-BR') : '—'}
          rotulo="Vendas por afiliados"
          variacao={k ? k.vendasVariacao : undefined}
        />
        <CartaoKpi
          icone="moedas"
          cor="ambar"
          valor={k ? reais(k.pendenteCent) : '—'}
          rotulo="Comissões pendentes"
          nota={<><Icone nome="relogio" tamanho={14} /> Aguardando liberação</>}
        />
        <CartaoKpi
          icone="carteira"
          cor="roxo"
          valor={k ? reais(Math.max(0, k.disponivelCent - k.aDescontarCent)) : '—'}
          rotulo="Saldo disponível"
          nota={<><Icone nome="seta" tamanho={14} /> Pronto para pagamento</>}
        />
      </div>

      <div className="vd-cartao">
        <div className="vd-barra-da-lista">
          <div className="vd-abas" role="tablist">
            {(
              [
                ['', 'Todos', lista.dados?.abas.todos],
                ['ATIVO', 'Ativos', lista.dados?.abas.ativos],
                ['SUSPENSO', 'Suspensos', lista.dados?.abas.suspensos],
              ] as Array<[Aba, string, number | undefined]>
            ).map(([id, rotulo, n]) => (
              <button
                key={id || 'todos'}
                type="button"
                role="tab"
                aria-selected={aba === id}
                className={aba === id ? 'actual' : ''}
                onClick={() => definirAba(id)}
              >
                {rotulo}
                {n !== undefined && <span>({n.toLocaleString('pt-BR')})</span>}
              </button>
            ))}
          </div>
          <div className="vd-filtros">
            <label className="vd-busca">
              <Icone nome="buscar" />
              <input
                type="search"
                placeholder="Buscar por nome, e-mail ou link..."
                value={busca}
                onChange={(e) => definirBusca(e.target.value)}
              />
            </label>
            <select value={ordem} onChange={(e) => definirOrdem(e.target.value)} aria-label="Ordenar">
              <option value="vendas">Mais vendas</option>
              <option value="saldo">Maior saldo a pagar</option>
              <option value="cliques">Mais cliques</option>
              <option value="recentes">Mais recentes</option>
              <option value="nome">Nome</option>
            </select>
          </div>
        </div>

        {lista.erro && <p className="erro">{lista.erro}</p>}
        {!lista.dados && lista.aCarregar && <Carregando />}
        {lista.dados && lista.dados.afiliados.length === 0 && (
          <Vazio>
            {buscaAtrasada || aba
              ? 'Nenhum afiliado com estes filtros.'
              : 'Ainda não há afiliados. A área de afiliado de cada pessoa é liberada automaticamente quando o pagamento da primeira compra é confirmado.'}
          </Vazio>
        )}
        {lista.dados && lista.dados.afiliados.length > 0 && (
          <div className={`vd-tabela-caixa ${lista.aCarregar ? 'a-carregar' : ''}`}>
            <table className="vd-tabela">
              <thead>
                <tr>
                  <th>Afiliado</th>
                  <th className="num">Cliques</th>
                  <th className="num">Vendas</th>
                  <th className="num">Conversão</th>
                  <th className="num">Comissão pendente</th>
                  <th className="num">Saldo disponível</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.dados.afiliados.map((a) => (
                  <tr key={a.id} onClick={() => definirAberto(a.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && definirAberto(a.id)}>
                    <td data-rotulo="Afiliado">
                      <div className="vd-pessoa">
                        <Rosto nome={a.nome} avatarUrl={a.avatarUrl} />
                        <div>
                          <strong>{a.nome}</strong>
                          <small>{a.email}</small>
                        </div>
                      </div>
                    </td>
                    <td className="num" data-rotulo="Cliques">
                      {a.cliques.toLocaleString('pt-BR')}
                    </td>
                    <td className="num" data-rotulo="Vendas">
                      {a.vendas.toLocaleString('pt-BR')}
                    </td>
                    <td className="num" data-rotulo="Conversão">
                      {fraccao(a.conversao)}
                    </td>
                    <td className="num" data-rotulo="Pendente">
                      {reais(a.pendenteCent)}
                    </td>
                    <td className="num" data-rotulo="Disponível">
                      <strong>{reais(a.aPagarCent)}</strong>
                      {a.aPagarCent > 0 && !a.temPix && <small className="vd-alerta">sem chave Pix</small>}
                    </td>
                    <td data-rotulo="Status">
                      <span className={`vd-selo ${a.estado === 'ATIVO' ? 'a-ativo' : 'a-suspenso'}`}>
                        {a.estado === 'ATIVO' ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td>
                      <span className="vd-ver">Ver</span>
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
            coisa="afiliados"
          />
        )}
      </div>

      <DetalheDoAfiliadoNaGaveta id={aberto} aoFechar={() => definirAberto(null)} aoMudar={lista.recarregar} />
    </>
  )
}

/** Liberar à mão a área de quem comprou sem conta e só depois a criou. */
function BotaoLiberar({ aoLiberar }: { aoLiberar: () => void }) {
  return (
    <button
      type="button"
      className="vd-botao secundario"
      title="Para quem comprou sem conta e criou a conta depois"
      onClick={async () => {
        const email = window.prompt(
          'Liberar a área de afiliado de uma conta, pelo e-mail.\n\nO normal é ela ser liberada automaticamente com a compra. Use isto para quem comprou sem conta e criou a conta depois.',
        )
        if (!email?.trim()) return
        try {
          const r = await vendas.liberar(email.trim())
          window.alert(r.criado ? `Área liberada. Link: /af/${r.afiliado.codigo}` : 'Esta conta já era afiliada.')
          aoLiberar()
        } catch (e) {
          window.alert(e instanceof ErroDeApi ? e.message : 'Não foi possível liberar.')
        }
      }}
    >
      <Icone nome="pessoa" /> Liberar afiliado
    </button>
  )
}

/**
 * "Marcar como pago", com o valor e a chave à frente dos olhos.
 *
 * Paga-se primeiro no banco, pelo Pix, e só depois se marca aqui: o botão não
 * move dinheiro, regista que ele saiu. Por isso a confirmação repete o valor
 * exacto e a chave para onde deve ter ido.
 */
export async function pagarAfiliado(a: {
  id: string
  nome: string
  aPagarCent: number
  pix: { tipo: string | null; chave: string; titular: string | null } | null
}): Promise<boolean> {
  const chave = a.pix ? `${a.pix.tipo ? `${NOME_DA_CHAVE[a.pix.tipo as keyof typeof NOME_DA_CHAVE] ?? a.pix.tipo}: ` : ''}${a.pix.chave}${a.pix.titular ? ` (${a.pix.titular})` : ''}` : 'SEM CHAVE PIX CADASTRADA'
  const observacao = window.prompt(
    `Marcar como pago ${reais(a.aPagarCent)} a ${a.nome}?\n\nChave: ${chave}\n\nFaça primeiro o Pix no seu banco. ` +
      'Se quiser, anote aqui o identificador do Pix (opcional) e confirme.',
    '',
  )
  if (observacao === null) return false
  try {
    const r = await vendas.pagarAfiliado(a.id, observacao.trim())
    window.alert(`Pagamento de ${reais(r.valorCent)} registrado.`)
    return true
  } catch (e) {
    window.alert(e instanceof ErroDeApi ? e.message : 'Não foi possível registrar o pagamento.')
    return false
  }
}

export function DetalheDoAfiliadoNaGaveta({
  id,
  aoFechar,
  aoMudar,
}: {
  id: string | null
  aoFechar: () => void
  aoMudar?: () => void
}) {
  const [a, definirA] = useState<DetalheDoAfiliado | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aAgir, definirAAgir] = useState(false)

  const carregar = (alvo: string) =>
    vendas
      .afiliado(alvo)
      .then((d) => {
        definirA(d)
        definirErro(null)
      })
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível abrir o afiliado.'))

  useEffect(() => {
    definirA(null)
    definirErro(null)
    if (id) void carregar(id)
  }, [id])

  async function agir(fazer: () => Promise<unknown>) {
    if (!a) return
    definirAAgir(true)
    try {
      await fazer()
      await carregar(a.id)
      aoMudar?.()
    } catch (e) {
      window.alert(e instanceof ErroDeApi ? e.message : 'Não foi possível concluir.')
    } finally {
      definirAAgir(false)
    }
  }

  /*
    OS TRINTA DIAS, TODOS. O servidor só manda os dias em que houve cliques, e
    com um dia só o gráfico era uma barra da largura inteira. Com os dias
    vazios no sítio, uma barra é um dia.
  */
  const porDia = new Map((a?.cliquesPorDia ?? []).map((d) => [d.dia, d.cliques]))
  const trintaDias = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86_400_000)
    const dia = d.toISOString().slice(0, 10)
    return { dia, cliques: porDia.get(dia) ?? 0 }
  })
  const maxCliques = Math.max(1, ...trintaDias.map((d) => d.cliques))

  return (
    <Gaveta titulo="Detalhes do afiliado" aberta={id !== null} aoFechar={aoFechar}>
      {erro && <p className="erro">{erro}</p>}
      {!a && !erro && <Carregando />}
      {a && (
        <>
          <div className="vd-pessoa grande">
            <Rosto nome={a.pessoa.nome} avatarUrl={a.pessoa.avatarUrl} tamanho={56} />
            <div>
              <strong>{a.pessoa.nome}</strong>
              <small>{a.pessoa.email}</small>
              <small>
                Afiliado desde {dataCurta(a.desde)}
                {a.origem === 'PAINEL' ? ' · liberado no painel' : a.origem === 'COMPRA_ANTERIOR' ? ' · comprou antes do programa' : ''}
              </small>
            </div>
            <span className={`vd-selo ${a.estado === 'ATIVO' ? 'a-ativo' : 'a-suspenso'}`}>{a.estado === 'ATIVO' ? 'Ativo' : 'Suspenso'}</span>
          </div>
          {a.estado === 'SUSPENSO' && (
            <p className="vd-aviso">
              Suspenso em {dataCurta(a.suspensoEm)}
              {a.motivoDaSuspensao ? ` — ${a.motivoDaSuspensao}` : ''}. O link continua levando à loja, mas não conta vendas nem cliques.
            </p>
          )}

          <section className="vd-secao">
            <h3>Link de afiliado</h3>
            <div className="vd-link-copiar">
              <input readOnly value={a.link} onFocus={(e) => e.currentTarget.select()} aria-label="Link de afiliado" />
              <BotaoCopiar texto={a.link} />
            </div>
          </section>

          <section className="vd-secao">
            <h3>Resumo de desempenho</h3>
            <div className="vd-mini-kpis">
              <div className="azul">
                <Icone nome="cursor" />
                <strong>{a.resumo.cliques.toLocaleString('pt-BR')}</strong>
                <span>Cliques</span>
              </div>
              <div className="verde">
                <Icone nome="carrinho" />
                <strong>{a.resumo.vendas.toLocaleString('pt-BR')}</strong>
                <span>Vendas · {fraccao(a.resumo.conversao)}</span>
              </div>
              <div className="ambar">
                <Icone nome="moedas" />
                <strong>{reais(a.resumo.pendenteCent)}</strong>
                <span>Pendente</span>
              </div>
              <div className="roxo">
                <Icone nome="carteira" />
                <strong>{reais(a.resumo.aPagarCent)}</strong>
                <span>Disponível</span>
              </div>
            </div>
            <p className="vd-linha-simples">
              <span>Total recebido</span>
              <strong>{reais(a.resumo.recebidoCent)}</strong>
            </p>
            {a.resumo.aDescontarCent > 0 && (
              <p className="vd-linha-simples vd-alerta">
                <span>Reembolsos a descontar</span>
                <strong>− {reais(a.resumo.aDescontarCent)}</strong>
              </p>
            )}
          </section>

          {a.cliquesPorDia.length > 0 && (
            <section className="vd-secao">
              <h3>Cliques nos últimos 30 dias</h3>
              <div className="vd-barrinhas" role="img" aria-label="Cliques por dia">
                {trintaDias.map((d) => (
                  <span
                    key={d.dia}
                    className={d.cliques ? '' : 'zero'}
                    style={{ height: d.cliques ? `${Math.max(8, (d.cliques / maxCliques) * 100)}%` : undefined }}
                    title={`${d.dia.split('-').reverse().join('/')}: ${d.cliques} clique${d.cliques === 1 ? '' : 's'}`}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="vd-secao">
            <h3>Chave Pix para receber</h3>
            {a.pix ? (
              <div className="vd-pix">
                <div>
                  <small>{a.pix.tipo ? NOME_DA_CHAVE[a.pix.tipo] : 'Chave'}</small>
                  <strong>{a.pix.chave}</strong>
                  {a.pix.titular && <small>{a.pix.titular}</small>}
                </div>
                <BotaoCopiar texto={a.pix.chave} />
              </div>
            ) : (
              <p className="vd-alerta">Ainda sem chave Pix. O afiliado cadastra a chave na área dele.</p>
            )}
          </section>

          <section className="vd-secao">
            <h3>Histórico de comissões</h3>
            {a.comissoes.length === 0 ? (
              <Vazio>Ainda sem vendas.</Vazio>
            ) : (
              <ul className="vd-historico-lista">
                {a.comissoes.map((c) => (
                  <li key={c.id}>
                    <span className={`vd-ponto c-${c.estado.toLowerCase()}`} aria-hidden="true" />
                    <div>
                      <strong>{reais(c.valorCent - c.estornoCent)}</strong>
                      <small>
                        #{c.pedido.numero} · {c.pedido.cliente ?? c.pedido.email ?? 'sem conta'} · {dataCurta(c.pedido.pagoEm ?? c.criadaEm)}
                      </small>
                      {c.estado === 'PENDENTE' && <small>disponível em {dataCurta(c.liberaEm)}</small>}
                      {c.motivoDoCancelamento && <small>{c.motivoDoCancelamento}</small>}
                    </div>
                    <SeloDaComissao estado={c.estado} />
                    {(c.estado === 'PENDENTE' || c.estado === 'DISPONIVEL') && (
                      <button
                        type="button"
                        className="vd-botao-texto"
                        disabled={aAgir}
                        onClick={() => {
                          const motivo = window.prompt('Cancelar esta comissão? Escreva o motivo (ex.: compra suspeita).')
                          if (motivo === null) return
                          void agir(() => vendas.cancelarComissao(c.id, motivo))
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {a.pagamentos.length > 0 && (
            <section className="vd-secao">
              <h3>Pagamentos feitos</h3>
              <ul className="vd-historico-lista">
                {a.pagamentos.map((p) => (
                  <li key={p.id}>
                    <span className="vd-ponto c-paga" aria-hidden="true" />
                    <div>
                      <strong>{reais(p.valorCent)}</strong>
                      <small>
                        {dataEHora(p.pagoEm)}
                        {p.pagoPor ? ` · por ${p.pagoPor}` : ''}
                      </small>
                      {p.descontosCent > 0 && (
                        <small>
                          {reais(p.comissoesCent)} de comissões − {reais(p.descontosCent)} de reembolsos
                        </small>
                      )}
                      {p.chavePix && <small>Pix: {p.chavePix}</small>}
                      {p.observacao && <small>{p.observacao}</small>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="vd-acoes-da-gaveta">
            <button
              type="button"
              className="vd-botao sucesso"
              disabled={aAgir || a.estado !== 'ATIVO' || a.resumo.aPagarCent <= 0}
              title={a.resumo.aPagarCent <= 0 ? 'Não há saldo disponível para pagar' : undefined}
              onClick={async () => {
                definirAAgir(true)
                const feito = await pagarAfiliado({ id: a.id, nome: a.pessoa.nome, aPagarCent: a.resumo.aPagarCent, pix: a.pix })
                definirAAgir(false)
                if (feito) {
                  await carregar(a.id)
                  aoMudar?.()
                }
              }}
            >
              <Icone nome="check" /> Marcar como pago{a.resumo.aPagarCent > 0 ? ` (${reais(a.resumo.aPagarCent)})` : ''}
            </button>
            {a.estado === 'ATIVO' ? (
              <button
                type="button"
                className="vd-botao perigo"
                disabled={aAgir}
                onClick={() => {
                  const motivo = window.prompt(
                    `Suspender ${a.pessoa.nome}?\n\nO link continua levando à loja, mas deixa de contar cliques e vendas, e os pagamentos ficam parados. Motivo (opcional):`,
                    '',
                  )
                  if (motivo === null) return
                  void agir(() => vendas.suspender(a.id, motivo))
                }}
              >
                <Icone nome="bloquear" /> Suspender afiliado
              </button>
            ) : (
              <button type="button" className="vd-botao secundario" disabled={aAgir} onClick={() => void agir(() => vendas.reativar(a.id))}>
                Reativar afiliado
              </button>
            )}
          </div>
          <p className="vd-nota">
            Cada venda guarda a porcentagem do dia em que aconteceu
            {a.comissoes[0] ? ` (a última: ${percentagem(a.comissoes[0].comissaoBp)})` : ''}. Mudar a comissão nas configurações vale
            só para as vendas seguintes.
          </p>
        </>
      )}
    </Gaveta>
  )
}
