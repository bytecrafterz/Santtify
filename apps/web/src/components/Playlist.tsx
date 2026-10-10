'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { CategoriaDeAudio, Faixa } from '@/lib/api'
import { plural } from '@/lib/numeros'
import {
  alternarFaixa,
  assinarTocador,
  lerTocador,
  lerTocadorNoServidor,
  tocarDaLista,
  type FaixaATocar,
} from '@/lib/tocador-da-pagina'

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
 * ── E ESSE ELEMENTO É O DA PLATAFORMA (10/10) ──────────────────────────
 *
 * Isto morava numa página só e não seguia a pessoa pelo site — era o que se
 * tinha combinado. Em 10/10 ele pediu o contrário: "a música continua tocando
 * enquanto navego por toda a plataforma". A playlist deixou de ter `<audio>`
 * seu e toca no do tocador global (`tocador-da-pagina.ts`), com a sua própria
 * lista: a seguinte é a seguinte daqui, e no fim pára, como sempre parou. Sair
 * da página já não pára a música; o `TocadorGlobal` mostra-a em baixo.
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
  compacto = false,
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
  /**
   * Embutida por baixo de uma capa que já está à vista.
   *
   * Nesse caso não desenha arte nenhuma: a imagem já está ali em cima, e
   * repeti-la faz aparecer uma segunda fotografia a meio da página quando a
   * pessoa carrega em tocar — foi o que o cliente viu em 21/08.
   */
  compacto?: boolean
}) {
  const [filtro, definirFiltro] = useState<string | null>(filtroInicial)
  /** A faixa escolhida enquanto nada desta lista toca. */
  const [escolhida, definirEscolhida] = useState(0)
  const [erro, definirErro] = useState<string | null>(null)
  const tocador = useSyncExternalStore(assinarTocador, lerTocador, lerTocadorNoServidor)

  // A fila em si. Trocar o filtro reinicia a fila do começo — continuar do
  // índice antigo cairia numa faixa qualquer, porque a numeração muda.
  const fila = useMemo(
    () => (filtro ? faixas.filter((f) => f.categoria === filtro) : faixas),
    [faixas, filtro],
  )
  /** A fila no formato do tocador global, com o que o registo sempre levou. */
  const lista = useMemo<FaixaATocar[]>(
    () =>
      fila.map((f) => ({
        id: f.id,
        url: f.url,
        titulo: f.title,
        rotulo: f.rotulo,
        capa: f.coverUrl,
        contentId: f.contentId,
        categoria: f.categoriaNome ?? f.rotulo ?? null,
        nomeDoBloco: f.rotulo,
        duracaoMs: f.durationMs,
        // O que a playlist sempre registou: de onde veio, a faixa e a categoria.
        rastreio: { origem: 'playlist', faixa: f.rotulo, categoria: f.categoria },
      })),
    [fila],
  )

  /* O que está a tocar, se for desta lista, é a faixa atual; senão, a escolhida. */
  const aTocarAqui = fila.findIndex((f) => f.id === tocador.faixaId)
  const atual = aTocarAqui >= 0 ? aTocarAqui : Math.min(escolhida, Math.max(0, fila.length - 1))
  const tocando = aTocarAqui >= 0 && tocador.tocando
  const faixa = fila[atual] ?? fila[0]

  /*
    COM O TELEFONE BLOQUEADO, A SEGUINTE ENTRA NO MESMO INSTANTE (08/10).

    É o tocador global que o faz agora: a lista vai com a primeira faixa, e no
    fim de cada uma a seguinte entra no mesmo elemento, no próprio `ended`.
  */
  async function carregarETocar(indice: number) {
    if (!lista[indice]) return
    definirEscolhida(indice)
    const comecou = await tocarDaLista(lista, indice, { projectId })
    // O navegador pode recusar em alguns aparelhos. Melhor dizer o que fazer do
    // que deixar a tela parada sem explicação.
    definirErro(comecou ? null : 'Toque em tocar para continuar ouvindo.')
  }

  // Autoplay só existe porque houve um toque humano imediatamente antes — no
  // play da capa. O navegador exige esse gesto, e nós exigimos o mesmo por
  // outra razão: som que começa sem ninguém pedir é a forma mais rápida de
  // alguém fechar a página.
  useEffect(() => {
    if (!autoIniciar) return
    void carregarETocar(0)
    // Só na montagem: reiniciar a cada render voltaria a música ao princípio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function trocarFiltro(novo: string | null) {
    if (novo === filtro) return
    // Pausa só se o que toca é desta lista: a música de outro sítio continua.
    if (aTocarAqui >= 0 && tocador.tocando && faixa) alternarFaixa(lista[atual], { projectId })
    definirEscolhida(0)
    definirFiltro(novo)
  }

  if (faixas.length === 0) {
    return (
      <div className="bloco">
        <p className="bloco-vazio">
          As músicas ainda estão sendo preparadas. Assim que as letras forem publicadas com áudio,
          elas aparecem aqui para tocar em sequência.
        </p>
      </div>
    )
  }

  // Tocar na faixa que já está a tocar recomeça-a do início (ver `tocarDaLista`).
  function irPara(indice: number) {
    if (indice < 0 || indice >= fila.length) return
    void carregarETocar(indice)
  }

  function alternar() {
    // A tocar daqui: pausar ou continuar. Senão, começa pela escolhida.
    if (aTocarAqui >= 0) alternarFaixa(lista[atual], { projectId })
    else void carregarETocar(atual)
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

      <div className="tocador-integrado">
        {/* A arte encosta às bordas e os controlos ficam logo por baixo. O
            cartão grande com "Tocando agora" saiu a pedido dele em 20/08: era
            uma moldura à volta do que interessa, e o que interessa é a
            imagem. */}
        {/* As medidas reais guardam o espaço exacto da arte enquanto ela
            carrega. Antes era uma moldura de 3/4 que cortava tudo o que não
            fosse retrato. */}
        {!compacto && faixa.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="capa-tocador sangria"
            src={faixa.coverUrl}
            alt={faixa.title}
            width={faixa.arteLargura ?? undefined}
            height={faixa.arteAltura ?? undefined}
          />
        )}
        <div className="linha-faixa">
          <div>
            <strong>{faixa.title}</strong>
            {faixa.rotulo && <small> · {faixa.rotulo}</small>}
          </div>
          <small className="nota">
            {atual + 1} de {fila.length}
          </small>
        </div>

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
