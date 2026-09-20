'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ErroDeApi } from '@/lib/auth'
import { OficinaDasLetras } from './OficinaDasLetras'
import {
  karaoke,
  type EstadoDaLetra,
  type KaraokeAcesso,
  type PainelDoKaraoke,
} from '@/lib/karaoke'

const ACESSOS: Array<{ valor: KaraokeAcesso; nome: string; explicacao: string }> = [
  { valor: 'TODOS', nome: 'Todos', explicacao: 'qualquer pessoa, com ou sem conta' },
  { valor: 'CONTA', nome: 'Só com conta', explicacao: 'quem não entrou é convidado a entrar' },
  { valor: 'DESLIGADO', nome: 'Desligado', explicacao: 'o botão desaparece de todas as faixas' },
]

const NIVEIS = [
  { valor: 3, nome: 'Máximo' },
  { valor: 2, nome: 'Forte' },
  { valor: 1, nome: 'Destaque' },
]

const ESTADOS: Record<EstadoDaLetra, { nome: string; pronto: boolean }> = {
  SEM_LETRA: { nome: 'sem letra', pronto: false },
  A_SINCRONIZAR: { nome: 'a sincronizar', pronto: false },
  SINCRONIZADA: { nome: 'sincronizada, não publicada', pronto: false },
  PUBLICADA: { nome: 'no ar', pronto: true },
}

/**
 * A página do karaokê no painel.
 *
 * Três coisas, pela ordem em que ele as usa: quem pode cantar, as palavras que
 * brilham em todas as músicas, e a lista das faixas com o estado de cada uma.
 * A sincronização em si vive numa página própria, uma por faixa.
 */
export function KaraokeNoPainel({ projectSlug }: { projectSlug: string }) {
  const [painel, definirPainel] = useState<PainelDoKaraoke | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [novaPalavra, definirNovaPalavra] = useState('')
  const [novoNivel, definirNovoNivel] = useState(2)
  const [filtro, definirFiltro] = useState('')

  const carregar = useCallback(async () => {
    try {
      definirPainel(await karaoke.painel(projectSlug))
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível carregar.')
    }
  }, [projectSlug])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const accao = async (chave: string, fazer: () => Promise<PainelDoKaraoke>) => {
    definirErro(null)
    definirOcupado(chave)
    try {
      definirPainel(await fazer())
      return true
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível concluir.')
      return false
    } finally {
      definirOcupado(null)
    }
  }

  if (!painel) return erro ? <p className="cartoes-erro">{erro}</p> : <p className="subtitulo">A carregar…</p>

  const termo = filtro.trim().toLowerCase()
  const faixas = termo
    ? painel.faixas.filter((f) =>
        `${f.titulo} ${f.conteudoTitulo} ${f.categoria ?? ''}`.toLowerCase().includes(termo),
      )
    : painel.faixas
  const noAr = painel.faixas.filter((f) => f.estado === 'PUBLICADA').length

  return (
    <div className="painel-cartoes">
      {erro && <p className="cartoes-erro">{erro}</p>}

      {/* Primeiro o que trabalha sozinho, depois o que ele afina à mão. */}
      <OficinaDasLetras projectSlug={projectSlug} />

      <section className="painel-bloco">
        <h2>Quem pode cantar</h2>
        <div className="karaoke-acessos" role="radiogroup" aria-label="Quem pode cantar">
          {ACESSOS.map((a) => (
            <button
              key={a.valor}
              type="button"
              role="radio"
              aria-checked={painel.acesso === a.valor}
              className={painel.acesso === a.valor ? 'painel-botao-destaque activo' : 'painel-botao-destaque'}
              disabled={ocupado !== null}
              onClick={() => void accao('acesso', () => karaoke.definirAcesso(projectSlug, a.valor))}
            >
              <strong>{a.nome}</strong>
              <span>{a.explicacao}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="painel-bloco">
        <h2>Palavras em destaque</h2>
        <p className="subtitulo">
          Estas palavras aparecem grandes e coloridas em todas as músicas. Acentos e
          maiúsculas não contam: “fé” e “FÉ” são a mesma. Pode usar duas palavras
          juntas, como “Espírito Santo”. Na sincronização de cada música ainda dá
          para marcar outras à mão.
        </p>
        <form
          className="karaoke-nova-palavra"
          onSubmit={(e) => {
            e.preventDefault()
            if (!novaPalavra.trim()) return
            void accao('palavra', () => karaoke.definirPalavra(projectSlug, novaPalavra, novoNivel)).then(
              (ok) => ok && definirNovaPalavra(''),
            )
          }}
        >
          <input
            value={novaPalavra}
            onChange={(e) => definirNovaPalavra(e.target.value)}
            placeholder="Nova palavra"
            maxLength={60}
            aria-label="Nova palavra"
          />
          <select
            value={novoNivel}
            onChange={(e) => definirNovoNivel(Number(e.target.value))}
            aria-label="Tamanho do destaque"
          >
            {NIVEIS.map((n) => (
              <option key={n.valor} value={n.valor}>
                {n.nome}
              </option>
            ))}
          </select>
          <button type="submit" className="botao-acao" disabled={ocupado !== null || !novaPalavra.trim()}>
            Acrescentar
          </button>
        </form>

        {painel.palavras.length === 0 ? (
          <p className="subtitulo">Ainda não há palavras. Comece por JESUS, CRISTO, AMOR, FÉ, LUZ…</p>
        ) : (
          <ul className="karaoke-palavras">
            {painel.palavras.map((p) => (
              <li key={p.id} className={`karaoke-palavra nivel-${p.nivel}`}>
                <span className="karaoke-palavra-texto">{p.exibicao}</span>
                <select
                  value={p.nivel}
                  aria-label={`Destaque de ${p.exibicao}`}
                  disabled={ocupado !== null}
                  onChange={(e) =>
                    void accao(`nivel-${p.id}`, () =>
                      karaoke.definirPalavra(projectSlug, p.exibicao, Number(e.target.value)),
                    )
                  }
                >
                  {NIVEIS.map((n) => (
                    <option key={n.valor} value={n.valor}>
                      {n.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Tirar ${p.exibicao}`}
                  disabled={ocupado !== null}
                  onClick={() => void accao(`apagar-${p.id}`, () => karaoke.apagarPalavra(p.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="painel-bloco">
        <h2>
          Músicas ({noAr} no ar de {painel.faixas.length})
        </h2>
        <p className="subtitulo">
          Todas as faixas com áudio. Toque numa para colar a letra e sincronizar.
        </p>
        {painel.faixas.length > 8 && (
          <input
            className="karaoke-filtro"
            value={filtro}
            onChange={(e) => definirFiltro(e.target.value)}
            placeholder="Procurar por título, letra ou categoria"
            aria-label="Procurar música"
          />
        )}
        <ul className="painel-projetos">
          {faixas.map((f) => (
            <li key={f.id} className="painel-projeto">
              <div className="painel-projeto-nome">
                <strong>{f.titulo}</strong>
                <span>
                  {f.conteudoTitulo}
                  {f.categoria ? ` · ${f.categoria}` : ''}
                  {f.estado === 'A_SINCRONIZAR' ? ` · ${f.sincronizadas} de ${f.frases} frases` : ''}
                </span>
              </div>
              <div className="painel-projeto-accoes">
                <span className={ESTADOS[f.estado].pronto ? 'painel-selo-pronto' : 'painel-selo-falta'}>
                  {ESTADOS[f.estado].nome}
                </span>
                <Link className="painel-botao-destaque" href={`/${projectSlug}/admin/karaoke/${f.id}`}>
                  {f.estado === 'SEM_LETRA' ? 'Começar' : 'Abrir'}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
