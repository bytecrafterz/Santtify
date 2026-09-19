import Link from 'next/link'
import { abreviarKM } from '@pv/cartoes'
import { projetosDoCarrossel, type ProjetoNoCarrossel } from '@/lib/carrossel'
import { BalaoGrande, CoracaoGrande, OlhoGrande, SetaGrande } from './IconesGrandes'

/**
 * Os projetos, debaixo do perfil: uma imagem por linha, e mais nada.
 *
 * REFEITO EM 19/09, A PEDIDO DELE, depois de ver a primeira versão no ar. Os
 * cartões lado a lado, com nome e frase, ficavam "acumulados e apertados" — e
 * o público são crianças, muitas ainda sem saber ler. A regra dele agora é
 * esta, e é toda a regra:
 *
 *   imagem horizontal do projeto → os quatro números → o projeto seguinte.
 *
 * Sem título nem descrição: a imagem é que diz o que o projeto é. Tocar na
 * imagem abre o projeto. Os números são os mesmos desenhos das publicações,
 * para a criança reconhecer o que já conhece.
 *
 * O PERFIL CONTINUA SEM SER TOCADO. Isto entra por baixo dele e mais nada.
 *
 * Componente de servidor: é uma lista que se lê e se desenha, sem estado, e
 * este ecrã abre-se quase sempre num telemóvel com dados móveis.
 */
export async function CarrosselDeProjetos() {
  const projetos = await projetosDoCarrossel()
  if (projetos.length === 0) return null

  return (
    <section className="projetos-da-pagina" aria-label="Projetos">
      <ul className="projetos-lista">
        {projetos.map((projeto, indice) => (
          <li key={projeto.slug}>
            <Projeto projeto={projeto} primeiro={indice === 0} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function Projeto({ projeto, primeiro }: { projeto: ProjetoNoCarrossel; primeiro: boolean }) {
  return (
    <article className="projeto-da-pagina">
      <Link href={`/${projeto.slug}`} className="projeto-imagem" aria-label={projeto.nome}>
        {projeto.capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={projeto.capa}
            alt=""
            // O primeiro está à vista quando a página abre; os outros esperam.
            loading={primeiro ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          /*
            Sem imagem carregada, as iniciais do projeto.

            Um retângulo vazio parece avaria; as iniciais parecem um projeto a
            que ainda falta a imagem — que é exactamente o que é, e o painel diz
            a ele qual falta.
          */
          <span className="projeto-sem-imagem" aria-hidden="true">
            {iniciais(projeto.nome)}
          </span>
        )}
      </Link>

      {/* Só números: nada aqui se toca. Curtir e comentar são das publicações,
          lá dentro; aqui é o total do projeto inteiro, como ele pediu no ponto 1. */}
      <div className="indicadores-publicacao projeto-numeros">
        <Numero rotulo="visualizações" valor={projeto.numeros.views} icone={<OlhoGrande />} />
        <Numero rotulo="curtidas" valor={projeto.numeros.likes} icone={<CoracaoGrande />} />
        <Numero rotulo="comentários" valor={projeto.numeros.comments} icone={<BalaoGrande />} />
        <Numero rotulo="compartilhamentos" valor={projeto.numeros.shares} icone={<SetaGrande />} />
      </div>
    </article>
  )
}

/**
 * Um indicador. O número abreviado é o que se vê ("20K", como ele escreveu no
 * ponto 1); o inteiro fica no `title` e para os leitores de ecrã.
 */
function Numero({
  rotulo,
  valor,
  icone,
}: {
  rotulo: string
  valor: number
  icone: React.ReactNode
}) {
  return (
    <span className="indicador-grande" title={`${valor.toLocaleString('pt-BR')} ${rotulo}`}>
      <span className="simbolo">{icone}</span>
      <strong aria-hidden="true">{abreviarKM(valor)}</strong>
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
