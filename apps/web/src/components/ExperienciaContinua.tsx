'use client'

import { useEffect, useRef, useState } from 'react'
import type { ItemIndice, PaginaConteudo, ProgressoDasLetras } from '@/lib/api'
import { PublicacaoDaLetra } from './PublicacaoDaLetra'
import { CartaoDeImpressao } from './CartaoDeImpressao'
import { rastrear } from '@/lib/track'

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
  const [carregando, definirCarregando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const destino = useRef<HTMLDivElement>(null)
  /** A publicação que o endereço pediu, enquanto ainda não foi mostrada. */
  const pedida = useRef<string | null>(null)

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
    let pagina = cache[item.slug]
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
    if (!item?.publicado) return
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
    const el = document.getElementById(`cartao-${alvo}`)
    if (!el) return
    pedida.current = null
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('publicacao-apontada')
    const t = setTimeout(() => el.classList.remove('publicacao-apontada'), 4000)
    return () => clearTimeout(t)
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
 * Parte uma letra nas suas publicações.
 *
 * A PRIMEIRA é o conteúdo em si: a capa da letra, o primeiro áudio, o título e
 * o texto educativo. As seguintes são um áudio cada, com a arte própria da
 * faixa. Se a faixa ainda não tiver arte, usa a capa da letra — é melhor ver a
 * letra outra vez do que ver um buraco branco onde devia estar uma imagem.
 *
 * O texto dos blocos de texto que existam vai todo para a primeira publicação,
 * porque é lá que ele o escreveu enquanto a letra era um cartão só. Cada faixa
 * tem o seu próprio texto assim que ele o preencher no painel.
 */
function publicacoesDe(pagina: PaginaConteudo) {
  const c = pagina.content

  // Só cartões, e cada cartão é uma peça inteira: o servidor já não devolve
  // nenhum incompleto. Aqui não há nada a montar nem a juntar — foi essa
  // montagem, feita de pedaços que por acaso estavam próximos, que durante
  // quatro dias deixou a fotografia aparecer sozinha noutro sítio da página.
  return (
    c.blocks
      // Basta ter áudio OU imagem. Um cartão a que falte a foto continua a ser
      // um cartão, com o lugar da foto lá dentro — que é o oposto de uma
      // fotografia solta noutro sítio da página.
      .filter((b) => b.type === 'AUDIO' && b.papel === 'CARTAO' && (b.asset?.url || b.arte))
      .map((b) => ({
        ancora: `cartao-${b.id}`,
        // SEM ETIQUETA. Os nomes das casas — explicação, música, oração — servem
        // para ele se orientar no painel, e ele foi explícito: não aparecem na
        // página, nem como faixa branca no topo.
        etiqueta: null as string | null,
        imagem: b.arte,
        bloco: b,
        titulo: b.titulo ?? '',
        texto: b.text?.trim() ?? null,
        linkUpgrade: b.linkUpgrade,
        alvo: { tipo: 'faixa' as const, blockId: b.id },
      }))
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
