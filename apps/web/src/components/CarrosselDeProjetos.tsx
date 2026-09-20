import { projetosDoCarrossel } from '@/lib/carrossel'
import { ProjetoNaPagina } from './ProjetoNaPagina'

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
 * Sem título nem descrição: a imagem é que diz o que o projeto é. Desde 19/09
 * o CARD INTEIRO abre o projeto, e os quatro números fazem o que dizem:
 * curtir, comentar e partilhar. A visualização continua só a contar, como ele
 * definiu. Cada card é `ProjetoNaPagina`, que é onde isso vive.
 *
 * A IMAGEM APARECE INTEIRA, na proporção em que foi feita. As dele não são
 * todas iguais — uma faixa 3:1 e uma 16:9 — e são artes com texto e selos até
 * à borda. Uma caixa de tamanho fixo cortava-os.
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
            <ProjetoNaPagina projeto={projeto} primeiro={indice === 0} />
          </li>
        ))}
      </ul>
    </section>
  )
}
