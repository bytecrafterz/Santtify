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
}: {
  projectSlug: string
  projectId: string
  contents: ItemIndice[]
  progresso: ProgressoDasLetras
}) {
  const [escolhida, definirEscolhida] = useState<string | null>(null)
  const [cache, definirCache] = useState<Record<string, PaginaConteudo>>({})
  const [carregando, definirCarregando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const destino = useRef<HTMLDivElement>(null)

  const porcento = progresso.total ? (progresso.liberadas / progresso.total) * 100 : 0
  const aberta = escolhida ? cache[escolhida] : null

  async function escolher(item: ItemIndice) {
    if (!item.publicado) return
    definirErro(null)
    definirEscolhida(item.slug)

    if (!cache[item.slug]) {
      definirCarregando(true)
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? ''}/projects/${projectSlug}/contents/${item.slug}`,
        )
        if (!res.ok) throw new Error('falhou')
        const dados = (await res.json()) as PaginaConteudo
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
  }

  // Depois de a letra chegar, leva a pessoa até ela. Sem isto o conteúdo abre
  // fora do ecrã e parece que o toque não fez nada.
  useEffect(() => {
    if (!aberta) return
    destino.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
              ligacao={`/${projectSlug}#${pub.ancora}`}
              ancora={pub.ancora}
            />
          ))}

          {/* A impressão vem DEPOIS da última publicação, e antes da letra
              seguinte. É a ordem dele, e faz sentido: o cartão é o fim desta
              letra, não uma opção que anda por ali no meio. */}
          <CartaoDeImpressao
            projectId={projectId}
            contentId={aberta.content.id}
            titulo={aberta.content.title}
            letra={aberta.content.letra ?? ''}
            ficheiro={aberta.content.freeFileUrl}
            nomeDoFicheiro={aberta.content.freeFileName}
            capa={aberta.content.coverUrl}
            qrSvgUrl={
              aberta.content.qrCode
                ? `${process.env.NEXT_PUBLIC_API_URL ?? ''}/projects/${projectSlug}/contents/${aberta.content.slug}/qr.svg`
                : null
            }
          />

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
  const audios = c.blocks.filter((b) => b.type === 'AUDIO' && b.asset?.url)
  const texto = c.blocks
    .filter((b) => (b.type === 'TEXT' || b.type === 'RICH_TEXT') && b.text?.trim())
    .map((b) => b.text!.trim())
    .join('\n\n')

  const [primeiro, ...restantes] = audios

  const principal = {
    ancora: `conteudo-${c.id}`,
    etiqueta: c.letra ? `LETRA ${c.letra}` : null,
    imagem: c.coverUrl,
    bloco: primeiro ?? null,
    titulo: c.title,
    texto: texto || c.subtitle,
    alvo: { tipo: 'conteudo' as const, contentId: c.id },
  }

  return [
    principal,
    ...restantes.map((b) => ({
      ancora: `faixa-${b.id}`,
      etiqueta: (b.label ?? '').trim().toUpperCase() || null,
      imagem: b.arte ?? c.coverUrl,
      bloco: b,
      titulo: (b.label ?? '').trim() || c.title,
      texto: b.text?.trim() ?? null,
      alvo: { tipo: 'faixa' as const, blockId: b.id },
    })),
  ]
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
