'use client'

import { useEffect, useRef, useState } from 'react'
import type { Bloco } from '@/lib/api'
import { rastrear } from '@/lib/track'
import { social } from '@/lib/social'
import { tocarASeguinte } from '@/lib/tocar-em-sequencia'
import { useSyncExternalStore } from 'react'
import {
  assinarCategoriaATocar,
  definirCategoriaATocar,
  definirCategoriaEscolhida,
  lerCategoriaATocar,
  lerCategoriaNoServidor,
} from '@/lib/categoria-a-tocar'

/**
 * O tocador escuro com a onda, colado à imagem de cima.
 *
 * Saiu do cartão para viver sozinho porque uma publicação pode ter mais do que
 * um áudio — a Introdução tem a oração e a memorização — e todos têm de caber
 * dentro do mesmo cartão, um por baixo do outro.
 *
 * As alturas das barras vêm do id da faixa e não de aleatório: com aleatório a
 * onda mudava a cada redesenho e parecia tremer com o áudio parado.
 *
 * A onda NÃO é a onda real do ficheiro. Desenhá-la a sério obrigava a
 * descarregar e descodificar o áudio inteiro antes de tocar, e isso gasta os
 * dados de quem está a ouvir e atrasa o play.
 */
function ondaDe(id: string, quantas = 42): number[] {
  let semente = 0
  for (let i = 0; i < id.length; i++) semente = (semente * 31 + id.charCodeAt(i)) % 100000
  return Array.from({ length: quantas }, (_, i) => {
    semente = (semente * 1103515245 + 12345) % 2147483648
    const base = (semente / 2147483648) * 0.7 + 0.3
    const arco = 1 - Math.abs(i - quantas / 2) / (quantas * 1.6)
    return Math.max(0.18, base * arco)
  })
}

function tempo(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '00:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/**
 * As categorias vinham escritas aqui, à mão, e era esse o defeito.
 *
 * Ele criou "Música Alegre" no painel e perguntou-me porque não aparecia no
 * filtro. Não aparecia porque este ficheiro tinha cinco nomes fixos e nunca
 * olhou para as categorias do projecto. Ele assumiu um comportamento que eu
 * nunca construí, e a pergunta ficou sem resposta enquanto eu corria atrás de
 * outras coisas.
 *
 * Agora a lista vem de quem usa o tocador, que a foi buscar ao projecto.
 * "TODOS" continua a ser nosso: não é uma categoria, é a ausência de filtro.
 */
const TODOS = 'TODOS'

export function TocadorDeOnda({
  bloco,
  projectId,
  contentId,
  rotulo,
  aoTerminar,
  categoria,
  categorias = [],
  aoEscolherCategoria,
}: {
  bloco: Bloco
  projectId: string
  contentId: string
  /** Só quando a publicação tem mais de um áudio: aí é preciso distingui-los. */
  rotulo: string | null
  aoTerminar?: () => void
  /** A categoria escolhida, quando quem usa o tocador quer filtrar. */
  categoria?: string | null
  /** As categorias do projeto, tal como ele as criou no painel. */
  categorias?: Array<{ slug: string; name: string }>
  aoEscolherCategoria?: (categoria: string | null) => void
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [tocando, definirTocando] = useState(false)
  const [menuAberto, definirMenuAberto] = useState(false)
  /* Qual categoria está a tocar na página, seja em que tocador for. */
  const aTocar = useSyncExternalStore(
    assinarCategoriaATocar,
    lerCategoriaATocar,
    lerCategoriaNoServidor,
  )
  /**
   * Quantas vezes esta faixa foi tocada.
   *
   * Ele pediu em 29/08 "algo pequeno e discreto próximo aos três pontinhos,
   * mostrando o número real de reproduções sem poluir o layout". O dado já
   * existia desde sempre: o tocador emite MEDIA_PLAY e ninguém lhe perguntava.
   *
   * Buscado depois da primeira pintura e não antes: este número é o menos
   * importante do ecrã e não pode atrasar o botão de tocar. Enquanto não
   * chega, não se desenha nada — um zero a piscar seria pior do que o silêncio.
   */
  const [reproducoes, definirReproducoes] = useState<number | null>(null)

  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      void social
        .estadoDaFaixa(bloco.id)
        .then((e) => {
          if (vivo && typeof e.reproducoes === 'number') definirReproducoes(e.reproducoes)
        })
        .catch(() => {})
    }, 600)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [bloco.id])
  const [agora, definirAgora] = useState(0)
  const [total, definirTotal] = useState(0)

  const onda = ondaDe(bloco.id)
  const progresso = total > 0 ? agora / total : 0

  function alternar() {
    const el = audio.current
    if (!el) return
    if (el.paused) void el.play().catch(() => {})
    else el.pause()
  }

  return (
    <>
      {rotulo && <span className="rotulo-faixa">{rotulo}</span>}

      <div className={tocando ? 'player-onda a-tocar' : 'player-onda'}>
        <button
          type="button"
          className="botao-play"
          onClick={alternar}
          aria-label={tocando ? 'Pausar' : 'Tocar'}
        >
          {tocando ? '❚❚' : '▶'}
        </button>

        <span className="tempo">{tempo(agora)}</span>

        <button
          type="button"
          className="onda"
          aria-label="Avançar no áudio"
          onClick={(e) => {
            const el = audio.current
            if (!el || !total) return
            const caixa = e.currentTarget.getBoundingClientRect()
            el.currentTime = ((e.clientX - caixa.left) / caixa.width) * total
          }}
        >
          {onda.map((h, i) => (
            <span
              key={i}
              className={i / onda.length <= progresso ? 'barra ouvida' : 'barra'}
              style={{ height: `${h * 100}%`, animationDelay: `${(i % 7) * 0.09}s` }}
            />
          ))}
        </button>

        <span className="tempo">{tempo(total)}</span>

        {/* OS TRÊS PONTOS DEIXAM DE DESCARREGAR O FICHEIRO.
            Isto era um link com `download`, e num iPhone o Safari respondia
            com a sua própria caixa a perguntar se queria guardar o MP3 —
            oferecendo o áudio dele a quem tocasse por curiosidade. Ele
            fotografou-a em 24/08 e tem razão: o tocador é para ouvir aqui.
            Fica um botão nosso, que abre o menu das categorias. */}
        <button
          type="button"
          className="menu-player"
          aria-label="Escolher categoria"
          aria-expanded={menuAberto}
          onClick={(ev) => {
            ev.stopPropagation()
            definirMenuAberto((v) => !v)
          }}
        >
          ⋮
        </button>

        {/* Ao lado dos três pontos, como ele pediu. Só aparece quando já houve
            pelo menos uma reprodução: um "0 reproduções" por baixo de cada
            música é ruído em toda a página e não diz nada a ninguém. */}
        {reproducoes !== null && reproducoes > 0 && (
          <span className="reproducoes-faixa" title={`${reproducoes} reproduções`}>
            <span aria-hidden>▶</span> {reproducoes}
          </span>
        )}

        {menuAberto && (
          <div className="menu-categorias" role="menu">
            {[TODOS, ...categorias.map((c) => c.name.toUpperCase())].map((c) => (
              <button
                key={c}
                type="button"
                /*
                  DUAS COISAS DIFERENTES, E DUAS MARCAS DIFERENTES.
                  `activa` é o filtro que a pessoa escolheu: o que ela VÊ.
                  `a-tocar` é o que está a sair pelo altifalante agora. Com uma
                  faixa a tocar, é essa que fica azul de fora a fora; sem nada a
                  tocar, fica a escolha dela, que por omissão é TODOS.
                */
                className={
                  [
                    // Sem filtro escolhido, a escolha é TODOS: `categoria` vem
                    // `null` e comparar `null === 'TODOS'` não marcava nada.
                    (categoria ?? TODOS) === c ? 'activa' : '',
                    (aTocar ? aTocar === c : (categoria ?? TODOS) === c) ? 'a-tocar' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onClick={(ev) => {
                  ev.stopPropagation()
                  definirMenuAberto(false)
                  aoEscolherCategoria?.(c === TODOS ? null : c)
                  /*
                    ESCOLHER TAMBÉM MOVE A FAIXA AZUL.

                    Ele apanhou isto em 02/09: "agora EXPLICAÇÃO fica azul, mas
                    não consigo mudar manualmente". Tinha razão. Assim que uma
                    faixa começava a tocar, o azul passava a seguir só o que
                    estava a sair pelo altifalante e ignorava o que ele
                    escolhia. Tocar em MÚSICA não mexia em nada.

                    O azul segue a ÚLTIMA COISA QUE ACONTECEU, seja ela o dedo
                    dele ou a faixa seguinte a começar sozinha. É o que ele
                    descreveu das duas vezes que falou disto, e as duas frases
                    não se contradizem: uma diz quem manda quando ele escolhe, a
                    outra quem manda quando ele não faz nada.
                  */
                  definirCategoriaATocar(c)
                  /* E a ESCOLHA, que é o que manda na sequência. Só muda aqui,
                     no dedo dele, e não quando uma faixa começa. */
                  definirCategoriaEscolhida(c === TODOS ? null : c)
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <audio
          ref={audio}
          preload="metadata"
          // O menu nativo do navegador também oferece "descarregar". Isto
          // tira-lhe essa entrada; não é uma tranca — nada impede alguém de
          // ir buscar o endereço — mas deixa de estar à mão de quem só quer
          // ouvir, que é o que ele pediu.
          controlsList="nodownload"
          onContextMenu={(ev) => ev.preventDefault()}
          onLoadedMetadata={(e) => definirTotal(e.currentTarget.duration)}
          onTimeUpdate={(e) => definirAgora(e.currentTarget.currentTime)}
          onPlay={() => {
            definirTocando(true)
            /* Diz à página inteira o que está a tocar. É o que faz a faixa azul
               acompanhar quando o áudio avança sozinho para a faixa seguinte. */
            /*
              A CATEGORIA, E SE NÃO HOUVER, O NOME DA CASA.

              Ele testou e a faixa azul ficava sempre em TODOS. A razão está nos
              dados dele: das 127 faixas, só 16 têm categoria escolhida no
              painel. Sem categoria eu não tinha o que acender e caía em TODOS.

              O nome da casa — Explicação, Música, Oração — é o que ele lê na
              lista e é o mesmo nome das categorias que ele criou. Serve de
              segunda fonte quando a primeira está vazia, e o resultado é o que
              ele descreveu: toca a oração, ORAÇÃO fica azul.

              Continua a valer a pena escolher a categoria no painel, e é o que
              lhe vou dizer: aí a faixa acende mesmo quando o nome da casa e o
              da categoria são diferentes, como em "Repetição do versículo", que
              é da categoria Memorização.
            */
            definirCategoriaATocar(
              bloco.categoriaNome ?? bloco.label ?? categoria ?? null,
            )
            void rastrear({
              projectId,
              contentId,
              type: 'MEDIA_PLAY',
              props: { bloco: bloco.label, blockId: bloco.id },
            })
          }}
          onPause={() => definirTocando(false)}
          onEnded={() => {
            definirTocando(false)
            /*
              O NÚMERO SOBE NO ECRÃ, NO INSTANTE EM QUE A MÚSICA ACABA.

              O número era buscado uma vez ao abrir a página e nunca mais. Ele
              ouvia a música até ao fim, o servidor registava, e no ecrã não
              mexia nada até recarregar — por isso disse "eu termino de ouvir e
              o número não muda". O registo estava certo; era o ecrã que não
              contava.

              Somado aqui e não pedido outra vez ao servidor: a pessoa acabou de
              o fazer, sabemos que aconteceu, e uma ida à rede para confirmar o
              que acabámos de causar só serve para o número aparecer tarde.
            */
            definirReproducoes((n) => (n ?? 0) + 1)
            void rastrear({
              projectId,
              contentId,
              type: 'MEDIA_COMPLETE',
              props: { bloco: bloco.label, blockId: bloco.id },
            })
            aoTerminar?.()
            /*
              E SEGUE PARA A SEGUINTE.
              Pedido dele em 02/09, pela segunda vez. Fica aqui, no fim de
              qualquer faixa, e não numa propriedade que quatro páginas teriam
              de passar: a que se esquecesse falhava calada.
            */
            if (audio.current) void tocarASeguinte(audio.current)
          }}
        >
          <source src={bloco.asset?.url} type={bloco.asset?.mimeType ?? undefined} />
        </audio>
      </div>
    </>
  )
}
