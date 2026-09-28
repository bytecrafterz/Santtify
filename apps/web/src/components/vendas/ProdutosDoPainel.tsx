'use client'

import Link from 'next/link'
import { reais } from '@/lib/dinheiro'
import { vendas } from '@/lib/vendas'
import { CabecalhoDaPagina, Capa, Carregando, Icone, SeletorDePeriodo, Vazio, useDados, usePeriodo } from './comum'

/**
 * PRODUTOS — cada categoria de cartões, o preço de agora e o que vendeu no
 * período. O preço, as artes e as medidas continuam a mudar-se no painel dos
 * cartões, que é onde sempre estiveram; aqui é só a porta para lá.
 */
export function ProdutosDoPainel() {
  const { de, ate } = usePeriodo()
  const lista = useDados(() => vendas.produtos({ de, ate }), [de, ate])

  return (
    <>
      <CabecalhoDaPagina titulo="Produtos" subtitulo="O que se vende, a que preço, e quanto vendeu no período.">
        <SeletorDePeriodo />
      </CabecalhoDaPagina>
      {lista.erro && <p className="erro">{lista.erro}</p>}
      {!lista.dados && lista.aCarregar && <Carregando />}
      {lista.dados && lista.dados.produtos.length === 0 && <Vazio>Ainda não há categorias de cartões.</Vazio>}
      <div className="vd-produtos">
        {lista.dados?.produtos.map((p) => (
          <article key={p.id} className="vd-cartao vd-produto-cartao">
            <div className="vd-produto-topo">
              <Capa src={p.capaUrl} />
              <div>
                <h2>{p.nome}</h2>
                <small>{p.projeto}</small>
                <div className="vd-produto-etiquetas">
                  {!p.ativo && <span className="vd-selo s-cancelado">Inativa</span>}
                  {p.emBreve && <span className="vd-selo s-aguardando">Em breve</span>}
                  {p.ativo && !p.emBreve && p.cartoes > 0 && <span className="vd-selo s-concluido">À venda</span>}
                  {p.ativo && p.cartoes === 0 && <span className="vd-selo s-aguardando">Sem cartões</span>}
                </div>
              </div>
            </div>
            <dl className="vd-produto-numeros">
              <div>
                <dt>Preço</dt>
                <dd>
                  {p.precoCent != null ? reais(p.precoCent, p.moeda) : '—'}
                  {p.precoDeTabelaCent && <s>{reais(p.precoDeTabelaCent, p.moeda)}</s>}
                </dd>
              </div>
              <div>
                <dt>Cartões</dt>
                <dd>{p.cartoes}</dd>
              </div>
              <div>
                <dt>Pedidos</dt>
                <dd>{p.pedidos}</dd>
              </div>
              <div>
                <dt>Conjuntos</dt>
                <dd>{p.conjuntos}</dd>
              </div>
              <div className="largo">
                <dt>Faturamento no período</dt>
                <dd>
                  {reais(p.brutoCent - p.reembolsosCent, p.moeda)}
                  {p.reembolsosCent > 0 && <small> ({reais(p.reembolsosCent, p.moeda)} reembolsados)</small>}
                </dd>
              </div>
            </dl>
            <Link className="vd-botao secundario" href={`/${p.projectSlug}/admin/cartoes`}>
              Editar preço e cartões <Icone nome="seta" />
            </Link>
          </article>
        ))}
      </div>
    </>
  )
}
