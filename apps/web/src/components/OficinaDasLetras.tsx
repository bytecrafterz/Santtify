'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ErroDeApi } from '@/lib/auth'
import { karaoke, type AndamentoDasLetras, type FaixaAOuvir } from '@/lib/karaoke'

/**
 * A OFICINA DAS LETRAS: o computador ouve as músicas e escreve a letra.
 *
 * É o pedido dele de 19/09 — "eu publico o áudio e o sistema reconhece o que
 * está sendo cantado" — visto do lado de quem carrega no botão. O trabalho
 * acontece noutro processo, devagar, e esta página é a janela para ele.
 *
 * TRÊS DECISÕES QUE VALE A PENA EXPLICAR:
 *
 * 1. A percentagem conta a música que está a ser ouvida AGORA, e não só as
 *    acabadas. Com sessenta faixas de quatro minutos, uma barra que só saltasse
 *    de faixa em faixa ficaria parada minutos a fio — e uma barra parada é
 *    indistinguível de uma avaria.
 *
 * 2. Pergunta-se de quatro em quatro segundos, e SÓ enquanto houver trabalho.
 *    Acabada a fila, a página fica quieta: um painel que bate na API para
 *    sempre é um painel que aquece o servidor à toa.
 *
 * 3. Se houver fila e ninguém estiver a ouvir durante um minuto, diz-se. É
 *    quase sempre o processo que ouve as músicas estar parado, e é melhor
 *    dizê-lo em português do que deixá-lo a olhar para uma barra a zero.
 */
export function OficinaDasLetras({ projectSlug }: { projectSlug: string }) {
  const [dados, definirDados] = useState<AndamentoDasLetras | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [recado, definirRecado] = useState<string | null>(null)
  const [tudo, definirTudo] = useState(false)
  // Há quanto tempo há fila sem ninguém a ouvir. Ver a decisão 3.
  const paradoDesde = useRef<number | null>(null)
  const [adormecido, definirAdormecido] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const novo = await karaoke.andamento(projectSlug)
      definirDados(novo)
      const parado = novo.resumo.naFila > 0 && novo.resumo.aOuvirAgora === 0
      if (!parado) {
        paradoDesde.current = null
        definirAdormecido(false)
      } else {
        paradoDesde.current ??= Date.now()
        definirAdormecido(Date.now() - paradoDesde.current > 60_000)
      }
      return novo
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível saber como vão as letras.')
      return null
    }
  }, [projectSlug])

  useEffect(() => {
    let vivo = true
    let temporizador: ReturnType<typeof setTimeout> | undefined

    const ciclo = async () => {
      const novo = await carregar()
      if (!vivo) return
      const aTrabalhar = (novo?.resumo.naFila ?? 0) + (novo?.resumo.aOuvirAgora ?? 0) > 0
      temporizador = setTimeout(() => void ciclo(), aTrabalhar ? 4000 : 30000)
    }
    void ciclo()

    return () => {
      vivo = false
      if (temporizador) clearTimeout(temporizador)
    }
  }, [carregar])

  const accao = async (chave: string, fazer: () => Promise<string>) => {
    definirErro(null)
    definirOcupado(chave)
    try {
      definirRecado(await fazer())
      await carregar()
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível concluir.')
    } finally {
      definirOcupado(null)
    }
  }

  const ouvirTudo = (refazer: boolean) =>
    accao(refazer ? 'refazer' : 'faltam', async () => {
      const r = await karaoke.ouvirTudo(projectSlug, refazer)
      if (r.postas === 0) return 'Não havia nenhuma música à espera.'
      return r.postas === 1 ? '1 música foi para a fila.' : `${r.postas} músicas foram para a fila.`
    })

  if (!dados) {
    return (
      <section className="oficina oficina-a-abrir">
        <span className="oficina-roda" aria-hidden="true" />
        <p>A ver como vão as letras…</p>
      </section>
    )
  }

  const { resumo } = dados
  const porOuvir = resumo.naFila + resumo.aOuvirAgora
  const aTrabalhar = porOuvir > 0
  /*
    A LISTA CURTA SÓ FAZ SENTIDO QUANDO HÁ ALGO A ACONTECER.

    Com a fila vazia não há nada em destaque, e o painel escondia as músicas
    todas atrás de "Ver as 51 músicas" — que é exactamente o primeiro ecrã que
    ele vê, e aquele em que precisa de chegar a uma faixa para a mandar ouvir.
    Sem nada na fila, mostram-se todas.
  */
  const emDestaque = dados.faixas.filter(destaque)
  const visiveis = tudo || emDestaque.length === 0 ? dados.faixas : emDestaque

  return (
    <section className={aTrabalhar ? 'oficina a-trabalhar' : 'oficina'}>
      <div className="oficina-luz" aria-hidden="true" />

      <header className="oficina-topo">
        <p className="oficina-etiqueta">Letras automáticas</p>
        <h2>O computador ouve e escreve</h2>
        <p className="oficina-linha">
          Cada música enviada é ouvida por inteiro e a letra fica escrita, palavra a
          palavra, no tempo certo do karaokê. Demora mais ou menos o tempo da própria
          música — pode fechar esta página que o trabalho continua.
        </p>
      </header>

      <div className="oficina-medidor">
        <div
          className="oficina-anel"
          style={{ '--parte': `${resumo.percentagem}` } as React.CSSProperties}
          role="img"
          aria-label={`${resumo.percentagem} por cento das músicas com letra`}
        >
          <div className="oficina-anel-centro">
            <strong>
              {resumo.percentagem}
              <span>%</span>
            </strong>
            <span className="oficina-anel-nota">
              {resumo.prontas} de {resumo.total}
            </span>
          </div>
        </div>

        <ul className="oficina-numeros">
          <li>
            <strong>{resumo.prontas}</strong>
            <span>com letra</span>
          </li>
          <li className={resumo.aOuvirAgora ? 'a-ouvir' : ''}>
            <strong>{resumo.aOuvirAgora}</strong>
            <span>a ouvir agora</span>
          </li>
          <li>
            <strong>{resumo.naFila}</strong>
            <span>à espera</span>
          </li>
          <li className={resumo.falhadas ? 'falhou' : ''}>
            <strong>{resumo.falhadas}</strong>
            <span>falharam</span>
          </li>
        </ul>
      </div>

      <div className="oficina-barra" aria-hidden="true">
        <span style={{ width: `${resumo.percentagem}%` }} />
      </div>

      {aTrabalhar && (
        <p className="oficina-estado">
          <span className="oficina-roda" aria-hidden="true" />
          {resumo.aOuvirAgora > 0
            ? `A ouvir ${resumo.aOuvirAgora === 1 ? 'uma música' : `${resumo.aOuvirAgora} músicas`}`
            : 'Fila aberta'}
          {resumo.naFila > 0 && ` · faltam ${resumo.naFila} por começar`}
        </p>
      )}

      {adormecido && (
        <p className="oficina-aviso">
          As músicas estão na fila mas ninguém as está a ouvir. Isto costuma ser o
          programa que escreve as letras estar parado no servidor — as músicas ficam
          guardadas e começam sozinhas assim que ele voltar.
        </p>
      )}

      {erro && <p className="oficina-erro">{erro}</p>}
      {recado && !erro && <p className="oficina-recado">{recado}</p>}

      <div className="oficina-accoes">
        <button
          type="button"
          className="oficina-botao principal"
          disabled={ocupado !== null}
          onClick={() => void ouvirTudo(false)}
        >
          {ocupado === 'faltam' ? 'A pôr na fila…' : 'Escrever as letras que faltam'}
        </button>
        <button
          type="button"
          className="oficina-botao"
          disabled={ocupado !== null}
          onClick={() => {
            if (
              window.confirm(
                'Isto volta a ouvir TODAS as músicas, incluindo as que já têm letra. As letras que você escreveu à mão são substituídas. Quer mesmo?',
              )
            ) {
              void ouvirTudo(true)
            }
          }}
        >
          {ocupado === 'refazer' ? 'A pôr na fila…' : 'Refazer todas'}
        </button>
      </div>

      {dados.faixas.length === 0 ? (
        <p className="oficina-vazio">
          Ainda não há nenhuma música com áudio neste projeto. Envie o áudio numa
          faixa e a letra começa a ser escrita sozinha.
        </p>
      ) : (
        <>
          <ul className="oficina-faixas">
            {visiveis.map((f) => (
              // `data-faixa` é para o percurso poder apontar a uma faixa certa:
              // os nomes repetem-se ("Bloco 1" é o título de uma e o conteúdo de
              // outra) e um teste que aponta pelo nome mede a linha errada.
              <li key={f.id} data-faixa={f.id} className={`oficina-faixa ${classeDoEstado(f)}`}>
                <div className="oficina-faixa-nome">
                  <strong>{f.nome}</strong>
                  <span>{f.conteudo}</span>
                </div>

                <div className="oficina-faixa-estado">
                  <span className="oficina-selo">{descrever(f)}</span>
                  {f.estado === 'A_OUVIR' && (
                    <span className="oficina-faixa-barra" aria-hidden="true">
                      <span style={{ width: `${Math.max(3, f.progresso)}%` }} />
                    </span>
                  )}
                  {f.erro && f.estado === 'FALHOU' && (
                    <span className="oficina-faixa-erro">{f.erro}</span>
                  )}
                </div>

                <div className="oficina-faixa-accoes">
                  <button
                    type="button"
                    className="oficina-botao pequeno"
                    disabled={ocupado !== null}
                    onClick={() =>
                      void accao(`faixa-${f.id}`, async () => {
                        /* O botão diz "Ouvir de novo" ou "Ouvir", e o pedido
                           passou a dizer o mesmo ao servidor. Só o primeiro
                           passa por cima de uma letra que já lá está — e o
                           "Ouvir" de uma faixa com texto colado à mão deixa
                           de o apagar sem avisar. */
                        const refazer = f.temLetra || f.estado === 'PRONTA'
                        const r = await karaoke.ouvirUma(f.id, refazer)
                        if (r.ignorado) return `“${f.nome}” ficou como estava: ${r.motivo}.`
                        return `“${f.nome}” foi para a fila.`
                      })
                    }
                  >
                    {ocupado === `faixa-${f.id}`
                      ? 'A pôr…'
                      : f.temLetra || f.estado === 'PRONTA'
                        ? 'Ouvir de novo'
                        : 'Ouvir'}
                  </button>
                  <Link className="oficina-botao pequeno" href={`/${projectSlug}/admin/karaoke/${f.id}`}>
                    Ver a letra
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {dados.faixas.length > visiveis.length && !tudo && (
            <button type="button" className="oficina-mais" onClick={() => definirTudo(true)}>
              Ver as {dados.faixas.length} músicas
            </button>
          )}
          {tudo && emDestaque.length > 0 && (
            <button type="button" className="oficina-mais" onClick={() => definirTudo(false)}>
              Mostrar só o que está a acontecer
            </button>
          )}
        </>
      )}
    </section>
  )
}

/*
  A LISTA COMEÇA CURTA. Com sessenta músicas, uma lista inteira esconde as três
  que estão a acontecer agora — que é a única coisa que ele quer ver enquanto
  espera. O resto fica a um toque.
*/
function destaque(f: FaixaAOuvir): boolean {
  return f.estado === 'A_OUVIR' || f.estado === 'PENDENTE' || f.estado === 'FALHOU'
}

function classeDoEstado(f: FaixaAOuvir): string {
  if (f.estado === 'A_OUVIR') return 'a-ouvir'
  if (f.estado === 'FALHOU') return 'falhou'
  if (f.temLetra) return 'pronta'
  return ''
}

function descrever(f: FaixaAOuvir): string {
  if (f.estado === 'A_OUVIR') return `a ouvir · ${f.progresso}%`
  if (f.estado === 'PENDENTE') return 'à espera'
  if (f.estado === 'FALHOU') return 'não deu'
  if (f.temLetra) {
    const como = f.origem === 'AUTOMATICA' ? 'automática' : 'sua'
    return `letra ${como} · ${f.frases} frases`
  }
  return 'sem letra'
}
