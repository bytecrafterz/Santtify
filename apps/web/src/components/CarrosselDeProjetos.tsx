import Link from 'next/link'
import { abreviarKM } from '@pv/cartoes'
import { projetosDoCarrossel, type ProjetoNoCarrossel } from '@/lib/carrossel'

/**
 * O carrossel de projetos, debaixo do perfil.
 *
 * O PERFIL NÃO É TOCADO. Isto entra por baixo dele e mais nada — o cliente
 * escreveu-o duas vezes e tem razão: o perfil já funciona e já foi pago.
 *
 * Componente de servidor, sem `use client`. Não tem estado nenhum: é uma lista
 * que se lê e se desenha. Mandá-lo para o navegador só acrescentaria JavaScript
 * a uma coisa que o servidor já entrega pronta, e este ecrã abre-se quase
 * sempre num telemóvel com dados móveis.
 *
 * O deslizar é `scroll-snap` do próprio CSS. Uma biblioteca de carrossel aqui
 * seriam uns 30 kB para fazer o que o navegador já faz nativamente, e com pior
 * comportamento no toque.
 */
export async function CarrosselDeProjetos() {
  const projetos = await projetosDoCarrossel()
  if (projetos.length === 0) return null

  return (
    <section className="carrossel-de-projetos" aria-labelledby="titulo-projetos">
      <header className="carrossel-cabecalho">
        <h2 id="titulo-projetos">Projetos</h2>
        <Link href="/projetos" className="carrossel-ver-todos">
          Ver todos
          <span aria-hidden="true">›</span>
        </Link>
      </header>

      <ul className="carrossel-trilho">
        {projetos.map((projeto, indice) => (
          <li key={projeto.slug} className="carrossel-item">
            <CartaoDeProjeto projeto={projeto} numero={indice + 1} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function CartaoDeProjeto({
  projeto,
  numero,
}: {
  projeto: ProjetoNoCarrossel
  numero: number
}) {
  return (
    <Link href={`/${projeto.slug}`} className="cartao-de-projeto">
      <span className="cartao-numero" aria-hidden="true">
        {numero}
      </span>

      <span className="cartao-capa">
        {projeto.capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={projeto.capa} alt="" loading="lazy" />
        ) : (
          /**
           * Sem capa carregada, as iniciais do projeto.
           *
           * Um espaço cinzento vazio parece avaria; as iniciais parecem um
           * projeto a que ainda falta a capa — que é exactamente o que é.
           */
          <span className="cartao-sem-capa" aria-hidden="true">
            {iniciais(projeto.nome)}
          </span>
        )}
      </span>

      <span className="cartao-corpo">
        <strong className="cartao-nome">{projeto.nome}</strong>
        {projeto.tagline && <span className="cartao-tagline">{projeto.tagline}</span>}
      </span>

      <span className="cartao-numeros">
        <Numero rotulo="visualizações" valor={projeto.numeros.views} simbolo="👁" />
        <Numero rotulo="curtidas" valor={projeto.numeros.likes} simbolo="♡" />
        <Numero rotulo="comentários" valor={projeto.numeros.comments} simbolo="💬" />
        <Numero rotulo="compartilhamentos" valor={projeto.numeros.shares} simbolo="↗" />
      </span>
    </Link>
  )
}

/**
 * Um indicador.
 *
 * O número abreviado é o que se vê; o número inteiro fica no `title` e no rótulo
 * para leitores de ecrã. "20K" chega para quem olha de passagem, e quem precisa
 * do exacto continua a poder tê-lo — sem obrigar o cartão a ficar largo.
 */
function Numero({
  rotulo,
  valor,
  simbolo,
}: {
  rotulo: string
  valor: number
  simbolo: string
}) {
  return (
    <span className="cartao-numero-item" title={`${valor.toLocaleString('pt-BR')} ${rotulo}`}>
      <span aria-hidden="true">{simbolo}</span>
      <span aria-hidden="true">{abreviarKM(valor)}</span>
      <span className="apenas-leitor-de-ecra">
        {valor.toLocaleString('pt-BR')} {rotulo}
      </span>
    </span>
  )
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
