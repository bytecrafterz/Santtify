'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { CategoriaDeAudio, Faixa } from '@/lib/api'
import { rastrear } from '@/lib/track'
import { plural } from '@/lib/numeros'

/**
 * "Reproduzir todas": as músicas do projeto tocando em sequência, do A ao Z.
 *
 * Combinado com o cliente em 13/08. Sem desbloqueio diário e sem estados de
 * bloqueio — isso era o Bloco 1 e ficou para depois. Aqui é só o tocador.
 *
 * DECISÃO: **um único elemento de áudio para a fila inteira**, trocando a fonte
 * a cada faixa, em vez de um elemento por música. No celular, o navegador só
 * deixa tocar som depois de um toque da pessoa, e essa permissão fica presa ao
 * elemento que ela tocou. Com 26 elementos, a primeira música tocaria e a
 * segunda seria bloqueada em silêncio — o defeito clássico deste tipo de tela,
 * e que só aparece no aparelho de verdade, nunca no computador.
 *
 * A tela mora numa página só e não segue a pessoa pelo site. Áudio que
 * atravessa a navegação exige o tocador no layout e estado global; o cliente
 * pediu a experiência simples, e simples aqui também significa menos coisa
 * para quebrar no celular da mãe.
 *
 * FILTRO POR CATEGORIA (14/08): cada letra passa a ter vários áudios —
 * explicação, música, memorização, oração — e a pessoa escolhe o que quer
 * ouvir de A a Z. A filtragem é feita aqui, na tela, com a lista inteira já
 * carregada: são poucas dezenas de faixas, e assim trocar de "só músicas" para
 * "só explicações" é instantâneo, sem esperar o servidor.
 */
export function Playlist({
  projectId,
  projectSlug,
  categorias,
  faixas,
  filtroInicial = null,
  mostrarFiltros = true,
  autoIniciar = false,
}: {
  projectId: string
  projectSlug: string
  categorias: CategoriaDeAudio[]
  faixas: Faixa[]
  /** Escolha já feita na página inicial, quando a pessoa clicou "Só músicas". */
  filtroInicial?: string | null
  /**
   * Embutida na página do perfil, os filtros vivem lá fora e são partilhados
   * com a capa. Duas fileiras de filtros na mesma tela, a dizer o mesmo, é
   * como a pessoa perde a confiança no que está a carregar.
   */
  mostrarFiltros?: boolean
  /** Começa a tocar sozinha: só quando alguém tocou no play da capa. */
  autoIniciar?: boolean
}) {
  const [filtro, definirFiltro] = useState<string | null>(filtroInicial)
  const audio = useRef<HTMLAudioElement>(null)
  const [atual, definirAtual] = useState(0)
  const [tocando, definirTocando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  /**
   * Só toca sozinho quando a pessoa PEDIU para tocar.
   *
   * A intenção é registrada explicitamente, e não deduzida de "já montei uma
   * vez". A primeira versão usava um contador de montagem e tocava som ao abrir
   * a página: em desenvolvimento o React monta os efeitos duas vezes de
   * propósito, a segunda passagem via o contador já marcado e mandava tocar.
   * Ninguém tinha pedido música nenhuma.
   *
   * É `ref` e não estado porque pausar não pode reiniciar a faixa: se entrasse
   * na lista de dependências, o efeito rodaria de novo e voltaria a música
   * para o começo a cada pausa.
   */
  const querTocar = useRef(false)

  // Autoplay só existe porque houve um toque humano imediatamente antes — no
  // play da capa. O navegador exige esse gesto, e nós exigimos o mesmo por
  // outra razão: som que começa sem ninguém pedir é a forma mais rápida de
  // alguém fechar a página.
  useEffect(() => {
    if (!autoIniciar) return
    querTocar.current = true
    const el = audio.current
    if (!el) return
    void el.play().then(
      () => definirTocando(true),
      () => definirErro('Toque em tocar para começar.'),
    )
    // Só na montagem: reiniciar a cada render voltaria a música ao princípio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!querTocar.current) return
    const el = audio.current
    if (!el) return
    el.load()
    void el
      .play()
      .then(() => definirErro(null))
      .catch(() => {
        // O navegador pode recusar em alguns aparelhos. Melhor dizer o que
        // fazer do que deixar a tela parada sem explicação.
        querTocar.current = false
        definirTocando(false)
        definirErro('Toque em tocar para continuar ouvindo.')
      })
  }, [atual])

  // A fila em si. Trocar o filtro reinicia a fila do começo — continuar do
  // índice antigo cairia numa faixa qualquer, porque a numeração muda.
  const fila = filtro ? faixas.filter((f) => f.categoria === filtro) : faixas

  function trocarFiltro(novo: string | null) {
    if (novo === filtro) return
    const el = audio.current
    if (el) el.pause()
    querTocar.current = false
    definirTocando(false)
    definirAtual(0)
    definirFiltro(novo)
  }

  if (faixas.length === 0) {
    return (
      <div className="bloco">
        <p className="bloco-vazio">
          As músicas ainda estão sendo preparadas. Assim que as letras forem publicadas com
          áudio, elas aparecem aqui para tocar em sequência.
        </p>
      </div>
    )
  }

  const faixa = fila[atual] ?? fila[0]

  function irPara(indice: number) {
    if (indice < 0 || indice >= fila.length) return
    querTocar.current = true
    // Tocar na faixa que já está tocando não muda o índice, então o efeito não
    // roda: aqui ela recomeça do início, que é o que a pessoa espera.
    if (indice === atual) {
      const el = audio.current
      if (el) {
        el.currentTime = 0
        void el.play().catch(() => definirErro('Não foi possível tocar agora.'))
      }
      return
    }
    definirAtual(indice)
    definirTocando(true)
  }

  function alternar() {
    const el = audio.current
    if (!el) return
    if (el.paused) {
      querTocar.current = true
      void el.play().then(
        () => {
          definirTocando(true)
          definirErro(null)
        },
        () => definirErro('Não foi possível tocar agora.'),
      )
    } else {
      querTocar.current = false
      el.pause()
      definirTocando(false)
    }
  }

  return (
    <>
      {mostrarFiltros && categorias.length > 1 && (
        <div className="filtros-playlist" role="group" aria-label="O que ouvir">
          <button
            type="button"
            className={filtro === null ? 'filtro atual' : 'filtro'}
            onClick={() => trocarFiltro(null)}
          >
            Ouvir tudo
          </button>
          {categorias.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={filtro === c.slug ? 'filtro atual' : 'filtro'}
              onClick={() => trocarFiltro(c.slug)}
            >
              Só {plural(c.nome).toLocaleLowerCase('pt')}
            </button>
          ))}
        </div>
      )}

      <div className="bloco tocador">
        <span className="bloco-rotulo">Tocando agora</span>
        {/* A arte troca junto com a faixa. É o que faz "só memorizações" ficar
            visualmente coerente da letra A à Z. */}
        {faixa.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="arte-tocador" src={faixa.coverUrl} alt={faixa.title} />
        )}
        <p className="tocador-titulo">
          {faixa.title}
          {faixa.subtitle && <small> — {faixa.subtitle}</small>}
        </p>
        {faixa.rotulo && <p className="tocador-rotulo">{faixa.rotulo}</p>}
        <p className="nota">
          {atual + 1} de {fila.length}
        </p>

        <audio
          ref={audio}
          preload="metadata"
          onPlay={() => {
            definirTocando(true)
            // contentId, e não faixa.id: desde que a fila passou a ser por
            // faixa, `id` é o do BLOCO. Registrar o bloco aqui apontaria o
            // evento para um conteúdo que não existe, e "conteúdos mais
            // acessados" ficaria em branco sem nenhum erro aparecer na tela.
            void rastrear({
              projectId,
              contentId: faixa.contentId,
              type: 'MEDIA_PLAY',
              // blockId vai junto: sem ele, tocar pela playlist não contava para as
              // visualizações daquela faixa, e a playlist é onde mais se ouve.
              // O número por faixa ficava a mentir sem nada acusar erro.
              props: {
                origem: 'playlist',
                blockId: faixa.id,
                faixa: faixa.rotulo,
                categoria: faixa.categoria,
              },
            })
          }}
          onPause={() => definirTocando(false)}
          onEnded={() => {
            void rastrear({
              projectId,
              contentId: faixa.contentId,
              type: 'MEDIA_COMPLETE',
              // blockId vai junto: sem ele, tocar pela playlist não contava para as
              // visualizações daquela faixa, e a playlist é onde mais se ouve.
              // O número por faixa ficava a mentir sem nada acusar erro.
              props: {
                origem: 'playlist',
                blockId: faixa.id,
                faixa: faixa.rotulo,
                categoria: faixa.categoria,
              },
            })
            // Fim da fila: para, e não volta ao início. Recomeçar sozinho do A
            // depois do Z deixaria a música tocando sem ninguém pedir.
            if (atual + 1 < fila.length) irPara(atual + 1)
            else {
              querTocar.current = false
              definirTocando(false)
            }
          }}
          onError={() => definirErro('Não foi possível carregar esta música.')}
        >
          <source src={faixa.url} type={faixa.mimeType ?? undefined} />
        </audio>

        {erro && <p className="erro">{erro}</p>}

        <div className="tocador-controles">
          <button
            type="button"
            className="secundario"
            onClick={() => irPara(atual - 1)}
            disabled={atual === 0}
            aria-label="Música anterior"
          >
            ◀◀
          </button>
          <button type="button" onClick={alternar} aria-label={tocando ? 'Pausar' : 'Tocar'}>
            {tocando ? '❚❚  Pausar' : '▶  Tocar'}
          </button>
          <button
            type="button"
            className="secundario"
            onClick={() => irPara(atual + 1)}
            disabled={atual === fila.length - 1}
            aria-label="Próxima música"
          >
            ▶▶
          </button>
        </div>
      </div>

      <h2>Todas as músicas</h2>

      <ul className="lista lista-faixas">
        {fila.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              className={i === atual ? 'faixa atual' : 'faixa'}
              onClick={() => irPara(i)}
            >
              <span className="faixa-numero" aria-hidden>
                {i === atual && tocando ? '♪' : i + 1}
              </span>
              <span className="faixa-nome">
                <strong>{f.title}</strong>
                {/* Sem filtro, a mesma letra aparece mais de uma vez: o rótulo
                    é o que diz qual das faixas é qual. */}
                <small>{filtro ? f.subtitle : (f.rotulo ?? f.subtitle)}</small>
              </span>
            </button>
            <Link className="faixa-abrir" href={`/${projectSlug}/${f.slug}`}>
              abrir
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
