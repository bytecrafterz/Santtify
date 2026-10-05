import { percentagem, reais } from '@/lib/dinheiro'

export interface Simulacao {
  kits: number
  comissaoBp: number
  precoNormalCent: number
  /** 0 = sem promoção: só a do preço normal. */
  precoPromocionalCent: number
}

/** 100 kits em 30 dias → "Média de 3 a 4 kits por dia", como na arte dele. */
function kitsPorDia(kits: number): string {
  const dia = kits / 30
  const menos = Math.floor(dia)
  const mais = Math.ceil(dia)
  if (menos === 0) return 'Menos de 1 kit por dia'
  if (menos === mais) return `Média de ${menos} ${menos === 1 ? 'kit' : 'kits'} por dia`
  return `Média de ${menos} a ${mais} kits por dia`
}

function Icone({ nome }: { nome: 'carrinho' | 'etiqueta' | 'percentagem' | 'saco' | 'barras' }) {
  const tracos = {
    carrinho: (
      <>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.5-6.8H6.2" />
      </>
    ),
    etiqueta: (
      <>
        <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.4 1.4 0 0 1 0 2l-7.1 7.1a1.4 1.4 0 0 1-2 0Z" />
        <circle cx="8.2" cy="8.2" r="1.5" />
      </>
    ),
    percentagem: (
      <>
        <path d="M19 5 5 19" />
        <circle cx="7" cy="7" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
      </>
    ),
    saco: (
      <>
        <path d="M9 3.5h6l-1.6 3.2h-2.8Z" />
        <path d="M10.6 6.7C6.4 8.6 4 12.4 4 16a4.5 4.5 0 0 0 4.5 4.5h7A4.5 4.5 0 0 0 20 16c0-3.6-2.4-7.4-6.6-9.3" />
        <path d="M14 11.5c-.4-.6-1.1-1-2-1-1.2 0-2 .7-2 1.6 0 2.1 4.2 1.2 4.2 3.4 0 .9-.9 1.6-2.2 1.6-.9 0-1.7-.4-2.1-1M12 9.5v1M12 17.1v1" />
      </>
    ),
    barras: <path d="M5 20v-6M10 20V9M15 20v-9M20 20V4" />,
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tracos[nome]}
    </svg>
  )
}

function UmaSimulacao({
  tipo,
  precoCent,
  kits,
  comissaoBp,
}: {
  tipo: 'promocional' | 'normal'
  precoCent: number
  kits: number
  comissaoBp: number
}) {
  const comissaoCent = Math.round((precoCent * comissaoBp) / 10_000)
  const totalCent = comissaoCent * kits
  return (
    <article className={`sg sg-${tipo}`} aria-label={`Simulação com o preço ${tipo}`}>
      <header className="sg-topo">
        <span className="sg-selo">
          <Icone nome="barras" /> Simulação de resultados
        </span>
        <span className="sg-tipo">{tipo === 'promocional' ? 'Preço promocional' : 'Preço normal'}</span>
      </header>
      <p className="sg-titulo">
        Venda de <strong>{kits.toLocaleString('pt-BR')} kits</strong> em 30 dias
      </p>
      <ol className="sg-passos">
        <li>
          <span className="sg-icone verde">
            <Icone nome="carrinho" />
          </span>
          <strong>{kits.toLocaleString('pt-BR')}</strong>
          <span>kits vendidos</span>
          <small>{kitsPorDia(kits)}</small>
        </li>
        <li>
          <span className="sg-icone azul">
            <Icone nome="etiqueta" />
          </span>
          <strong>{reais(precoCent)}</strong>
          <span>valor de cada kit</span>
        </li>
        <li>
          <span className="sg-icone roxo">
            <Icone nome="percentagem" />
          </span>
          <strong>{reais(comissaoCent)}</strong>
          <span>sua comissão por kit ({percentagem(comissaoBp)})</span>
        </li>
        <li className="sg-ganho">
          <span className="sg-icone verde-cheio">
            <Icone nome="saco" />
          </span>
          <strong>{reais(totalCent)}</strong>
          <span>seu ganho total</span>
          <small>
            {kits.toLocaleString('pt-BR')} kits × {reais(comissaoCent)}
          </small>
        </li>
      </ol>
    </article>
  )
}

/**
 * QUANTO SE PODE GANHAR — as duas simulações por baixo da área de afiliado.
 *
 * Pedido dele em 05/10: "abaixo de cada perfil de afiliado, quero mostrar as
 * artes de simulação de resultados (…) Devem existir duas simulações: preço
 * normal e preço promocional. Essas artes são apenas simulações, não vendas
 * reais." O desenho segue as artes que mandou — 100 kits em 30 dias, o preço,
 * a comissão, o ganho — mas os números vêm das Configurações: a comissão é a
 * do programa, e os preços e os kits mudam-se lá. Uma imagem com os números
 * pintados ficaria a dizer 40% no dia em que a comissão passasse a 35%.
 *
 * E diz em cada cartão que é uma simulação, e no fim que os resultados reais
 * podem ser maiores ou menores — as palavras dele.
 */
export function SimulacoesDeGanhos({ simulacao }: { simulacao: Simulacao }) {
  const { kits, comissaoBp, precoNormalCent, precoPromocionalCent } = simulacao
  const comPromocao = precoPromocionalCent > 0 && precoPromocionalCent !== precoNormalCent
  return (
    <section className="sg-lista" aria-label="Simulação de ganhos como afiliado">
      <h3 className="sg-cabecalho">Quanto você pode ganhar como afiliado</h3>
      {comPromocao && <UmaSimulacao tipo="promocional" precoCent={precoPromocionalCent} kits={kits} comissaoBp={comissaoBp} />}
      <UmaSimulacao tipo="normal" precoCent={precoNormalCent} kits={kits} comissaoBp={comissaoBp} />
      <p className="sg-aviso">
        <span aria-hidden="true">!</span>
        <span>
          <strong>Importante:</strong> esta é apenas uma simulação para mostrar o seu potencial de ganhos, e não vendas reais.
          Seus resultados reais podem ser maiores ou menores, conforme o seu desempenho.
        </span>
      </p>
    </section>
  )
}
