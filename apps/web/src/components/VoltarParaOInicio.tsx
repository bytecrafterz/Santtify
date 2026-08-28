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
        /*
          DESTINO FIXO, E NÃO `back()`.

          Comecei com `back()`, que parece o mais atencioso, e medi: quem acaba
          de se registar chega ao perfil vindo do FORMULÁRIO DE CADASTRO, e o
          `back()` devolvia-o a esse formulário. Uma pessoa que acabou de criar
          a conta a olhar para "criar conta" é o mesmo defeito de sempre neste
          projecto, o de convidar a entrar quem já entrou.

          O início é o destino certo e é sempre o mesmo. A página do perfil é a
          inicial com a pessoa no topo, portanto voltar ao início é voltar ao
          sítio de onde tudo se alcança.
        */
        router.push(`/${projectSlug}`)
      }}
    >
      <span aria-hidden>←</span> VOLTAR
    </button>
  )
}
