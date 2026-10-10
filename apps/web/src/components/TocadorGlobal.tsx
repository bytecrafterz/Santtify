'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  alternarOQueToca,
  assinarTocador,
  enderecoDaFaixaAtual,
  faixaAtual,
  lerTocador,
  lerTocadorNoServidor,
  pararTudo,
  tocarSeguinte,
} from '@/lib/tocador-da-pagina'

/**
 * O TOCADOR DA PLATAFORMA INTEIRA (10/10).
 *
 * "Preciso que a música continue tocando enquanto navego por toda a
 * plataforma Santtify (…) A música só deve parar quando eu escolher outra
 * música ou apertar Pausar. Implementar um player global."
 *
 * A música já não pára ao sair da página (ver `tocador-da-pagina.ts`); isto é
 * o que a deixa à mão quando o cartão dela não está à vista: a arte, o nome,
 * pausar, a seguinte, e fechar. Tocar no nome leva de volta à publicação.
 *
 * QUANDO APARECE. Sempre que há uma faixa carregada e o cartão dela não está
 * no ecrã — noutra página, noutro projeto, ou na mesma página mais abaixo.
 * Com o cartão à vista o tocador dele já diz tudo, e duas barras a dizer o
 * mesmo eram ruído. No karaokê não aparece: lá a música é outra, com ecrã
 * inteiro, e a regra de um som de cada vez já pausou esta.
 *
 * Fica por cima do que está preso ao fundo do ecrã — a barra de baixo e, na
 * primeira visita, o aviso de privacidade —, medindo-os, porque a altura deles
 * muda com a área segura do iPhone e com o tamanho do texto. Por baixo do
 * aviso, os botões dele ficavam tapados.
 */
export function TocadorGlobal() {
  const estado = useSyncExternalStore(assinarTocador, lerTocador, lerTocadorNoServidor)
  const caminho = usePathname() ?? ''
  const router = useRouter()
  const [cartaoAVista, definirCartaoAVista] = useState(false)
  const [altoDaBarra, definirAltoDaBarra] = useState(0)

  const faixa = estado.faixaId ? faixaAtual() : null

  /* O cartão da faixa está no ecrã? Procura-o (as letras abrem-se depois de a
     página desenhar) e, achado, segue-o com um IntersectionObserver. */
  useEffect(() => {
    const id = estado.faixaId
    if (!id) return
    let observador: IntersectionObserver | null = null
    let seguido: Element | null = null
    const procurar = () => {
      const el = document.getElementById(`cartao-${id}`)
      if (el === seguido && el?.isConnected) return
      observador?.disconnect()
      seguido = el
      if (!el) {
        definirCartaoAVista(false)
        return
      }
      observador = new IntersectionObserver(
        ([e]) => definirCartaoAVista(Boolean(e?.isIntersecting && e.intersectionRatio > 0.25)),
        { threshold: [0, 0.25, 0.5] },
      )
      observador.observe(el)
    }
    procurar()
    const vez = setInterval(procurar, 1000)
    return () => {
      clearInterval(vez)
      observador?.disconnect()
    }
  }, [estado.faixaId, caminho])

  /* Quanto do fundo do ecrã já está ocupado: a barra de baixo, o aviso de privacidade. */
  useEffect(() => {
    const medir = () => {
      let ocupado = 0
      for (const el of document.querySelectorAll<HTMLElement>('.barra-inferior, .consentimento')) {
        const r = el.getBoundingClientRect()
        if (r.height > 0) ocupado = Math.max(ocupado, window.innerHeight - r.top)
      }
      definirAltoDaBarra(Math.round(ocupado))
    }
    medir()
    const vez = setInterval(medir, 1500)
    window.addEventListener('resize', medir)
    return () => {
      clearInterval(vez)
      window.removeEventListener('resize', medir)
    }
  }, [caminho])

  const visivel = Boolean(faixa) && !cartaoAVista && !caminho.includes('/karaoke')

  /* A página ganha folga em baixo para a barra não tapar o fim do conteúdo. */
  useEffect(() => {
    document.documentElement.classList.toggle('com-tocador-global', visivel)
    return () => document.documentElement.classList.remove('com-tocador-global')
  }, [visivel])

  if (!visivel || !faixa) return null

  const progresso = estado.total > 0 ? Math.min(1, estado.agora / estado.total) : 0
  const abrir = () => {
    const destino = enderecoDaFaixaAtual()
    if (destino) router.push(destino)
  }

  return (
    <div
      className="tocador-global"
      style={{ bottom: altoDaBarra ? `${altoDaBarra + 8}px` : undefined }}
      role="region"
      aria-label="A tocar agora"
    >
      <span className="tg-progresso" aria-hidden style={{ width: `${progresso * 100}%` }} />
      <button type="button" className="tg-abrir" onClick={abrir} aria-label={`Abrir ${faixa.titulo}`}>
        {faixa.capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={faixa.capa} alt="" />
        ) : (
          <span className="tg-sem-capa" aria-hidden>
            ♪
          </span>
        )}
        <span className="tg-texto">
          <strong>{faixa.titulo}</strong>
          {faixa.rotulo && <small>{faixa.rotulo}</small>}
        </span>
      </button>
      <button
        type="button"
        className="tg-botao tg-tocar"
        onClick={alternarOQueToca}
        aria-label={estado.tocando ? 'Pausar' : 'Tocar'}
      >
        {estado.tocando ? (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <button type="button" className="tg-botao" onClick={tocarSeguinte} aria-label="Próxima">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d="M5 5.5v13l9-6.5z" fill="currentColor" />
          <rect x="15.5" y="5.5" width="3" height="13" rx="1" fill="currentColor" />
        </svg>
      </button>
      <button type="button" className="tg-botao tg-fechar" onClick={pararTudo} aria-label="Fechar e parar">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
