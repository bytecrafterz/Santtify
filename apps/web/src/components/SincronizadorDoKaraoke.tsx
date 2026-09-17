'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  aplicarMarcas,
  marcasDasFrases,
  niveisDaFrase,
  posicaoNoTempo,
  validarFrases,
  type Frase,
  type Marca,
  type NivelDeDestaque,
} from '@pv/karaoke'
import { ErroDeApi } from '@/lib/auth'
import { karaoke, type LetraDoCartao } from '@/lib/karaoke'
import { PalcoDoKaraoke } from './PalcoDoKaraoke'

/**
 * Quanto se desconta a cada toque, em milissegundos.
 *
 * Quem marca ouve a palavra e SÓ DEPOIS carrega: entre ouvir e o dedo chegar
 * ao ecrã passam uns 150 ms. Sem desconto, todas as marcas ficavam atrasadas
 * por igual e o destaque andava sempre um pouco atrás do canto.
 */
const ATRASO_DO_TOQUE_MS = 150

function mmss(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—'
  const s = ms / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

const inicioDa = (m: Marca): number | null =>
  typeof m === 'number' ? m : Array.isArray(m) && typeof m[0] === 'number' ? m[0] : null

type Modo = 'frase' | 'palavra'
interface Cursor {
  frase: number
  palavra: number
}

/** O ciclo do toque numa palavra: automático → máximo → forte → destaque → normal. */
function proximoDestaque(atual: NivelDeDestaque | null | undefined): NivelDeDestaque | undefined {
  if (atual === undefined || atual === null) return 3
  if (atual === 3) return 2
  if (atual === 2) return 1
  if (atual === 1) return 0
  return undefined
}

/**
 * A ferramenta de sincronização do Modo Karaokê.
 *
 * Combinado com ele: é ele que sincroniza as músicas, aqui no painel. Por isso
 * a ferramenta tem de ser coisa de tocar e carregar, e não de escrever tempos:
 *
 *   1. cola a letra, uma frase por linha;
 *   2. toca a música e carrega em "Marcar" quando cada frase começa (ou em cada
 *      palavra, nas partes difíceis);
 *   3. vê o resultado ao lado, exactamente como vai ficar, e acerta o que for
 *      preciso — puxar uma frase um pouco para trás, destacar uma palavra;
 *   4. grava e publica.
 *
 * As palavras dentro de uma frase recebem o tempo sozinhas, em proporção ao
 * tamanho (ver `aplicarMarcas`). Na maior parte das músicas infantis isso chega
 * com um toque por frase; onde não chegar, marca-se palavra a palavra só
 * naquela frase.
 */
export function SincronizadorDoKaraoke({ projectSlug, blocoId }: { projectSlug: string; blocoId: string }) {
  const [dados, definirDados] = useState<LetraDoCartao | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState(false)

  const [texto, definirTexto] = useState('')
  /** As frases com as marcas de destaque — os tempos saem das `marcas`. */
  const [base, definirBase] = useState<Frase[]>([])
  const [marcas, definirMarcas] = useState<Marca[]>([])
  const [historico, definirHistorico] = useState<Array<{ marcas: Marca[]; cursor: Cursor }>>([])
  const [cursor, definirCursor] = useState<Cursor>({ frase: 0, palavra: 0 })
  const [modo, definirModo] = useState<Modo>('frase')
  const [alterado, definirAlterado] = useState(false)

  const audio = useRef<HTMLAudioElement>(null)
  const [tocando, definirTocando] = useState(false)
  const [tempoMs, definirTempoMs] = useState(0)
  const [duracaoMs, definirDuracaoMs] = useState<number | null>(null)
  const [lento, definirLento] = useState(false)

  const aplicarDados = useCallback((d: LetraDoCartao) => {
    definirDados(d)
    definirTexto(d.letra.texto)
    definirBase(d.letra.frases)
    const m = marcasDasFrases(d.letra.frases)
    definirMarcas(m)
    definirHistorico([])
    const primeiraPorMarcar = m.findIndex((x) => inicioDa(x) === null)
    definirCursor({ frase: primeiraPorMarcar < 0 ? m.length : primeiraPorMarcar, palavra: 0 })
    definirAlterado(false)
    if (d.faixa.duracaoMs) definirDuracaoMs(d.faixa.duracaoMs)
  }, [])

  useEffect(() => {
    karaoke
      .letra(blocoId)
      .then(aplicarDados)
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível carregar.'))
  }, [blocoId, aplicarDados])

  // O relógio: a cada fotograma enquanto toca, para a pré-visualização e para
  // o toque cair no tempo certo.
  useEffect(() => {
    const el = audio.current
    if (!el) return
    if (!tocando) {
      definirTempoMs(Math.round(el.currentTime * 1000))
      return
    }
    let pedido = 0
    const ciclo = () => {
      definirTempoMs(Math.round(el.currentTime * 1000))
      pedido = requestAnimationFrame(ciclo)
    }
    pedido = requestAnimationFrame(ciclo)
    return () => cancelAnimationFrame(pedido)
  }, [tocando])

  // Sair com a sincronização por gravar pede confirmação: uma música inteira
  // marcada à mão não se perde por um toque no "voltar".
  useEffect(() => {
    if (!alterado) return
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [alterado])

  const frases = useMemo(() => aplicarMarcas(base, marcas, duracaoMs), [base, marcas, duracaoMs])
  const errosParaPublicar = useMemo(() => validarFrases(frases, duracaoMs, true), [frases, duracaoMs])
  const posicao = posicaoNoTempo(frases, tempoMs)

  const guardarNoHistorico = () =>
    definirHistorico((h) => [...h.slice(-199), { marcas, cursor }])

  const mudarMarcas = (novas: Marca[]) => {
    definirMarcas(novas)
    definirAlterado(true)
    definirAviso(null)
  }

  const marcar = () => {
    const el = audio.current
    if (!el || base.length === 0 || cursor.frase >= base.length) return
    const t = Math.max(0, Math.round(el.currentTime * 1000) - (el.paused ? 0 : ATRASO_DO_TOQUE_MS))
    guardarNoHistorico()
    const novas = [...marcas]
    const f = cursor.frase

    if (modo === 'frase') {
      novas[f] = t
      /*
        As frases seguintes com marca ANTERIOR a esta ficam sem marca. Quem volta
        atrás para remarcar a meio da música deixa-as incoerentes de outra
        maneira; as que continuam a fazer sentido ficam.
      */
      for (let j = f + 1; j < novas.length; j++) {
        const inicio = inicioDa(novas[j])
        if (inicio !== null && inicio <= t) novas[j] = null
      }
      mudarMarcas(novas)
      definirCursor({ frase: f + 1, palavra: 0 })
      return
    }

    const total = base[f].palavras.length
    const atual = novas[f]
    const lista: Array<number | null> = Array.isArray(atual)
      ? [...atual]
      : Array.from({ length: total }, (_, j) => (j === 0 && typeof atual === 'number' ? atual : null))
    lista[cursor.palavra] = t
    // Remarcar uma palavra apaga as marcas das seguintes, na mesma frase.
    for (let j = cursor.palavra + 1; j < total; j++) lista[j] = null
    novas[f] = lista
    for (let j = f + 1; j < novas.length; j++) {
      const inicio = inicioDa(novas[j])
      if (inicio !== null && inicio <= t) novas[j] = null
    }
    mudarMarcas(novas)
    definirCursor(
      cursor.palavra + 1 < total ? { frase: f, palavra: cursor.palavra + 1 } : { frase: f + 1, palavra: 0 },
    )
  }

  const desfazer = () => {
    const ultimo = historico[historico.length - 1]
    if (!ultimo) return
    definirHistorico((h) => h.slice(0, -1))
    definirMarcas(ultimo.marcas)
    definirCursor(ultimo.cursor)
    definirAlterado(true)
  }

  const tocarOuPausar = () => {
    const el = audio.current
    if (!el) return
    if (el.paused) void el.play()
    else el.pause()
  }

  const irPara = (ms: number) => {
    const el = audio.current
    if (!el) return
    el.currentTime = Math.max(0, ms) / 1000
    definirTempoMs(Math.max(0, ms))
  }

  /** Voltar a uma frase: o cursor fica nela e a música recua um pouco antes. */
  const ouvirDesde = (f: number) => {
    const inicio = inicioDa(marcas[f] ?? null)
    let desde = inicio
    if (desde === null) {
      for (let j = f - 1; j >= 0 && desde === null; j--) desde = inicioDa(marcas[j] ?? null)
    }
    irPara((desde ?? 0) - 2000)
    definirCursor({ frase: f, palavra: 0 })
    void audio.current?.play()
  }

  const empurrar = (f: number, deltaMs: number) => {
    const m = marcas[f]
    if (inicioDa(m ?? null) === null) return
    guardarNoHistorico()
    const novas = [...marcas]
    novas[f] = Array.isArray(m)
      ? m.map((v) => (typeof v === 'number' ? Math.max(0, v + deltaMs) : v))
      : Math.max(0, (m as number) + deltaMs)
    mudarMarcas(novas)
  }

  const limparFrase = (f: number) => {
    guardarNoHistorico()
    const novas = [...marcas]
    novas[f] = null
    mudarMarcas(novas)
    definirCursor({ frase: f, palavra: 0 })
  }

  const alternarDestaque = (f: number, p: number) => {
    definirBase((b) =>
      b.map((frase, i) =>
        i !== f
          ? frase
          : {
              ...frase,
              palavras: frase.palavras.map((palavra, j) => {
                if (j !== p) return palavra
                const seguinte = proximoDestaque(palavra.destaque)
                const copia = { ...palavra }
                if (seguinte === undefined) delete copia.destaque
                else copia.destaque = seguinte
                return copia
              }),
            },
      ),
    )
    definirAlterado(true)
    definirAviso(null)
  }

  // Teclado, para quem sincroniza no computador: espaço marca, K toca e
  // pausa, Z desfaz. Nunca dentro da caixa da letra, onde as teclas são texto.
  const teclas = useRef({ marcar, desfazer, tocarOuPausar })
  teclas.current = { marcar, desfazer, tocarOuPausar }
  useEffect(() => {
    const aoCarregar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (alvo.closest('textarea, input, select') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) teclas.current.marcar()
      } else if (e.code === 'KeyK') {
        teclas.current.tocarOuPausar()
      } else if (e.code === 'KeyZ' || e.code === 'Backspace') {
        e.preventDefault()
        teclas.current.desfazer()
      }
    }
    window.addEventListener('keydown', aoCarregar)
    return () => window.removeEventListener('keydown', aoCarregar)
  }, [])

  const gravar = async (dadosParaGravar: { texto?: string; frases?: Frase[]; publicada?: boolean }, sucesso: string) => {
    definirErro(null)
    definirAviso(null)
    definirOcupado(true)
    try {
      const d = await karaoke.gravarLetra(blocoId, dadosParaGravar)
      const tempo = audio.current?.currentTime
      aplicarDados(d)
      if (tempo !== undefined) irPara(tempo * 1000)
      definirAviso(sucesso)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível gravar.')
    } finally {
      definirOcupado(false)
    }
  }

  if (!dados) return erro ? <p className="cartoes-erro">{erro}</p> : <p className="subtitulo">A carregar…</p>

  const textoMudou = texto !== dados.letra.texto
  const proxima = base[cursor.frase]
  const semAudio = !dados.faixa.audio

  return (
    <div className="painel-cartoes sincronizador">
      <p className="subtitulo">
        <strong>{dados.faixa.titulo}</strong> · {dados.faixa.conteudoTitulo}
        {dados.letra.publicada && <span className="painel-selo-pronto">no ar</span>}
      </p>
      {erro && <p className="cartoes-erro">{erro}</p>}
      {aviso && <p className="sincronizador-aviso">{aviso}</p>}

      {/* Fora das secções: editar a letra esconde a sincronização, e o som não
          pode parar por isso. */}
      {!semAudio && (
        <audio
          ref={audio}
          src={dados.faixa.audio ?? undefined}
          preload="auto"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration
            if (Number.isFinite(d)) definirDuracaoMs(Math.round(d * 1000))
          }}
          onPlay={() => definirTocando(true)}
          onPause={() => definirTocando(false)}
          onEnded={() => definirTocando(false)}
        />
      )}

      <section className="painel-bloco">
        <h2>1. A letra</h2>
        <p className="subtitulo">
          Uma frase por linha, como deve aparecer no ecrã. As linhas em branco não
          contam. Ao corrigir uma linha, as outras mantêm a sincronização.
        </p>
        <textarea
          className="sincronizador-texto"
          value={texto}
          onChange={(e) => definirTexto(e.target.value)}
          rows={Math.min(16, Math.max(6, texto.split('\n').length + 1))}
          placeholder={'Não mais eu, mas Cristo vive em mim\nJesus me ensina a amar\n…'}
        />
        <button
          type="button"
          className="botao-acao"
          disabled={ocupado || !textoMudou}
          onClick={() => {
            if (alterado && !window.confirm('A sincronização por gravar perde-se ao gravar a letra. Continuar?')) return
            void gravar({ texto }, '✓ Letra gravada.')
          }}
        >
          Gravar a letra
        </button>
      </section>

      {base.length > 0 && !textoMudou && (
        <>
          <section className="painel-bloco sincronizador-controlo">
            <h2>2. Sincronizar</h2>
            {semAudio ? (
              <p className="cartoes-erro">Este cartão ainda não tem áudio.</p>
            ) : (
              <>
                <p className="subtitulo">
                  Toque a música e carregue em <strong>Marcar</strong> no momento em que
                  cada {modo === 'frase' ? 'frase' : 'palavra'} começa a ser cantada.
                  No computador: <kbd>espaço</kbd> marca, <kbd>K</kbd> toca e pausa,{' '}
                  <kbd>Z</kbd> desfaz.
                </p>

                <div className="sincronizador-leitor">
                  <button type="button" className="karaoke-play" onClick={tocarOuPausar} aria-label={tocando ? 'Pausar' : 'Tocar'}>
                    {tocando ? '❚❚' : '▶'}
                  </button>
                  <div className="karaoke-linha-do-tempo">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, duracaoMs ?? 1)}
                      step={100}
                      value={Math.min(tempoMs, duracaoMs ?? tempoMs)}
                      aria-label="Posição na música"
                      style={{ '--k-progresso': `${duracaoMs ? (tempoMs / duracaoMs) * 100 : 0}%` } as React.CSSProperties}
                      onChange={(e) => irPara(Number(e.target.value))}
                    />
                    <span className="karaoke-tempos">
                      <span>{mmss(tempoMs)}</span>
                      <span>{mmss(duracaoMs)}</span>
                    </span>
                  </div>
                </div>

                <div className="sincronizador-opcoes">
                  <button type="button" className="painel-botao-destaque" onClick={() => irPara(tempoMs - 3000)}>
                    ↺ 3 s
                  </button>
                  <button
                    type="button"
                    className={lento ? 'painel-botao-destaque activo' : 'painel-botao-destaque'}
                    onClick={() => {
                      const novo = !lento
                      definirLento(novo)
                      if (audio.current) audio.current.playbackRate = novo ? 0.75 : 1
                    }}
                  >
                    Mais devagar
                  </button>
                  <span className="sincronizador-modos" role="radiogroup" aria-label="Como marcar">
                    {(['frase', 'palavra'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={modo === m}
                        className={modo === m ? 'painel-botao-destaque activo' : 'painel-botao-destaque'}
                        onClick={() => {
                          definirModo(m)
                          definirCursor((c) => ({ frase: c.frase, palavra: 0 }))
                        }}
                      >
                        {m === 'frase' ? 'Uma marca por frase' : 'Palavra a palavra'}
                      </button>
                    ))}
                  </span>
                </div>

                <button
                  type="button"
                  className="sincronizador-marcar"
                  disabled={!proxima}
                  // No toque e não no clique: o clique só chega quando o dedo
                  // levanta, e essa diferença via-se na marca.
                  onPointerDown={(e) => {
                    e.preventDefault()
                    marcar()
                  }}
                  onKeyDown={(e) => e.preventDefault()}
                >
                  {proxima ? (
                    <>
                      <span>Marcar</span>
                      <small>
                        {modo === 'frase'
                          ? `frase ${cursor.frase + 1}: ${proxima.texto}`
                          : `“${proxima.palavras[cursor.palavra]?.texto}” — frase ${cursor.frase + 1}`}
                      </small>
                    </>
                  ) : (
                    <>
                      <span>Todas marcadas</span>
                      <small>toque numa frase para a remarcar</small>
                    </>
                  )}
                </button>
                <button type="button" className="painel-botao-destaque" disabled={historico.length === 0} onClick={desfazer}>
                  Desfazer a última marca
                </button>
              </>
            )}
          </section>

          <div className="sincronizador-colunas">
            <section className="painel-bloco">
              <h2>3. Ver como fica</h2>
              <PalcoDoKaraoke
                frases={frases}
                destaques={dados.destaques}
                tempoMs={tempoMs}
                titulo={dados.faixa.titulo}
                compacto
              />
            </section>

            <section className="painel-bloco">
              <h2>As frases</h2>
              <p className="subtitulo">
                Toque numa palavra para mudar o destaque dela só nesta música
                (máximo → forte → destaque → normal → automático). As com ponto foram
                escolhidas à mão.
              </p>
              <ol className="sincronizador-frases">
                {base.map((frase, f) => {
                  const calculada = frases[f]
                  const niveis = niveisDaFrase(frase.palavras, dados.destaques)
                  const classes = [
                    'sincronizador-frase',
                    f === cursor.frase ? 'no-cursor' : '',
                    f === posicao.frase && tocando ? 'a-tocar' : '',
                    calculada.inicioMs === null ? 'por-marcar' : '',
                  ].join(' ')
                  return (
                    <li key={f} className={classes}>
                      <div className="sincronizador-frase-topo">
                        <button type="button" className="sincronizador-tempo" onClick={() => ouvirDesde(f)} title="Ouvir desde aqui e remarcar">
                          ▶ {mmss(calculada.inicioMs)}
                        </button>
                        <button type="button" onClick={() => empurrar(f, -100)} disabled={calculada.inicioMs === null} aria-label="Mais cedo 0,1 s">
                          −0,1
                        </button>
                        <button type="button" onClick={() => empurrar(f, 100)} disabled={calculada.inicioMs === null} aria-label="Mais tarde 0,1 s">
                          +0,1
                        </button>
                        <button type="button" onClick={() => limparFrase(f)} disabled={calculada.inicioMs === null} aria-label="Apagar a marca">
                          ✕
                        </button>
                      </div>
                      <div className="sincronizador-palavras">
                        {frase.palavras.map((p, j) => (
                          <button
                            key={j}
                            type="button"
                            className={[
                              'sincronizador-palavra',
                              `nivel-${niveis[j]}`,
                              typeof p.destaque === 'number' ? 'manual' : '',
                              calculada.palavras[j]?.marcada ? 'ancora' : '',
                              f === posicao.frase && j === posicao.palavra && tocando ? 'a-cantar' : '',
                            ].join(' ')}
                            onClick={() => alternarDestaque(f, j)}
                          >
                            {p.texto}
                          </button>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>

          <section className="painel-bloco sincronizador-gravar">
            <h2>4. Gravar e publicar</h2>
            {errosParaPublicar.length > 0 && (
              <p className="subtitulo">
                Para publicar: {errosParaPublicar.length === 1 ? errosParaPublicar[0] : `faltam ${errosParaPublicar.length} correções — ${errosParaPublicar[0]}`}
              </p>
            )}
            <div className="sincronizador-botoes">
              <button
                type="button"
                className="botao-acao"
                disabled={ocupado || !alterado}
                onClick={() => void gravar({ frases }, dados.letra.publicada ? '✓ Gravado. Já está no ar.' : '✓ Sincronização gravada.')}
              >
                Gravar
              </button>
              {dados.letra.publicada ? (
                <button type="button" className="painel-botao-destaque" disabled={ocupado} onClick={() => void gravar({ frases, publicada: false }, '✓ Tirado do ar.')}>
                  Tirar do ar
                </button>
              ) : (
                <button
                  type="button"
                  className="botao-acao"
                  disabled={ocupado || errosParaPublicar.length > 0}
                  onClick={() => void gravar({ frases, publicada: true }, '✓ Publicado. O botão do karaokê já aparece nesta faixa.')}
                >
                  Gravar e publicar
                </button>
              )}
              {dados.letra.publicada && (
                <Link className="painel-botao-destaque" href={`/${projectSlug}/karaoke/${blocoId}`} target="_blank">
                  Abrir o karaokê ↗
                </Link>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
