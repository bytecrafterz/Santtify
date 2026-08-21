'use client'

import { useEffect, useRef, useState } from 'react'
import type { ItemIndice, PaginaConteudo, ProgressoDasLetras } from '@/lib/api'
import { BlocosDeConteudo } from './BlocosDeConteudo'
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
    void rastrear({ projectId, contentId: item.id, type: 'CONTENT_VIEW', props: { origem: 'perfil' } })
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
        {contents.map((c) => {
          const letra = c.title.replace(/^Letra\s+/i, '').trim().charAt(0).toUpperCase()

          if (!c.publicado) {
            return (
              <div
                className="letra-bloco trancada"
                key={c.id}
                aria-label={`${c.title}, ainda bloqueada`}
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
              className={escolhida === c.slug ? 'letra-bloco escolhida' : 'letra-bloco'}
              key={c.id}
              onClick={() => escolher(c)}
              aria-pressed={escolhida === c.slug}
            >
              {c.coverUrl ? (
                // Só a capa, sem legenda por cima: a arte da letra já traz o
                // nome dela desenhado, e a legenda ficava a tapar o desenho.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverUrl} alt={c.title} />
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
          {/* Sem capa nem título repetidos aqui: a introdução do projeto já
              está em cima da página, e cada conteúdo traz a sua própria
              imagem. Repetir era ver a mesma coisa duas vezes seguidas. */}
          <button
            type="button"
            className="secundario fechar-letra"
            onClick={() => definirEscolhida(null)}
          >
            Fechar {aberta.content.title}
          </button>
          <BlocosDeConteudo
            blocos={aberta.content.blocks}
            projectId={projectId}
            contentId={aberta.content.id}
            projectSlug={projectSlug}
          />
        </section>
      )}
    </>
  )
}
