'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * A barra fixa de baixo, com os quatro acessos.
 *
 * Pedida por ele em 24/08, e pedida duas vezes na mesma tarde com a mesma
 * lista — Alfabeto, Produto Vivo, PDF e Suporte. A barra preta que estava em
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
   * REPOR A BARRA NO FUNDO DEPOIS DE NAVEGAR.
   *
   * Ele viu-a duas vezes presa a meio do ecrã, a tapar o conteúdo, e sair e
   * voltar àquele ecrã resolvia. Eu não consigo reproduzir: testei quatro
   * páginas em cinco alturas de rolagem cada e ficou colada em todas, e não há
   * transform nem `100vh` em nenhum antepassado que explicasse.
   *
   * Isto é o iOS a não repintar um elemento `fixed` depois de certas
   * navegações e do embalo do dedo. Não é uma teoria que eu goste, mas é a que
   * sobra, e a sugestão dele — "verificar o estado da barra depois da
   * navegação" — é a certa: forçar o navegador a recalcular a posição.
   *
   * Mexer no `transform` e desfazer no fotograma seguinte obriga a esse
   * recálculo sem se ver nada. É barato e não muda nada quando já está no
   * sítio, que é o caso quase sempre. Se voltar a acontecer, sei que a causa é
   * outra e digo-lho.
   */
  const caminho = usePathname()
  useEffect(() => {
    const repor = () => {
      const el = barra.current
      if (!el) return
      el.style.transform = 'translateZ(0)'
      requestAnimationFrame(() => {
        if (barra.current) barra.current.style.transform = ''
      })
    }
    repor()
    window.addEventListener('pageshow', repor)
    document.addEventListener('visibilitychange', repor)
    return () => {
      window.removeEventListener('pageshow', repor)
      document.removeEventListener('visibilitychange', repor)
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
