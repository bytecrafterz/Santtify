'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { social, type EstadoSocial } from '@/lib/social'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Curtir, comentar e compartilhar.
 *
 * Regra que o cliente descreveu e que está implementada aqui: qualquer pessoa
 * VÊ a atividade — números e comentários aparecem sem conta. Para PARTICIPAR é
 * preciso estar cadastrado. Quem chega pelo QR precisa perceber que existe
 * gente ali antes de decidir criar conta; esconder isso mataria a conversão.
 */
export function BarraSocial({
  contentId,
  projectId,
  projectSlug,
  titulo,
}: {
  contentId: string
  projectId: string
  projectSlug: string
  titulo: string
}) {
  const { usuario } = useAuth()
  const [estado, definirEstado] = useState<EstadoSocial | null>(null)
  const [ocupado, definirOcupado] = useState(false)
  const [aviso, definirAviso] = useState<string | null>(null)

  useEffect(() => {
    social.estado(contentId).then(definirEstado).catch(() => definirEstado(null))
  }, [contentId])

  async function curtir() {
    if (!usuario) return definirAviso('entrar')
    definirOcupado(true)
    try {
      const r = await social.curtir(contentId, projectId)
      definirEstado((e) => (e ? { ...e, curtidoPorMim: r.curtido, curtidas: r.total } : e))
    } catch {
      /* silencioso: curtida não vale um alerta na cara da criança */
    } finally {
      definirOcupado(false)
    }
  }

  /**
   * Compartilhar: gera o link rastreável e entrega ao sistema do aparelho.
   *
   * O link precisa ser gerado ANTES de abrir a folha de compartilhamento —
   * é ele que carrega a referência de quem compartilhou, e sem isso a
   * propagação vira tráfego anônimo e a cadeia se perde.
   */
  async function compartilhar() {
    if (!usuario) return definirAviso('entrar')
    definirOcupado(true)
    try {
      const { url } = await social.compartilhar(contentId, projectId, 'WHATSAPP')
      const texto = `${titulo} — Jesus Alfabeto Saudável`

      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: texto, text: texto, url })
      } else {
        await navigator.clipboard.writeText(url)
        definirAviso('copiado')
        setTimeout(() => definirAviso(null), 2500)
      }
      definirEstado((e) => (e ? { ...e, compartilhamentos: e.compartilhamentos + 1 } : e))
    } catch (e) {
      // Cancelar a folha de compartilhamento dispara AbortError: não é erro.
      if ((e as Error)?.name !== 'AbortError') definirAviso('erro')
    } finally {
      definirOcupado(false)
    }
  }

  if (!estado) return null

  return (
    <>
      <div className="barra-social">
        <button
          type="button"
          onClick={curtir}
          disabled={ocupado}
          aria-pressed={estado.curtidoPorMim}
          className={estado.curtidoPorMim ? 'acao curtido' : 'acao'}
        >
          <span aria-hidden>{estado.curtidoPorMim ? '♥' : '♡'}</span>
          {estado.curtidas}
          <small>curtidas</small>
        </button>

        <a href="#comentarios" className="acao">
          <span aria-hidden>💬</span>
          {estado.comentarios}
          <small>comentários</small>
        </a>

        <button type="button" onClick={compartilhar} disabled={ocupado} className="acao">
          <span aria-hidden>↗</span>
          {estado.compartilhamentos}
          <small>compartilhar</small>
        </button>
      </div>

      {aviso === 'entrar' && (
        <p className="aviso-social">
          <Link href={`/${projectSlug}/entrar`}>Entre na sua conta</Link> para curtir, comentar e
          compartilhar.
        </p>
      )}
      {aviso === 'copiado' && <p className="aviso-social">Link copiado. É só colar e enviar.</p>}
      {aviso === 'erro' && <p className="aviso-social">Não deu para compartilhar agora.</p>}

      <Comentarios
        contentId={contentId}
        projectId={projectId}
        projectSlug={projectSlug}
        inicial={estado.lista}
        aoMudarTotal={(n) => definirEstado((e) => (e ? { ...e, comentarios: n } : e))}
      />
    </>
  )
}

function Comentarios({
  contentId,
  projectId,
  projectSlug,
  inicial,
  aoMudarTotal,
}: {
  contentId: string
  projectId: string
  projectSlug: string
  inicial: EstadoSocial['lista']
  aoMudarTotal: (n: number) => void
}) {
  const { usuario } = useAuth()
  const [lista, definirLista] = useState(inicial)
  const [texto, definirTexto] = useState('')
  const [enviando, definirEnviando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    const corpo = texto.trim()
    if (!corpo) return
    definirEnviando(true)
    definirErro(null)
    try {
      const novo = await social.comentar(contentId, projectId, corpo)
      const atualizada = [...lista, novo]
      definirLista(atualizada)
      aoMudarTotal(atualizada.length)
      definirTexto('')
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível comentar')
    } finally {
      definirEnviando(false)
    }
  }

  async function remover(id: string) {
    if (!confirm('Apagar este comentário?')) return
    await social.removerComentario(id)
    const atualizada = lista.filter((c) => c.id !== id)
    definirLista(atualizada)
    aoMudarTotal(atualizada.length)
  }

  return (
    <section id="comentarios" className="comentarios">
      <h2>Comentários</h2>

      {lista.length === 0 && <p className="bloco-vazio">Nenhum comentário ainda. Seja o primeiro.</p>}

      <ul className="lista">
        {lista.map((c) => (
          <li className="bloco comentario" key={c.id}>
            <div className="avatar pequeno" aria-hidden>
              {c.user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="corpo-comentario">
              <strong>{c.user.displayName}</strong>
              <p className="bloco-texto">{c.body}</p>
              <small>
                {new Date(c.createdAt).toLocaleDateString('pt-PT', {
                  day: '2-digit',
                  month: 'short',
                })}
                {usuario?.id === c.user.id && (
                  <>
                    {' · '}
                    <button type="button" className="remover" onClick={() => remover(c.id)}>
                      apagar
                    </button>
                  </>
                )}
              </small>
            </div>
          </li>
        ))}
      </ul>

      {usuario ? (
        <form className="formulario-comentario" onSubmit={enviar}>
          <textarea
            value={texto}
            onChange={(e) => definirTexto(e.target.value)}
            placeholder="Escreva um comentário"
            rows={3}
            maxLength={2000}
          />
          {erro && <p className="erro">{erro}</p>}
          <button type="submit" disabled={enviando || !texto.trim()}>
            {enviando ? 'Enviando...' : 'Comentar'}
          </button>
        </form>
      ) : (
        <p className="aviso-social">
          <Link href={`/${projectSlug}/entrar`}>Entre na sua conta</Link> para comentar.
        </p>
      )}
    </section>
  )
}
