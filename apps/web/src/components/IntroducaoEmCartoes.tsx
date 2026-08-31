'use client'

import type { Bloco } from '@/lib/api'
import { PublicacaoDaLetra } from './PublicacaoDaLetra'

/**
 * A introdução do projeto, feita dos mesmos cartões que as letras.
 *
 * Aqui estava a capa do projeto: uma fotografia grande e mais nada — sem
 * áudio, sem título, sem texto. Era a última fotografia sozinha da página, e
 * portanto a última coisa que ainda contrariava a regra que ele fixou e
 * aprovou em 24/08: imagem, som e texto pertencem à mesma publicação.
 *
 * Ele escreveu-o de forma directa: "depois vêm as publicações usando
 * exactamente a estrutura que você acabou de corrigir". A introdução é a
 * primeira publicação do perfil dele, e não uma decoração no topo.
 *
 * Sem cartões prontos não desenha nada. Uma secção vazia com um título por
 * cima é pior do que secção nenhuma: ocupa o ecrã a anunciar que falta algo.
 */
export function IntroducaoEmCartoes({
  contentId,
  blocos,
  projectId,
  projectSlug,
  categorias = [],
  publicacaoUnica = false,
}: {
  contentId: string
  blocos: Bloco[]
  projectId: string
  projectSlug: string
  /** As categorias do projeto, para o filtro do tocador. */
  categorias?: Array<{ slug: string; name: string }>
  /**
   * Desenhar tudo como UMA publicação: as artes como páginas, e a fila de
   * indicadores uma só vez, no fim. É o Produto Vivo. Ver a nota lá dentro.
   */
  publicacaoUnica?: boolean
}) {
  const cartoes = blocos.filter(
    (b) => b.type === 'AUDIO' && b.papel === 'CARTAO' && (b.asset?.url || b.arte),
  )
  if (cartoes.length === 0) return null

  /*
    AS ARTES SÃO PÁGINAS DA MESMA PUBLICAÇÃO, E NÃO PUBLICAÇÕES.

    Cada cartão desenhava-se como uma publicação inteira, com a sua própria
    fila de ver, curtir, comentar e partilhar. Ele publicou três artes e um
    áudio e apareceram três filas. A frase dele é a especificação: "as três
    artes são apenas páginas da MESMA publicação; a camada social aparece UMA
    ÚNICA VEZ, debaixo do áudio".

    E tem razão pelo argumento: curtir a arte 2 e não a arte 3 não quer dizer
    nada, e um comentário pertence ao que a pessoa viu, que é a publicação
    inteira.

    Por isso, aqui, as artes saem como imagens e só a peça final — a que leva o
    som — tem a fila de indicadores, apontada ao CONTEÚDO e não a uma faixa. O
    conteúdo é a publicação.
  */
  if (publicacaoUnica) {
    const principal = cartoes[cartoes.length - 1]
    const artes = cartoes.slice(0, -1)
    return (
      <div className="publicacao-unica">
        {artes.map((a, i) =>
          a.arte ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={a.id} className="arte-da-publicacao" src={a.arte} alt={`Arte ${i + 1}`} />
          ) : null,
        )}

        <PublicacaoDaLetra
          key={principal.id}
          etiqueta={null}
          imagem={principal.arte}
          bloco={principal}
          titulo={principal.titulo ?? ''}
          texto={principal.text?.trim() ?? null}
          alvo={{ tipo: 'conteudo', contentId }}
          projectId={projectId}
          contentId={contentId}
          projectSlug={projectSlug}
          ligacao={`/${projectSlug}/produto-vivo`}
          ancora={`publicacao-${contentId}`}
          categorias={categorias}
        />
      </div>
    )
  }

  return (
    <>
      {cartoes.map((b) => (
        <PublicacaoDaLetra
          key={b.id}
          etiqueta={null}
          imagem={b.arte}
          bloco={b}
          titulo={b.titulo ?? ''}
          texto={b.text?.trim() ?? null}
          alvo={{ tipo: 'faixa', blockId: b.id }}
          projectId={projectId}
          contentId={contentId}
          projectSlug={projectSlug}
          ligacao={`/${projectSlug}#cartao-${b.id}`}
          ancora={`cartao-${b.id}`}
          categorias={categorias}
        />
      ))}
    </>
  )
}
