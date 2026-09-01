'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * A barra fixa de baixo, com os quatro acessos.
 *
 * Pedida por ele em 24/08, e pedida duas vezes na mesma tarde com a mesma
 * lista: Alfabeto, Produto Vivo, PDF e Suporte. Meu Perfil entrou em 02/09,
 * quando ele descreveu o caminho que faz de verdade. A barra preta que estava em
 * cima sai: ele tinha-a desenhado dois dias antes e concluiu, a usar, que
 * roubava a fotografia de perfil sem dar nada em troca.
 *
 * EM BAIXO E NÃO EM CIMA porque é onde o polegar chega. Numa página que é uma
 * composição contínua da A à Z, a saída tem de estar debaixo da mão de quem
 * segura o telemóvel — em cima obriga a esticar ou a usar as duas mãos, e
 * quem usa isto muitas vezes tem uma criança na outra.
 *
 * O QUE NÃO TEM DESTINO NÃO APARECE. O PDF só aparece quando ele tiver posto o
 * link de venda, e o Suporte só quando houver número configurado. Um botão que
 * não leva a lado nenhum ensina a não tocar nos outros três.
 */
export function BarraInferior({
  projectSlug,
  linkPdf,
}: {
  projectSlug: string
  /** O checkout da Hotmart, quando ele o tiver definido no painel. */
  linkPdf?: string | null
}) {
  const suporte = process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP
  const barra = useRef<HTMLElement | null>(null)

  /**
   * A BARRA NÃO PODE FICAR PRESA A MEIO DO ECRÃ.
   *
   * Ele reportou-a três vezes em 24/08 e mais três em 31/08, e desta vez com
   * uma fotografia: a barra desenhada por cima da arte, a meio da página, com
   * conteúdo a continuar por baixo dela.
   *
   * O que eu tinha aqui era um repinte forçado a cada navegação, e não chegou.
   * Era só metade da ideia: eu mandava o navegador recalcular, mas nunca
   * confirmava o resultado, e por isso quando falhava falhava em silêncio —
   * exactamente o defeito que ele me apontou noutras três coisas este mês.
   *
   * A CAUSA, lida da fotografia dele. A barra está parada a meio do ecrã e o
   * conteúdo continua por baixo. Isso não é a barra a ser empurrada por um
   * antepassado (não há `transform` nem `filter` em nenhum) nem a página a ser
   * mais curta. É a assinatura do teclado do iOS: enquanto o teclado está
   * aberto, a área visível encolhe e o Safari reposiciona os elementos fixos
   * no fundo dessa área menor; quando o teclado fecha, às vezes o Safari não
   * devolve o elemento fixo ao fundo real. Fica onde o teclado acabava. E o
   * caminho dele bate certo: "entro no perfil de outra pessoa, MEXO nesse
   * perfil e depois volto" — mexer num perfil é escrever num comentário, e
   * escrever é abrir o teclado.
   *
   * Por isso deixa de ser um repinte às cegas e passa a ser uma medição:
   * pergunta-se onde a barra ACABA e onde ela DEVIA acabar, e corrige-se a
   * diferença. Se a teoria do teclado estiver errada, isto corrige na mesma,
   * porque não depende da causa — depende do sítio onde ela ficou.
   *
   * SÓ CORRIGE PARA BAIXO, e essa condição é deliberada. Com o teclado ABERTO,
   * o lugar certo da barra é fora do ecrã, por baixo do teclado; puxá-la para
   * cima nessa altura punha-a em cima do campo onde a pessoa está a escrever.
   * O defeito é sempre a barra ficar ALTA de mais, e é só isso que se desfaz.
   */
  const caminho = usePathname()
  useEffect(() => {
    const janela = window.visualViewport

    /** O fundo da área realmente visível, que é onde a barra tem de acabar. */
    const fundoVisivel = () =>
      janela ? janela.height + janela.offsetTop : window.innerHeight

    const conferir = () => {
      const el = barra.current
      if (!el) return
      // Limpar a correcção anterior ANTES de medir. Medir por cima dela seria
      // medir o meu próprio ajuste e ir somando erro a cada evento.
      el.style.transform = ''
      const desvio = el.getBoundingClientRect().bottom - fundoVisivel()
      if (desvio < -2) el.style.transform = `translateY(${-desvio}px)`
    }

    /*
      Duas vezes por evento, e não uma. O Safari devolve a área visível ao
      tamanho normal em passos, com animação, e uma medição tirada no primeiro
      fotograma depois de o teclado fechar ainda apanha o ecrã a meio caminho.
      A segunda passagem é a que fica.
    */
    let adiado: ReturnType<typeof setTimeout> | undefined
    const reagir = () => {
      requestAnimationFrame(conferir)
      clearTimeout(adiado)
      adiado = setTimeout(conferir, 350)
    }

    reagir()

    const alvos: Array<[EventTarget, string]> = [
      [window, 'pageshow'],
      [window, 'orientationchange'],
      [window, 'resize'],
      [document, 'visibilitychange'],
      // `focusout` é o fecho do teclado visto de dentro da página: é o evento
      // que dispara quando o campo de texto deixa de estar activo.
      [document, 'focusout'],
    ]
    if (janela) {
      alvos.push([janela, 'resize'], [janela, 'scroll'])
    }
    for (const [alvo, evento] of alvos) alvo.addEventListener(evento, reagir)

    return () => {
      clearTimeout(adiado)
      for (const [alvo, evento] of alvos) alvo.removeEventListener(evento, reagir)
      if (barra.current) barra.current.style.transform = ''
    }
  }, [caminho])

  return (
    <nav ref={barra} className="barra-inferior" aria-label="Acessos principais">
      <Link href={`/${projectSlug}`} className="item-barra">
        <span className="icone" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.5 9.5V20h13V9.5" />
          </svg>
        </span>
        Alfabeto
      </Link>

      <Link href={`/${projectSlug}/produto-vivo`} className="item-barra">
        <span className="icone marca-pv-barra" aria-hidden>
          PV
        </span>
        Produto Vivo
      </Link>

      {/*
        MEU PERFIL NA BARRA, pedido dele em 02/09.

        A lista de 24/08 era Alfabeto, Produto Vivo, PDF e Suporte, e o perfil
        chegava-se por cima. Agora ele diz o caminho que faz de verdade: "sair
        de qualquer conteúdo e ir imediatamente para Alfabeto, Produto Vivo ou
        Meu Perfil". O perfil é a página onde ele passa mais tempo e era a
        única das três sem botão.

        Leva sempre a `/perfil`. Quem não tiver sessão é levado a entrar e
        volta aqui, que é o que essa página já faz — e é melhor do que esconder
        o botão, porque um botão que aparece e desaparece conforme o estado da
        sessão ensina a não confiar na barra.
      */}
      <Link href={`/${projectSlug}/perfil`} className="item-barra">
        <span className="icone" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
          </svg>
        </span>
        Meu Perfil
      </Link>

      {linkPdf && (
        <a href={linkPdf} target="_blank" rel="noopener noreferrer" className="item-barra">
          <span className="icone" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 3h7l5 5v13H7z" />
              <path d="M14 3v5h5" />
              <path d="M9.5 17v-4h1.6a1.4 1.4 0 0 1 0 2.8H9.5" />
            </svg>
          </span>
          PDF
        </a>
      )}

      {suporte && (
        <a
          href={`https://wa.me/${suporte.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="item-barra"
        >
          <span className="icone" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.94.53 3.75 1.45 5.3L2 22l4.99-1.6a9.8 9.8 0 0 0 5.05 1.38h.01c5.43 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2Zm0 17.97c-1.6 0-3.09-.43-4.37-1.18l-.31-.19-3.24 1.04 1.06-3.16-.2-.32a8.1 8.1 0 0 1-1.25-4.32c0-4.5 3.66-8.16 8.16-8.16 4.51 0 8.17 3.66 8.17 8.16 0 4.51-3.66 8.17-8.17 8.17Zm4.48-6.12c-.25-.12-1.45-.72-1.68-.8-.22-.08-.39-.12-.55.13-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06-.25-.13-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.12-.14.16-.24.25-.41.08-.16.04-.31-.02-.43-.06-.13-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.59.19 1.12.16 1.54.1.47-.07 1.45-.59 1.65-1.17.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28Z" />
            </svg>
          </span>
          Suporte
        </a>
      )}
    </nav>
  )
}
