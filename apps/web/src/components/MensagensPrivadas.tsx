'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './ProvedorDeAuth'
import { Voltar } from './Voltar'
import { ErroDeApi } from '@/lib/auth'
import {
  mensagens,
  quando,
  type MensagemPrivada,
  type PessoaDaConversa,
  type ResumoDaConversa,
} from '@/lib/mensagens'

/**
 * MENSAGENS PRIVADAS — a lista e a conversa.
 *
 * Pedidas em 27/09 para o desenvolvedor e o Rossandro falarem dentro da
 * plataforma. As regras vivem no servidor (ver `mensagens.service.ts`): só um
 * administrador abre uma conversa, só os dois a vêem.
 *
 * Sem ligação permanente ao servidor: a conversa pergunta de poucos em poucos
 * segundos se há novas, e só enquanto está à vista. Para duas pessoas a
 * trocarem mensagens chega, e não há mais uma peça para manter no ar.
 */

const INTERVALO_DA_CONVERSA = 5000
const INTERVALO_DA_LISTA = 15000

/** Enquanto a sessão se restaura, ou sem sessão, o ecrã diz o que falta. */
function useSessao(projectSlug: string) {
  const { usuario, carregando } = useAuth()
  const aviso = carregando ? (
    <p className="mp-vazio">Carregando…</p>
  ) : !usuario ? (
    <p className="mp-vazio">
      <Link href={`/${projectSlug}/entrar`}>Entre na sua conta</Link> para ver as suas mensagens.
    </p>
  ) : null
  return { usuario, aviso }
}

/** A cara de alguém: a fotografia, ou a inicial num círculo. */
function Rosto({ pessoa, tamanho = 44 }: { pessoa: PessoaDaConversa; tamanho?: number }) {
  return pessoa.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="mp-rosto" src={pessoa.avatarUrl} alt="" width={tamanho} height={tamanho} />
  ) : (
    <span className="mp-rosto mp-inicial" style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      {pessoa.displayName.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/* ── A lista ─────────────────────────────────────────────────────────── */

export function ListaDeConversas({ projectSlug }: { projectSlug: string }) {
  const { usuario, aviso } = useSessao(projectSlug)
  const [lista, definirLista] = useState<ResumoDaConversa[] | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    if (!usuario) return
    let vivo = true
    const carregar = () =>
      mensagens
        .listar()
        .then((l) => vivo && (definirLista(l), definirErro(null)))
        .catch((e) => vivo && definirErro(e instanceof ErroDeApi ? e.message : 'Sem ligação.'))
    void carregar()
    const t = setInterval(() => document.visibilityState === 'visible' && void carregar(), INTERVALO_DA_LISTA)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [usuario])

  return (
    <div className="mp">
      <div className="cabecalho">
        <Voltar href={`/${projectSlug}/perfil`}>Voltar</Voltar>
      </div>
      <h1 className="mp-titulo">Mensagens</h1>
      {aviso}
      {erro && <p className="cartoes-erro">{erro}</p>}
      {usuario && lista && lista.length === 0 && (
        <p className="mp-vazio">Ainda não tem conversas.</p>
      )}
      {usuario && lista && lista.length > 0 && (
        <ul className="mp-lista">
          {lista.map((c) => (
            <li key={c.id}>
              <Link className="mp-item" href={`/${projectSlug}/mensagens/${c.id}`}>
                <Rosto pessoa={c.outra} />
                <span className="mp-item-corpo">
                  <span className="mp-item-topo">
                    <strong>{c.outra.displayName}</strong>
                    <time>{quando(c.ultima?.em ?? c.ultimaEm)}</time>
                  </span>
                  <span className={c.naoLidas ? 'mp-item-texto por-ler' : 'mp-item-texto'}>
                    {c.ultima ? `${c.ultima.minha ? 'Você: ' : ''}${c.ultima.texto}` : 'Conversa nova'}
                  </span>
                </span>
                {c.naoLidas > 0 && (
                  <span className="mp-contador" aria-label={`${c.naoLidas} por ler`}>
                    {c.naoLidas}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── A conversa ──────────────────────────────────────────────────────── */

export function ConversaPrivada({ projectSlug, conversaId }: { projectSlug: string; conversaId: string }) {
  const { usuario, aviso } = useSessao(projectSlug)
  const [outra, definirOutra] = useState<PessoaDaConversa | null>(null)
  const [lista, definirLista] = useState<MensagemPrivada[]>([])
  const [texto, definirTexto] = useState('')
  const [aEnviar, definirAEnviar] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const fundo = useRef<HTMLDivElement | null>(null)
  const ultimaVista = useRef<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const r = await mensagens.ver(conversaId)
      definirOutra(r.outra)
      definirLista(r.mensagens)
      definirErro(null)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Sem ligação.')
    }
  }, [conversaId])

  useEffect(() => {
    if (!usuario) return
    void carregar()
    const t = setInterval(() => document.visibilityState === 'visible' && void carregar(), INTERVALO_DA_CONVERSA)
    return () => clearInterval(t)
  }, [usuario, carregar])

  // Desce até ao fim quando chega uma mensagem nova — e só aí, para não
  // arrancar a pessoa do sítio onde está a reler.
  useEffect(() => {
    const ultima = lista[lista.length - 1]?.id ?? null
    if (ultima && ultima !== ultimaVista.current) {
      ultimaVista.current = ultima
      fundo.current?.scrollIntoView({ block: 'end' })
    }
  }, [lista])

  async function enviar() {
    const t = texto.trim()
    if (!t || aEnviar) return
    definirAEnviar(true)
    try {
      const m = await mensagens.enviar(conversaId, t)
      definirLista((l) => [...l, m])
      definirTexto('')
      definirErro(null)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível enviar.')
    } finally {
      definirAEnviar(false)
    }
  }

  return (
    <div className="mp mp-conversa">
      <header className="mp-conversa-topo">
        <Voltar href={`/${projectSlug}/mensagens`} />
        {outra && (
          <Link className="mp-conversa-quem" href={`/${projectSlug}/pessoa/${outra.id}`}>
            <Rosto pessoa={outra} tamanho={38} />
            <span>
              <strong>{outra.displayName}</strong>
              {outra.username && <small>@{outra.username}</small>}
            </span>
          </Link>
        )}
        <span className="mp-privada" title="Só vocês dois veem esta conversa">
          🔒 Privada
        </span>
      </header>

      {aviso}
      {erro && <p className="cartoes-erro">{erro}</p>}

      {usuario && (
        <>
          <div className="mp-mensagens" aria-live="polite">
            {lista.length === 0 && outra && (
              <p className="mp-vazio">Escreva a primeira mensagem para {outra.displayName}.</p>
            )}
            {lista.map((m) => (
              <div key={m.id} className={m.minha ? 'mp-balao minha' : 'mp-balao'}>
                <p>{m.texto}</p>
                <time>
                  {quando(m.em)}
                  {m.minha && (m.vista ? ' · visto' : '')}
                </time>
              </div>
            ))}
            <div ref={fundo} />
          </div>

          <form
            className="mp-escrever"
            onSubmit={(e) => {
              e.preventDefault()
              void enviar()
            }}
          >
            <textarea
              value={texto}
              onChange={(e) => definirTexto(e.target.value)}
              onKeyDown={(e) => {
                // Enter envia; Shift+Enter muda de linha, como em qualquer chat.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void enviar()
                }
              }}
              placeholder="Escreva uma mensagem"
              rows={1}
              maxLength={4000}
              aria-label="Mensagem"
            />
            <button type="submit" disabled={aEnviar || !texto.trim()} aria-label="Enviar">
              ➤
            </button>
          </form>
        </>
      )}
    </div>
  )
}

/* ── A porta, no perfil ──────────────────────────────────────────────── */

/**
 * No PRÓPRIO perfil: "Mensagens", com o número das que estão por ler.
 * No perfil de OUTRA pessoa, e só para administradores: "Enviar mensagem".
 */
export function PortaDasMensagens({ projectSlug, pessoaId }: { projectSlug: string; pessoaId: string }) {
  const { usuario } = useAuth()
  const router = useRouter()
  const [naoLidas, definirNaoLidas] = useState(0)
  const [aAbrir, definirAAbrir] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const meu = !!usuario && usuario.id === pessoaId

  useEffect(() => {
    if (!meu) return
    mensagens
      .naoLidas()
      .then((r) => definirNaoLidas(r.naoLidas))
      .catch(() => {})
  }, [meu])

  if (!usuario) return null

  if (meu) {
    return (
      <Link className="mp-porta" href={`/${projectSlug}/mensagens`}>
        <span aria-hidden="true">💬</span> Mensagens
        {naoLidas > 0 && <span className="mp-contador">{naoLidas}</span>}
      </Link>
    )
  }

  if (usuario.role !== 'ADMIN') return null

  return (
    <>
      <button
        type="button"
        className="mp-porta"
        disabled={aAbrir}
        onClick={async () => {
          definirAAbrir(true)
          definirErro(null)
          try {
            const { id } = await mensagens.abrir(pessoaId)
            router.push(`/${projectSlug}/mensagens/${id}`)
          } catch (e) {
            definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível abrir a conversa.')
            definirAAbrir(false)
          }
        }}
      >
        <span aria-hidden="true">💬</span> {aAbrir ? 'Abrindo…' : 'Enviar mensagem'}
      </button>
      {erro && <p className="cartoes-erro">{erro}</p>}
    </>
  )
}
