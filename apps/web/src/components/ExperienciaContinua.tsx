'use client'

import { useEffect, useRef, useState } from 'react'
import type { ItemIndice, PaginaConteudo, ProgressoDasLetras } from '@/lib/api'
import { PublicacaoDaLetra } from './PublicacaoDaLetra'
import { CartaoDeImpressao } from './CartaoDeImpressao'
import { rastrear } from '@/lib/track'
import { publicacoesDe } from '@/lib/publicacoes-da-letra'

/**
 * O alfabeto e a letra aberta, tudo na mesma tela.
 *
 * Regra que o cliente fixou em 20/08 e que manda em todo este ficheiro: a
 * pessoa entra no perfil e não sai dele. Tocar numa letra não a leva a lado
 * nenhum — o conteúdo aparece por baixo da grade, ali mesmo.
 *
 * As páginas próprias de cada letra continuam a existir e não vão desaparecer:
 * é para elas que os QR Codes impressos apontam, e um QR Code impresso não se
 * pode corrigir depois. O que muda é que, quem já está dentro, nunca precisa
 * de as visitar.
 *
 * A letra é buscada ao servidor só quando alguém a escolhe, e fica guardada
 * depois disso. Carregar as 26 de uma vez seria dezenas de áudios e artes que
 * quase ninguém vai ouvir — no telemóvel da mãe isso é dinheiro de dados dela.
 */
/** As 26 casas, sempre as mesmas e sempre nesta ordem. */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function ExperienciaContinua({
  projectSlug,
  projectId,
  contents,
  progresso,
  categorias = [],
}: {
  projectSlug: string
  projectId: string
  contents: ItemIndice[]
  progresso: ProgressoDasLetras
  /** As categorias do projeto, para o filtro do tocador. */
  categorias?: Array<{ slug: string; name: string }>
}) {
  const [escolhida, definirEscolhida] = useState<string | null>(null)
  const [cache, definirCache] = useState<Record<string, PaginaConteudo>>({})
  /* O espelho da cache, para quem lê de dentro de um ouvinte registado uma vez. */
  const cacheRef = useRef<Record<string, PaginaConteudo>>({})
  cacheRef.current = cache
  const [carregando, definirCarregando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const destino = useRef<HTMLDivElement>(null)
  /** A publicação que o endereço pediu, enquanto ainda não foi mostrada. */
  const pedida = useRef<string | null>(null)

  /**
   * Leva a página até uma publicação e acende-a por um instante.
   *
   * Chegar ao sítio certo não chega: numa página comprida, quem recebe o link
   * precisa de ver QUAL das publicações lhe mandaram.
   */
  function levarAte(blockId: string) {
    const el = document.getElementById(`cartao-${blockId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('publicacao-apontada')
    const t = setTimeout(() => el.classList.remove('publicacao-apontada'), 4000)
    return () => clearTimeout(t)
  }

  const porcento = progresso.total ? (progresso.liberadas / progresso.total) * 100 : 0
  const aberta = escolhida ? cache[escolhida] : null

  async function escolher(item: ItemIndice) {
    if (!item.publicado) return
    definirErro(null)
    definirEscolhida(item.slug)

    /**
     * A PÁGINA FICA NUMA VARIÁVEL, e não só na cache.
     *
     * `cache` é estado do React: preenchê-la com `definirCache` só a torna
     * legível no render seguinte. Ler `cache[item.slug]` mais abaixo devolvia
     * `undefined`, e por isso as visualizações por cartão não eram contadas de
     * todo. Não dava erro nenhum — o ciclo simplesmente não corria, e o olho
     * ficava a zero por mais vezes que a letra fosse aberta.
     */
    /*
      A CACHE VEM DE UMA REFERÊNCIA, e não da variável desta renderização.

      `escolher` é chamada também de dentro de um ouvinte de evento registado
      uma vez. Esse ouvinte guarda a versão de `escolher` da PRIMEIRA
      renderização, cuja `cache` está vazia para sempre — e por isso uma letra
      já carregada era buscada outra vez ao servidor.

      O efeito disso era invisível até a sequência dar a volta ao alfabeto: a
      letra aparecia logo, vinda da cache, a faixa começava a tocar, e segundos
      depois a resposta do servidor substituía o desenho inteiro. O elemento que
      estava a tocar era destruído e o som parava sem nada a explicar. Era o que
      ele via como "no final não continuou".
    */
    let pagina = cacheRef.current[item.slug]
    if (!pagina) {
      definirCarregando(true)
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? ''}/projects/${projectSlug}/contents/${item.slug}`,
        )
        if (!res.ok) throw new Error('falhou')
        const dados = (await res.json()) as PaginaConteudo
        pagina = dados
        definirCache((c) => ({ ...c, [item.slug]: dados }))
      } catch {
        definirErro('Não foi possível abrir esta letra agora.')
        definirCarregando(false)
        return
      }
      definirCarregando(false)
    }

    // A visita conta na mesma: quem abre a letra aqui dentro está a ver a letra
    // tanto como quem lá chega pelo QR Code. Sem isto, quanto melhor ficasse a
    // experiência contínua, menos a plataforma saberia sobre o que é visto.
    void rastrear({
      projectId,
      contentId: item.id,
      type: 'CONTENT_VIEW',
      props: { origem: 'perfil' },
    })

    /**
     * UMA VISUALIZAÇÃO POR CARTÃO, quando a letra é aberta.
     *
     * Regra dele, de 25/08: "entrou efetivamente no conteúdo = 1 view; saiu e
     * abriu novamente = nova view". Conta-se ao ABRIR a letra e não ao rolar,
     * que é o cuidado que ele próprio pediu — quem sobe e desce a mesma página
     * não gera dezenas de visualizações, porque não há aqui nenhum contador
     * ligado ao gesto de rolar.
     *
     * Sai depois do evento da letra e não bloqueia nada: falhar a contar não
     * pode impedir a letra de abrir.
     */
    if (pagina) {
      for (const b of pagina.content.blocks) {
        if (b.type !== 'AUDIO') continue
        void rastrear({
          projectId,
          contentId: item.id,
          type: 'CONTENT_VIEW',
          // O bloco vai dentro de `props`, que é onde o servidor o procura.
          props: { blockId: b.id, origem: 'abriu-a-letra' },
        })
      }
    }
  }

  // Depois de a letra chegar, leva a pessoa até ela. Sem isto o conteúdo abre
  // fora do ecrã e parece que o toque não fez nada.
  useEffect(() => {
    if (!aberta) return
    // Quem veio por um link de publicação vai para a publicação, e não para o
    // topo da letra: o segundo apagava o primeiro, e ficava tudo igual a antes.
    if (pedida.current) return
    destino.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [aberta])

  /*
    A SEQUÊNCIA ATRAVESSA DE UMA LETRA PARA A OUTRA.

    Pedido dele em 02/09: escolher Explicação e ouvir a Explicação da A, depois
    a da B, depois a da C. Quando a faixa seguinte da categoria está noutra
    letra, `tocar-em-sequencia` não a encontra no ecrã e pede-a por aqui.

    ABRE A LETRA SEM SAIR DA PÁGINA, que é o que esta tela já sabe fazer desde
    20/08 e a razão de ela existir: "a pessoa entra no perfil e não sai dele".
    Levá-la a outro endereço para continuar a ouvir seria desfazer isso para
    resolver outra coisa.
  */
  const faixaPedida = useRef<string | null>(null)
  useEffect(() => {
    const ouvir = (ev: Event) => {
      const { slug, blockId } = (ev as CustomEvent).detail ?? {}
      if (!slug || !blockId) return
      const item = contents.find((c) => c.slug === slug)
      if (!item?.publicado) return
      faixaPedida.current = blockId
      void escolher(item)
    }
    window.addEventListener('pv:tocar-faixa', ouvir)
    return () => window.removeEventListener('pv:tocar-faixa', ouvir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contents])

  /*
    QUANDO A LETRA CHEGA, TOCA A FAIXA QUE A SEQUÊNCIA PEDIU.

    INSISTE ATÉ O ELEMENTO EXISTIR, em vez de tentar uma vez ao fim de 600ms.
    Abrir uma letra é um pedido à rede mais o desenho da página, e 600ms era um
    número que eu escolhi sem medir nada. Nas letras que já estavam em cache
    chegava; na volta ao princípio, não — e a sequência morria calada no fim do
    alfabeto, que foi o que ele viu como "no final não continuou".

    Desiste ao fim de oito segundos. Se a letra não chegou até aí, insistir mais
    é começar uma música muito depois de a anterior ter acabado, com a pessoa já
    a olhar para outra coisa.
  */
  useEffect(() => {
    const alvo = faixaPedida.current
    if (!aberta || !alvo) return
    faixaPedida.current = null

    let parado = false
    let tentativas = 0
    const tentar = () => {
      if (parado) return
      const audio = document.querySelector<HTMLAudioElement>(`#cartao-${alvo} audio`)
      if (audio) {
        const caixa = audio.closest('.publicacao') ?? audio
        caixa.scrollIntoView({ behavior: 'smooth', block: 'center' })
        void audio.play().catch(() => {})
        return
      }
      if (++tentativas < 32) setTimeout(tentar, 250)
    }
    const inicio = setTimeout(tentar, 250)
    return () => {
      parado = true
      clearTimeout(inicio)
    }
  }, [aberta])

  /*
    ABRIR A PUBLICAÇÃO QUE O ENDEREÇO PEDE.

    `?letra=e&pub=<id>` é o que sai do botão de compartilhar. Corre uma vez, na
    entrada, e só se a letra existir e estiver publicada — um endereço colado à
    mão com uma letra que não existe não pode deixar a página em branco.
  */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const letra = q.get('letra')
    const pub = q.get('pub')
    if (!letra) return
    const item = contents.find((c) => c.slug === letra)
    if (!item?.publicado) {
      /*
        A INTRODUÇÃO NÃO É UMA LETRA, e o link dela vem pelo mesmo caminho.

        Os cartões da introdução são desenhados nesta página, fora da grade das
        letras, e por isso já estão no documento quando ela abre. Não há letra
        para abrir: há um sítio para onde ir. Sem isto, quem recebia um link da
        introdução caía no topo e tinha de a procurar.
      */
      if (pub) levarAte(pub)
      return
    }
    pedida.current = pub
    void escolher(item)
    // Só à entrada: se corresse a cada render, tocar noutra letra seria
    // desfeito pelo endereço e a pessoa ficava presa nesta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
    E LEVA A PESSOA ATÉ ELA, com um realce curto.

    Sem o realce, quem recebe o link cai a meio de uma página comprida sem
    saber qual das publicações é a que lhe mandaram. É a mesma correcção que o
    duplicar levou em 31/08: chegar ao sítio certo não chega, é preciso ver-se
    que se chegou.
  */
  useEffect(() => {
    const alvo = pedida.current
    if (!aberta || !alvo) return
    pedida.current = null
    return levarAte(alvo)
  }, [aberta])

  return (
    <>
      <div className="progresso-letras">
        <strong>
          {progresso.liberadas} de {progresso.total}
        </strong>
        <span>{progresso.liberadas === 1 ? 'letra liberada' : 'letras liberadas'}</span>
        <span className="trilha" role="presentation">
          <span className="preenchido" style={{ width: `${porcento}%` }} />
        </span>
      </div>

      <h2>Escolha uma letra</h2>
      <p className="subtitulo">Aprenda com fé, saúde, música e diversão</p>

      <div className="grade-letras">
        {ALFABETO.map((letra) => {
          /**
           * A grade tem sempre 26 casas, uma por letra, e cada conteúdo entra
           * na casa da SUA letra.
           *
           * Antes era a lista por ordem de posição, e por isso bastou existir
           * uma introdução para o A cair no lugar do B e tudo escorregar. A
           * casa do A é do A mesmo que nada esteja publicado nela.
           */
          const dela = contents.find((c) => c.letra === letra && c.publicado)

          if (!dela) {
            return (
              <div
                className="letra-bloco trancada"
                key={letra}
                aria-label={`Letra ${letra}, ainda bloqueada`}
              >
                {letra}
                <span className="cadeado" aria-hidden>
                  🔒
                </span>
              </div>
            )
          }

          return (
            <button
              type="button"
              className={escolhida === dela.slug ? 'letra-bloco escolhida' : 'letra-bloco'}
              key={letra}
              onClick={() => escolher(dela)}
              aria-pressed={escolhida === dela.slug}
            >
              {dela.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dela.coverUrl} alt={dela.title} />
              ) : (
                letra
              )}
            </button>
          )
        })}
      </div>

      <div ref={destino} />

      {carregando && <p className="vazio">A abrir a letra...</p>}
      {erro && <p className="erro">{erro}</p>}

      {aberta && !carregando && (
        <section className="letra-aberta">
          {/* A letra deixou de ser UM cartão com os áudios empilhados por
              baixo de uma imagem só. São publicações independentes, na ordem
              que ele fixou em 23/08: principal, música, explicação, oração,
              memorização. A ordem sai da posição de cada bloco no painel, que
              é onde ele a manda com as setas — não a invento aqui. */}
          {publicacoesDe(aberta).map((pub) => (
            <PublicacaoDaLetra
              somFazParteDaEstrutura
              key={pub.ancora}
              etiqueta={pub.etiqueta}
              imagem={pub.imagem}
              bloco={pub.bloco}
              titulo={pub.titulo}
              texto={pub.texto}
              alvo={pub.alvo}
              projectId={projectId}
              contentId={aberta.content.id}
              projectSlug={projectSlug}
              /*
                O LINK PARTILHADO ABRE ESTA PUBLICAÇÃO, E NÃO A PÁGINA.

                Pedido dele em 31/08: "quero compartilhar exatamente aquela
                música que estou vendo, e não uma página geral". Estava a
                partilhar-se `/projecto#cartao-xxx`, e essa âncora não existe
                no momento em que a página abre — as letras só entram no
                documento depois de alguém tocar numa. Quem recebia o link caía
                no alfabeto fechado, sem nada que lhe dissesse o que tinha
                vindo ver.

                Agora o endereço leva a letra e o cartão, e a página abre-os.
              */
              ligacao={`/${projectSlug}?letra=${aberta.content.slug}&pub=${pub.bloco.id}`}
              ancora={pub.ancora}
              categorias={categorias}
            />
          ))}

          {/* A IMPRESSÃO SÓ APARECE QUANDO EXISTE MESMO.
              Antes eu desenhava aqui a capa da letra outra vez, e era essa a
              "fotografia sozinha mais abaixo" de que ele se queixou — uma
              imagem sem áudio, sem título e sem texto, no meio de uma página
              que era toda feita de peças inteiras. O cartão de impressão é uma
              peça como as outras: ou está inteiro, ou não está. */}
          {(() => {
            const impressao = aberta.content.blocks.find((b) => b.papel === 'IMPRESSAO' && b.arte)
            // O `find` acima já garante que há arte; o compilador é que não
            // consegue ver isso através do predicado. Repetir a condição aqui
            // custa uma linha e evita um `!` que mente sobre o que se sabe.
            if (!impressao?.arte) return null
            return (
              <CartaoDeImpressao
                projectId={projectId}
                contentId={aberta.content.id}
                blockId={impressao.id}
                projectSlug={projectSlug}
                contentSlug={aberta.content.slug}
                titulo={impressao.titulo ?? aberta.content.title}
                letra={aberta.content.letra ?? ''}
                arte={impressao.arte}
                folhaA4={(impressao.meta?.folhaA4 as string | undefined) ?? null}
                linkUpgrade={impressao.linkUpgrade}
              />
            )
          })()}

          {/* Só depois da impressão é que se anuncia a próxima. */}
          {(() => {
            const seguinte = proximaLetraDepoisDe(aberta.content.letra, contents)
            if (!seguinte) return null
            return (
              <div className="proxima-letra">
                <p className="rotulo-proxima">Próxima letra</p>
                <button
                  type="button"
                  className="cartao-proxima"
                  onClick={() => escolher(seguinte)}
                  disabled={!seguinte.publicado}
                >
                  {seguinte.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={seguinte.coverUrl} alt={seguinte.title} />
                  )}
                  <span className="nome-proxima">
                    Letra {seguinte.letra} — {seguinte.title}
                  </span>
                  {!seguinte.publicado && <span className="cadeado-proxima">🔒 Em breve</span>}
                </button>
              </div>
            )
          })()}
        </section>
      )}
    </>
  )
}


/**
 * A letra a seguir a esta no alfabeto.
 *
 * Vai pela LETRA e não pela posição na lista. Foi a posição que já pôs o A na
 * casa do B uma vez, e não volta a entrar por aqui.
 */
function proximaLetraDepoisDe(letra: string | null, contents: ItemIndice[]) {
  if (!letra) return null
  const i = ALFABETO.indexOf(letra.toUpperCase())
  if (i < 0 || i + 1 >= ALFABETO.length) return null
  const seguinte = ALFABETO[i + 1]
  // A CASA DA LETRA SEGUINTE EXISTE MESMO QUANDO A LETRA AINDA NÃO EXISTE.
  // Nesta base não há nenhuma Letra B — a lista salta de A para C — e devolver
  // nada fazia o fim da Letra A acabar sem dizer o que vem depois. O alfabeto
  // é sabido de antemão: a casa seguinte é sempre o B, esteja ou não preparada.
  const dela = contents.find((c) => c.letra === seguinte)
  if (dela) return dela
  return {
    id: '',
    slug: '',
    title: 'em breve',
    subtitle: null,
    coverUrl: null,
    position: 0,
    letra: seguinte,
    publicado: false,
    stats: null,
  } satisfies ItemIndice
}
