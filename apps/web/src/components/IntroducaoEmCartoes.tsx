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
