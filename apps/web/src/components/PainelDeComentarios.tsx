'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
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
  projectSlug,
  titulo,
  comentarios,
  usuarioId,
  avatarUrl,
  aoFechar,
  aoComentar,
  aoApagar,
  aoActualizar,
}: {
  projectSlug: string
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

  /**
   * Arrastar a alça para baixo fecha, como em qualquer aplicação.
   *
   * O cliente reparou que a barra de cima parecia uma alça e não era. Aqui ela
   * passa a ser: a folha acompanha o dedo enquanto desce e fecha se a pessoa
   * arrastar o suficiente.
   *
   * Os 90 pixéis de limiar existem para separar arrastar de tocar. Sem eles,
   * um toque na alça — que é o gesto de quem quer FECHAR pelo botão — mexia a
   * folha alguns pixéis e ela voltava, parecendo que o toque falhou.
   */
  const folha = useRef<HTMLDivElement>(null)
  const inicioY = useRef<number | null>(null)

  function arrastarInicio(e: React.TouchEvent) {
    inicioY.current = e.touches[0]?.clientY ?? null
  }

  function arrastando(e: React.TouchEvent) {
    if (inicioY.current === null || !folha.current) return
    const delta = (e.touches[0]?.clientY ?? 0) - inicioY.current
    // Só para baixo: puxar para cima não estica a folha.
    folha.current.style.transform = `translateY(${Math.max(0, delta)}px)`
  }

  function arrastarFim(e: React.TouchEvent) {
    if (inicioY.current === null || !folha.current) return
    const delta = (e.changedTouches[0]?.clientY ?? 0) - inicioY.current
    inicioY.current = null
    folha.current.style.transform = ''
    if (delta > 90) aoFechar()
  }

  function curtidasDe(c: ComentarioDaFaixa) {
    return totais[c.id] ?? c._count?.reactions ?? 0
  }

  /** O que o servidor sabe, a não ser que a pessoa tenha mexido agora. */
  function euCurti(c: ComentarioDaFaixa) {
    return curtidos[c.id] ?? c.curtidoPorMim ?? false
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

  // As respostas ficam agrupadas debaixo do comentário a que respondem: uma
  // lista plana faz perder o fio à conversa logo na terceira resposta.
  /**
   * Duas alturas de recuo, e nada se perde por baixo delas.
   *
   * Antes só se desenhavam dois níveis: uma resposta a uma resposta era
   * gravada e nunca aparecia. O cliente respondeu três vezes, não viu nada e
   * concluiu que o sistema recusava a mensagem — e a mensagem estava lá, só
   * não tinha onde ser mostrada.
   *
   * A sugestão dele é a certa: se o recuo não pode continuar, a resposta fica
   * ao mesmo nível, mas aparece. Recuar sem fim também não serve — ao quinto
   * nível a conversa sai do ecrã de um telemóvel.
   */
  const porId = new Map(comentarios.map((c) => [c.id, c]))

  function raizDe(c: ComentarioDaFaixa): string | null {
    let actual = c
    const vistos = new Set<string>()
    while (actual.parentId && !vistos.has(actual.id)) {
      vistos.add(actual.id) // um ciclo de dados corrompidos não pode pendurar a tela
      const pai = porId.get(actual.parentId)
      if (!pai) return actual.parentId
      actual = pai
    }
    return actual.id === c.id ? null : actual.id
  }

  const raiz = comentarios.filter((c) => !c.parentId)
  const respostasDe = (id: string) => comentarios.filter((c) => c.parentId && raizDe(c) === id)

  function Linha({ c, resposta = false }: { c: ComentarioDaFaixa; resposta?: boolean }) {
    const meu = usuarioId === c.user.id
    const curtido = euCurti(c)
    return (
      <li className={resposta ? 'comentario resposta' : 'comentario'} id={`comentario-${c.id}`}>
        {/* Fechar o painel antes de sair: deixá-lo aberto por cima da página
            nova é como se perde a noção de onde se está. */}
        <Link
          href={`/${projectSlug}/pessoa/${c.user.id}`}
          onClick={aoFechar}
          aria-label={`Ver o perfil de ${c.user.displayName}`}
        >
          {c.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar-comentario" src={c.user.avatarUrl} alt={c.user.displayName} />
          ) : (
            <span className="avatar-comentario vazio" aria-hidden>
              {c.user.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>

        <div className="corpo-comentario">
          <Link
            className="nome-de-quem-falou"
            href={`/${projectSlug}/pessoa/${c.user.id}`}
            onClick={aoFechar}
          >
            <strong>{c.user.displayName}</strong>
          </Link>
          <p>
            {c.body}
            {c.editedAt && <small className="editado"> · editado</small>}
          </p>

          <div className="acoes-comentario">
            <button type="button" onClick={() => definirAResponderA(c)}>
              Responder
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
    <div
      className="fundo-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Comentários — ${titulo}`}
    >
      <button type="button" className="fundo-clicavel" aria-label="Fechar" onClick={aoFechar} />

      <div className="folha-comentarios" ref={folha}>
        <button
          type="button"
          className="pega"
          aria-label="Fechar comentários"
          onClick={aoFechar}
          onTouchStart={arrastarInicio}
          onTouchMove={arrastando}
          onTouchEnd={arrastarFim}
        >
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
              {aEditar
                ? 'A editar o seu comentário'
                : `A responder a ${aResponderA?.user.displayName}`}
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
            <button
              type="submit"
              disabled={!usuarioId || !texto.trim() || ocupado}
              aria-label="Enviar"
            >
              ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
