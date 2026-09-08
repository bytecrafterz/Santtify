'use client'

import { useEffect, useRef } from 'react'
import { rastrear } from '@/lib/track'

/**
 * Uma visualização para CADA publicação desenhada nesta página.
 *
 * O olho de uma publicação conta eventos `CONTENT_VIEW` que trazem o `blockId`
 * dentro de `props` — é assim que o servidor sabe de que cartão é a visita. As
 * letras já os emitiam, porque `ExperienciaContinua` percorre os blocos quando
 * abre uma letra. As páginas que desenham publicações SEM passar por ali nunca
 * os emitiram, e por isso o olho delas nunca podia ser outra coisa senão zero:
 * não estava a contar mal, não tinha o que contar.
 *
 * Ele apanhou-o em 08/09, no Produto Vivo: coração 1, comentário 1, partilhas 7,
 * reproduções 17 — e visualizações 0. Medido na base: 65 visitas à página e
 * ZERO com bloco. A Introdução tinha o mesmo, com 101.
 *
 * SÓ EVENTOS DE BLOCO. A visita da própria página é trabalho do
 * `RastreadorDeVisita`, que já está em todas estas páginas; emitir aqui outra
 * contaria a mesma chegada duas vezes.
 *
 * UMA POR ABERTURA, e não por rolagem. É a regra dele de 25/08: "entrou
 * efetivamente no conteúdo = 1 view; saiu e abriu novamente = nova view". O
 * `useRef` é o que a garante quando o React monta duas vezes.
 */
export function VisualizacoesDasPublicacoes({
  projectId,
  contentId,
  blocos,
}: {
  projectId: string
  contentId: string
  /** Os ids dos cartões DESENHADOS nesta página, e não todos os que existem. */
  blocos: string[]
}) {
  const jaEnviado = useRef(false)
  const chave = blocos.join(',')

  useEffect(() => {
    if (jaEnviado.current) return
    if (!projectId || !contentId || !blocos.length) return
    jaEnviado.current = true

    void Promise.allSettled(
      blocos.map((blockId) =>
        rastrear({
          projectId,
          contentId,
          type: 'CONTENT_VIEW',
          props: { blockId, origem: 'abriu-a-pagina' },
        }),
      ),
    ).then(() => {
      // Os indicadores leem ao montar e a gravação acontece ao mesmo tempo: sem
      // este aviso, o número mostrado é sempre o de antes desta visita.
      window.dispatchEvent(new CustomEvent('pv:visita-registada'))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, contentId, chave])

  return null
}
