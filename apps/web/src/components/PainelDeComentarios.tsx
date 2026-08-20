'use client'

import { useState } from 'react'
import { social, type ComentarioDaFaixa } from '@/lib/social'
import { IconeCoracao } from './Icones'

const EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂']

/**
 * Os comentários como numa rede social, e não como um formulário.
 *
 * O cliente comparou lado a lado em 20/08 e tinha razão: uma caixa de texto
 * enorme com um botão "Comentar" por baixo é a cara de um formulário de site.
 * Numa rede social o campo é uma linha, mora fixo em baixo, e o que ocupa o
 * ecrã é a conversa.
 *
 * O painel sobe por cima da imagem e não substitui a página, porque a regra
 * dele continua a valer: ninguém sai do perfil.
 *
 * A hora de publicação não aparece, a pedido dele. Faz sentido: aqui a
 * conversa é sobre a letra, não sobre quando alguém falou.
 */
export function PainelDeComentarios({
  titulo,
  comentarios,
  usuarioId,
  avatarUrl,
  aoFechar,
  aoComentar,
  aoApagar,
  aoActualizar,
}: {
  titulo: string
  comentarios: ComentarioDaFaixa[]
  usuarioId: string | null
  avatarUrl: string | null
  aoFechar: () => void
  aoComentar: (texto: string, parentId?: string) => Promise<void>
  aoApagar: (id: string) => Promise<void>
  aoActualizar: (c: ComentarioDaFaixa) => void
}) {
  const [texto, definirTexto] = useState('')
  const [aResponderA, definirAResponderA] = useState<ComentarioDaFaixa | null>(null)
  const [aEditar, definirAEditar] = useState<ComentarioDaFaixa | null>(null)
  const [curtidos, definirCurtidos] = useState<Record<string, boolean>>({})
  const [totais, definirTotais] = useState<Record<string, number>>({})
  const [ocupado, definirOcupado] = useState(false)

  function curtidasDe(c: ComentarioDaFaixa) {
    return totais[c.id] ?? c._count?.reactions ?? 0
  }

  async function curtir(c: ComentarioDaFaixa) {
    if (!usuarioId) return
    try {
      const r = await social.curtirComentario(c.id)
      definirCurtidos((x) => ({ ...x, [c.id]: r.curtido }))
      definirTotais((x) => ({ ...x, [c.id]: r.total }))
    } catch {
      // Curtir é acessório: falhar não pode partir a conversa.
    }
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    if (!texto.trim() || ocupado) return
    definirOcupado(true)
    try {
      if (aEditar) {
        const actualizado = await social.editarComentario(aEditar.id, texto)
        aoActualizar(actualizado)
        definirAEditar(null)
      } else {
        await aoComentar(texto, aResponderA?.id)
        definirAResponderA(null)
      }
      definirTexto('')
    } finally {
      definirOcupado(false)
    }
  }

  function comecarEdicao(c: ComentarioDaFaixa) {
    definirAEditar(c)
    definirAResponderA(null)
    definirTexto(c.body)
  }

  async function partilhar(c: ComentarioDaFaixa) {
    const url = `${window.location.origin}${window.location.pathname}#comentario-${c.id}`
    if (navigator.share) await navigator.share({ text: c.body, url }).catch(() => {})
    else await navigator.clipboard?.writeText(url).catch(() => {})
  }

  // As respostas ficam agrupadas debaixo do comentário a que respondem: uma
  // lista plana faz perder o fio à conversa logo na terceira resposta.
  const raiz = comentarios.filter((c) => !c.parentId)
  const respostasDe = (id: string) => comentarios.filter((c) => c.parentId === id)

  function Linha({ c, resposta = false }: { c: ComentarioDaFaixa; resposta?: boolean }) {
    const meu = usuarioId === c.user.id
    const curtido = curtidos[c.id] ?? false
    return (
      <li className={resposta ? 'comentario resposta' : 'comentario'} id={`comentario-${c.id}`}>
        {c.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar-comentario" src={c.user.avatarUrl} alt={c.user.displayName} />
        ) : (
          <span className="avatar-comentario vazio" aria-hidden>
            {c.user.displayName.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="corpo-comentario">
          <strong>{c.user.displayName}</strong>
          <p>
            {c.body}
            {c.editedAt && <small className="editado"> · editado</small>}
          </p>

          <div className="acoes-comentario">
            <button type="button" onClick={() => definirAResponderA(c)}>
              Responder
            </button>
            <button type="button" onClick={() => partilhar(c)}>
              Partilhar
            </button>
            {meu && (
              <>
                <button type="button" onClick={() => comecarEdicao(c)}>
                  Editar
                </button>
                <button type="button" className="perigo" onClick={() => aoApagar(c.id)}>
                  Apagar
                </button>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className={curtido ? 'curtir-comentario curtido' : 'curtir-comentario'}
          onClick={() => curtir(c)}
          aria-label="Curtir comentário"
          aria-pressed={curtido}
        >
          <IconeCoracao cheio={curtido} />
          {curtidasDe(c) > 0 && <span>{curtidasDe(c)}</span>}
        </button>
      </li>
    )
  }

  return (
    <div className="fundo-modal" role="dialog" aria-modal="true" aria-label={`Comentários — ${titulo}`}>
      <button type="button" className="fundo-clicavel" aria-label="Fechar" onClick={aoFechar} />

      <div className="folha-comentarios">
        <button type="button" className="pega" aria-label="Fechar comentários" onClick={aoFechar}>
          <span className="traco" aria-hidden />
        </button>
        <h2>Comentários</h2>

        <ul className="lista-comentarios-social">
          {raiz.map((c) => (
            <div key={c.id}>
              <Linha c={c} />
              {respostasDe(c.id).map((r) => (
                <Linha key={r.id} c={r} resposta />
              ))}
            </div>
          ))}
          {comentarios.length === 0 && (
            <li className="nota">Ainda ninguém comentou. Seja a primeira pessoa.</li>
          )}
        </ul>

        <div className="rodape-comentarios">
          {(aResponderA || aEditar) && (
            <p className="nota contexto">
              {aEditar ? 'A editar o seu comentário' : `A responder a ${aResponderA?.user.displayName}`}
              <button
                type="button"
                onClick={() => {
                  definirAResponderA(null)
                  definirAEditar(null)
                  definirTexto('')
                }}
              >
                cancelar
              </button>
            </p>
          )}

          <div className="fila-emojis">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => definirTexto((t) => t + e)}>
                {e}
              </button>
            ))}
          </div>

          <form className="escrever-comentario" onSubmit={enviar}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar-comentario" src={avatarUrl} alt="" />
            ) : (
              <span className="avatar-comentario vazio" aria-hidden>
                ?
              </span>
            )}
            <input
              type="text"
              maxLength={2000}
              placeholder={usuarioId ? 'O que pensas disto?' : 'Entre na sua conta para comentar'}
              value={texto}
              onChange={(ev) => definirTexto(ev.target.value)}
              disabled={!usuarioId}
            />
            <button type="submit" disabled={!usuarioId || !texto.trim() || ocupado} aria-label="Enviar">
              ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
