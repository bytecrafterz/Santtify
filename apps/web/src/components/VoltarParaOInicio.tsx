'use client'

import { useRouter } from 'next/navigation'

/**
 * O caminho de saída do perfil.
 *
 * Ele pediu isto em 28/08 e a razão é a mesma do VOLTAR do cartão: dentro da
 * aplicação instalada no telemóvel não existe barra do navegador, e sem barra
 * não existe seta para trás. Quem entra no perfil pela aplicação fica lá até
 * fechar tudo.
 *
 * Fica como primeiro elemento da página, e não no fim, porque a página do
 * perfil tem a plataforma inteira por baixo: um botão de voltar a mil pixels
 * do topo é um botão que ninguém encontra. Foi exactamente esse o defeito do
 * Cancelar do formulário de edição em 27/08.
 */
export function VoltarParaOInicio({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      className="voltar-do-perfil"
      onClick={() => {
        // `back()` devolve a pessoa a onde ela estava. Quem abriu o perfil
        // directamente pelo endereço não tem histórico, e aí há destino fixo.
        if (window.history.length > 1) router.back()
        else router.push(`/${projectSlug}`)
      }}
    >
      <span aria-hidden>←</span> VOLTAR
    </button>
  )
}
