'use client'

import type { ItemIndice, Projeto } from '@/lib/api'

/**
 * A capa do projeto, como um cartão e nada mais.
 *
 * Já teve aqui um botão de tocar ao centro, cinco filtros e a lista das
 * faixas. Saíram todos a pedido dele em 21/08: quer a página feita só de
 * cartões, cada áudio um cartão inteiro, sem estrutura fragmentada por baixo.
 *
 * Os filtros tinham sido pedidos por ele no dia anterior. Ficam mencionados
 * aqui para não voltarem por engano — e para quem ler isto amanhã saber que
 * não foram esquecidos, foram retirados.
 */
export function CapaComPlaylist({
  project,
  contents,
}: {
  project: Projeto
  contents: ItemIndice[]
}) {
  const logo = project.branding?.logoUrl
  const capa =
    (typeof logo === 'string' && logo) || contents.find((c) => c.coverUrl)?.coverUrl || null

  if (!capa) return null

  return (
    <article className="cartao-publicacao">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="imagem-publicacao" src={capa} alt={project.name} />

      {/* AQUI NÃO HÁ INDICADORES, e isso é a correção de 22/08.

          Havia quatro — olho, coração, balão e seta — com a soma de todas as
          letras. Mas eram números pintados: nenhum deles tinha o que fazer ao
          toque. E logo por cima, no perfil, está uma fila igual que funciona.
          Duas filas iguais no mesmo ecrã, uma viva e outra morta, e a pessoa
          toca na que está sobre a imagem porque é a maior. "O like não
          funciona" não era um botão avariado: era um número que nunca tinha
          sido botão.

          Somar as 26 letras num só coração também não dava para curtir — não
          há nada para curtir numa soma. Quem quer curtir o projecto curte o
          perfil, ali em cima; quem quer curtir uma letra curte a letra. Cada
          coração passa a ter um dono. */}
      <h3 className="titulo-publicacao">{project.name}</h3>
    </article>
  )
}
