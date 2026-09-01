/**
 * Quando uma faixa acaba, começa a seguinte.
 *
 * Pedido dele em 02/09, e é a segunda vez que o pede: "quando seleciono Todos,
 * a música toca normalmente mas quando termina a reprodução para; o correto é
 * iniciar a próxima, depois a próxima, até terminar a sequência".
 *
 * O que existia era um filtro chamado TODOS, que escolhe QUAIS faixas se veem.
 * Ele leu a palavra como "tocar todas", que é a leitura natural e a que
 * qualquer pessoa faz. Ninguém estava ligado ao fim de uma faixa: o áudio
 * acabava e a página ficava quieta.
 *
 * PORQUE É AQUI E NÃO NUMA PROPRIEDADE PASSADA DE PÁGINA EM PÁGINA. As faixas
 * são desenhadas em quatro sítios diferentes — a letra aberta na página
 * inicial, a página própria da letra, o Produto Vivo e a playlist. Passar uma
 * função por todos eles seria quatro sítios para esquecer, e o esquecido
 * falharia calado, que é o defeito que este projeto já teve de sobra.
 *
 * A SEGUINTE É A SEGUINTE QUE SE VÊ. Se houver um filtro de categoria activo,
 * as faixas escondidas não entram: `checkVisibility` responde pelo que está
 * mesmo pintado, e não pelo que existe no documento. Foi essa a diferença que
 * me enganou em 01/09 a medir um `<details>` fechado.
 */

/** Todos os áudios da página, pela ordem em que se veem. */
function audiosVisiveis(): HTMLAudioElement[] {
  const todos = Array.from(document.querySelectorAll<HTMLAudioElement>('audio[src], audio source'))
    .map((el) => (el.tagName === 'AUDIO' ? el : el.parentElement) as HTMLAudioElement)
    .filter((el): el is HTMLAudioElement => el?.tagName === 'AUDIO')

  // Sem duplicados: um `<audio>` com `<source>` lá dentro aparece duas vezes.
  const unicos = Array.from(new Set(todos))

  return unicos.filter((el) => {
    const caixa = el.closest('.publicacao, .cartao-publicacao, .faixa') ?? el
    if (typeof (caixa as HTMLElement).checkVisibility === 'function') {
      return (caixa as HTMLElement).checkVisibility({ checkVisibilityCSS: true })
    }
    return true
  })
}

/**
 * Toca a faixa a seguir a esta. Devolve `true` se havia uma.
 *
 * Leva a página até ela: continuar a tocar sem mostrar qual é deixa a pessoa a
 * ouvir uma coisa e a olhar para outra.
 */
export function tocarASeguinte(atual: HTMLAudioElement): boolean {
  const lista = audiosVisiveis()
  const i = lista.indexOf(atual)
  if (i < 0 || i + 1 >= lista.length) return false

  const proxima = lista[i + 1]
  const caixa = proxima.closest('.publicacao, .cartao-publicacao, .faixa') ?? proxima
  caixa.scrollIntoView({ behavior: 'smooth', block: 'center' })

  /*
    O `play()` pode ser recusado pelo navegador e devolve uma promessa que
    rejeita. Não é erro nosso e não há nada a fazer com ele: a pessoa carrega no
    play da faixa seguinte, que está agora à vista. Deixar a rejeição sem
    tratamento enchia a consola de quem visita.
  */
  void proxima.play().catch(() => {})
  return true
}
