import Link from 'next/link'
import type { ItemIndice, Projeto } from '@/lib/api'
import { abreviar } from '@/lib/numeros'

/**
 * O card grande do projeto, como nos mockups de 19/08.
 *
 * Capa a ocupar quase o ecrã todo, botão de tocar ao centro, selo PV no canto
 * e os quatro indicadores numa coluna à direita. É a mesma gramática de
 * qualquer rede vertical de hoje, e é deliberado: a família que chega aqui já
 * sabe ler esta tela sem ninguém lhe explicar.
 *
 * Os números são a soma das letras publicadas. Somar aqui, e não guardar um
 * contador próprio do projeto, evita ter dois números sobre a mesma coisa a
 * divergirem com o tempo — que é como um painel perde a confiança de quem o lê.
 */
export function CartaoDoProjeto({
  projectSlug,
  project,
  contents,
}: {
  projectSlug: string
  project: Projeto
  contents: ItemIndice[]
}) {
  const totais = contents.reduce(
    (acc, c) => ({
      views: acc.views + (c.stats?.views ?? 0),
      likes: acc.likes + (c.stats?.likes ?? 0),
      comments: acc.comments + (c.stats?.comments ?? 0),
      shares: acc.shares + (c.stats?.shares ?? 0),
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  )

  // Enquanto o cliente não carrega a capa do projeto, a arte da primeira letra
  // publicada serve de rosto. Melhor uma capa emprestada do que um retângulo
  // cinzento na primeira coisa que a pessoa vê.
  // `branding` é um saco livre vindo do banco, então o logo entra como
  // desconhecido e só vale se for mesmo texto.
  const logo = project.branding?.logoUrl
  const capa =
    (typeof logo === 'string' && logo) || contents.find((c) => c.coverUrl)?.coverUrl || null

  return (
    <div className="card-capa">
      <span className="etiqueta-capa" aria-hidden>
        ♪ Minha Playlist
      </span>

      <Link className="selo-pv-capa" href={`/${projectSlug}/produto-vivo`}>
        PV
      </Link>

      {capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="capa" src={capa} alt={project.name} />
      ) : (
        <div className="capa capa-vazia">
          <span>Adicione aqui a capa, imagem ou vídeo</span>
        </div>
      )}

      <Link
        className="botao-tocar-capa"
        href={`/${projectSlug}/playlist`}
        aria-label="Ouvir todas as músicas"
      >
        ▶
      </Link>

      <div className="trilho">
        <span className="indicador contagem">
          <span className="bolha" aria-hidden>
            👁
          </span>
          {abreviar(totais.views)}
        </span>
        <span className="indicador contagem">
          <span className="bolha" aria-hidden>
            ♥
          </span>
          {abreviar(totais.likes)}
        </span>
        <span className="indicador contagem">
          <span className="bolha" aria-hidden>
            💬
          </span>
          {abreviar(totais.comments)}
        </span>
        <span className="indicador contagem">
          <span className="bolha" aria-hidden>
            ↗
          </span>
          {abreviar(totais.shares)}
        </span>
      </div>
    </div>
  )
}
