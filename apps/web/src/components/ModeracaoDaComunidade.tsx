'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { admin, type ComentarioAdmin } from '@/lib/admin'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Moderação da comunidade: apagar comentário impróprio e bloquear conta.
 *
 * Combinado com o cliente em 13/08, sem custo, porque uma área social em que o
 * dono não consegue remover conteúdo nem barrar quem abusa é uma área social
 * incompleta.
 *
 * As duas ações moram na mesma tela porque na prática são o mesmo momento: ele
 * lê um comentário impróprio e precisa decidir se remove só aquilo ou se tira a
 * pessoa. Separar em duas telas obrigaria a procurar a conta pelo nome depois.
 *
 * O comentário apagado continua na lista, marcado, em vez de sumir. Numa tela
 * de moderação, item que desaparece no instante da ação deixa a dúvida de se a
 * ação funcionou — e o dono acaba apagando duas vezes ou conferindo no telefone.
 */
export function ModeracaoDaComunidade({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [comentarios, definirComentarios] = useState<ComentarioAdmin[] | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(`/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
      return
    }
    if (usuario.role !== 'ADMIN') {
      definirErro('Esta área é restrita ao administrador.')
      return
    }
    admin
      .comentarios(projectSlug)
      .then((r) => definirComentarios(r.comments))
      .catch((e) => definirErro(e.message))
  }, [usuario, carregando, projectSlug, router])

  async function apagar(c: ComentarioAdmin) {
    if (!window.confirm('Apagar este comentário? Ele deixa de aparecer para todo mundo.')) return
    definirOcupado(c.id)
    try {
      await admin.apagarComentario(c.id)
      definirComentarios((atual) =>
        (atual ?? []).map((x) => (x.id === c.id ? { ...x, status: 'DELETED' as const } : x)),
      )
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível apagar')
    } finally {
      definirOcupado(null)
    }
  }

  async function alternarBloqueio(c: ComentarioAdmin) {
    const bloquear = c.user.status !== 'SUSPENDED'
    const pergunta = bloquear
      ? `Bloquear a conta de ${c.user.displayName}? A pessoa deixa de conseguir entrar, e os comentários que ela já escreveu continuam onde estão.`
      : `Liberar a conta de ${c.user.displayName}?`
    if (!window.confirm(pergunta)) return

    let motivo: string | undefined
    if (bloquear) {
      const escrito = window.prompt('Motivo do bloqueio (fica registrado só para você):', '')
      if (escrito === null) return
      motivo = escrito.trim() || undefined
    }

    definirOcupado(c.id)
    try {
      const r = await admin.bloquearConta(c.user.id, bloquear, motivo)
      // Uma pessoa pode ter vários comentários na lista: todos precisam refletir
      // o novo estado, senão a mesma conta apareceria bloqueada e ativa ao mesmo
      // tempo em linhas diferentes.
      definirComentarios((atual) =>
        (atual ?? []).map((x) =>
          x.user.id === c.user.id
            ? { ...x, user: { ...x.user, status: r.status as ComentarioAdmin['user']['status'] } }
            : x,
        ),
      )
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível concluir')
    } finally {
      definirOcupado(null)
    }
  }

  if (erro) return <p className="erro">{erro}</p>
  if (carregando || comentarios === null) return <p className="vazio">Carregando...</p>

  if (comentarios.length === 0) {
    return (
      <div className="bloco">
        <p className="bloco-vazio">
          Ainda não há comentários. Quando alguém comentar em uma letra, o comentário aparece
          aqui e você pode apagá-lo ou bloquear a conta.
        </p>
      </div>
    )
  }

  return (
    <ul className="lista">
      {comentarios.map((c) => {
        const apagado = c.status !== 'PUBLISHED'
        const bloqueado = c.user.status === 'SUSPENDED'
        return (
          <li className="bloco moderacao-item" key={c.id}>
            <p className="moderacao-quem">
              {c.user.displayName}
              {bloqueado && <em className="etiqueta-bloqueado">conta bloqueada</em>} ·{' '}
              {formatarData(c.createdAt)} · em{' '}
              <Link href={`/${projectSlug}/${c.content.slug}`}>{c.content.title}</Link>
              {/* Qual das quatro faixas, quando o comentário é de uma delas.
                  Moderar um comentário da oração como se fosse da música é
                  decidir sobre uma conversa que não se leu. */}
              {c.block && (
                <em className="etiqueta-faixa">
                  {c.block.category?.name ?? c.block.label ?? 'faixa'}
                </em>
              )}
            </p>

            <p className={apagado ? 'bloco-texto comentario-apagado' : 'bloco-texto'}>{c.body}</p>

            <div className="moderacao-acoes">
              <button
                type="button"
                className="recusar"
                disabled={ocupado === c.id || apagado}
                onClick={() => apagar(c)}
              >
                {apagado ? 'Apagado' : 'Apagar comentário'}
              </button>
              <button
                type="button"
                className={bloqueado ? 'aprovar' : 'recusar'}
                disabled={ocupado === c.id}
                onClick={() => alternarBloqueio(c)}
              >
                {ocupado === c.id ? 'Salvando...' : bloqueado ? 'Liberar conta' : 'Bloquear conta'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
