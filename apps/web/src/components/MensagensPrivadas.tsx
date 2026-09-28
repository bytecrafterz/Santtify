'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './ProvedorDeAuth'
import { Voltar } from './Voltar'
import { ErroDeApi } from '@/lib/auth'
import {
  duracaoLegivel,
  mensagens,
  quando,
  tamanhoLegivel,
  type AnexoDaMensagem,
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
/** O mesmo limite do servidor, conferido antes de enviar 25 MB para nada. */
const TAMANHO_MAXIMO_ANEXO = 25 * 1024 * 1024
/** Cinco minutos de voz; ao chegar lá, a gravação envia-se sozinha. */
const MAXIMO_DE_GRAVACAO_SEG = 300

/**
 * O formato da gravação, pela ordem em que o outro lado a consegue ouvir.
 *
 * AAC em MP4 toca em qualquer telemóvel, iPhone incluído; o Chrome recente e
 * o Safari gravam-no. Os que não gravam caem para Opus em WebM.
 */
const FORMATOS_DE_VOZ = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
]

function extensaoDaVoz(mime: string) {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

/**
 * O GRAVADOR DE VOZ.
 *
 * Grava no próprio navegador, com o microfone que a pessoa autorizar. Nada
 * sai do aparelho até ela carregar em enviar; cancelar deita tudo fora.
 */
function useGravador(aoChegarAoLimite: () => void) {
  const [suportado, definirSuportado] = useState(false)
  const [aGravar, definirAGravar] = useState(false)
  const [segundos, definirSegundos] = useState(0)
  const gravador = useRef<MediaRecorder | null>(null)
  const pedacos = useRef<Blob[]>([])
  const inicio = useRef(0)
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null)
  const limite = useRef(aoChegarAoLimite)
  limite.current = aoChegarAoLimite

  useEffect(() => {
    definirSuportado(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')
  }, [])

  const largarMicrofone = useCallback(() => {
    gravador.current?.stream.getTracks().forEach((t) => t.stop())
    if (relogio.current) clearInterval(relogio.current)
    relogio.current = null
  }, [])

  // Sair da conversa a meio de uma gravação desliga o microfone.
  useEffect(() => largarMicrofone, [largarMicrofone])

  async function comecar() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    const mime = FORMATOS_DE_VOZ.find((f) => MediaRecorder.isTypeSupported(f))
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined)
    pedacos.current = []
    r.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data)
    r.start(250)
    gravador.current = r
    inicio.current = Date.now()
    definirSegundos(0)
    definirAGravar(true)
    relogio.current = setInterval(() => {
      const s = (Date.now() - inicio.current) / 1000
      definirSegundos(s)
      if (s >= MAXIMO_DE_GRAVACAO_SEG) limite.current()
    }, 250)
  }

  function parar(): Promise<{ blob: Blob; mime: string; segundos: number } | null> {
    const r = gravador.current
    if (!r) return Promise.resolve(null)
    const duracao = (Date.now() - inicio.current) / 1000
    return new Promise((ok) => {
      r.onstop = () => {
        largarMicrofone()
        definirAGravar(false)
        const mime = (r.mimeType || 'audio/webm').split(';')[0]
        const blob = new Blob(pedacos.current, { type: mime })
        gravador.current = null
        ok(blob.size ? { blob, mime, segundos: duracao } : null)
      }
      r.stop()
    })
  }

  function cancelar() {
    const r = gravador.current
    if (r) {
      r.onstop = null
      if (r.state !== 'inactive') r.stop()
    }
    largarMicrofone()
    gravador.current = null
    pedacos.current = []
    definirAGravar(false)
  }

  return { suportado, aGravar, segundos, comecar, parar, cancelar }
}

/**
 * O ANEXO DE UMA MENSAGEM.
 *
 * Imagens e voz descarregam-se ao aparecer, para se verem e ouvirem logo;
 * ficheiros só quando a pessoa lhes toca. Tudo passa pelo token (ver
 * `baixarAnexo`), e o endereço local liberta-se quando a mensagem sai do ecrã.
 */
function Anexo({
  conversaId,
  mensagemId,
  anexo,
}: {
  conversaId: string
  mensagemId: string
  anexo: AnexoDaMensagem
}) {
  const [url, definirUrl] = useState<string | null>(null)
  const [aBaixar, definirABaixar] = useState(false)
  const [falhou, definirFalhou] = useState(false)
  const mostraLogo = anexo.tipo === 'IMAGEM' || anexo.tipo === 'AUDIO'

  useEffect(() => {
    if (!mostraLogo) return
    let vivo = true
    let criado: string | null = null
    mensagens
      .baixarAnexo(conversaId, mensagemId)
      .then((b) => {
        if (!vivo) return
        criado = URL.createObjectURL(new Blob([b], { type: anexo.mime }))
        definirUrl(criado)
      })
      .catch(() => vivo && definirFalhou(true))
    return () => {
      vivo = false
      if (criado) URL.revokeObjectURL(criado)
    }
  }, [conversaId, mensagemId, anexo.mime, mostraLogo])

  async function descarregar() {
    definirABaixar(true)
    try {
      const b = await mensagens.baixarAnexo(conversaId, mensagemId)
      // Sempre como descarga: um HTML aberto daqui correria no nosso domínio.
      const local = URL.createObjectURL(new Blob([b], { type: 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = local
      a.download = anexo.nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(local), 10000)
    } catch {
      definirFalhou(true)
    } finally {
      definirABaixar(false)
    }
  }

  if (falhou) return <p className="mp-anexo-falhou">Não foi possível abrir “{anexo.nome}”.</p>

  if (anexo.tipo === 'IMAGEM') {
    return url ? (
      <a className="mp-anexo-imagem" href={url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={anexo.nome} />
      </a>
    ) : (
      <span className="mp-anexo-imagem a-carregar" aria-label="Carregando imagem" />
    )
  }

  if (anexo.tipo === 'AUDIO') {
    return (
      <span className="mp-anexo-voz">
        <span aria-hidden="true">🎤</span>
        {url ? (
          <audio controls preload="metadata" src={url} />
        ) : (
          <span className="mp-anexo-voz-espera">Carregando áudio…</span>
        )}
        {anexo.duracaoSeg != null && <small>{duracaoLegivel(anexo.duracaoSeg)}</small>}
      </span>
    )
  }

  return (
    <button type="button" className="mp-anexo-arquivo" onClick={() => void descarregar()} disabled={aBaixar}>
      <span className="mp-anexo-icone" aria-hidden="true">📄</span>
      <span className="mp-anexo-dados">
        <strong>{anexo.nome}</strong>
        <small>{aBaixar ? 'Baixando…' : `${tamanhoLegivel(anexo.bytes)} · toque para baixar`}</small>
      </span>
    </button>
  )
}

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

/**
 * ✓ ENVIADA, ✓✓ LIDA.
 *
 * "Make sure a checkmark appears to indicate whether the other person has
 * read the message" — 28/09. Os mesmos sinais do WhatsApp, que toda a gente
 * já sabe ler: um visto quando chegou, dois e em destaque quando foi lida.
 */
function Vistos({ vista }: { vista: boolean }) {
  return (
    <span
      className={vista ? 'mp-vistos lida' : 'mp-vistos'}
      role="img"
      aria-label={vista ? 'Lida' : 'Enviada'}
      title={vista ? 'Lida' : 'Enviada'}
    >
      {vista ? '✓✓' : '✓'}
    </span>
  )
}

/* ── A lista ─────────────────────────────────────────────────────────── */

export function ListaDeConversas({ projectSlug }: { projectSlug: string }) {
  const { usuario, aviso } = useSessao(projectSlug)
  const [lista, definirLista] = useState<ResumoDaConversa[] | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aApagar, definirAApagar] = useState<string | null>(null)
  // As que se apagaram aqui. Uma leitura da lista que já ia a caminho quando
  // se apagou traria a conversa de volta por uns segundos.
  const apagadas = useRef(new Set<string>())

  useEffect(() => {
    if (!usuario) return
    let vivo = true
    const carregar = () =>
      mensagens
        .listar()
        .then((l) => vivo && (definirLista(l.filter((c) => !apagadas.current.has(c.id))), definirErro(null)))
        .catch((e) => vivo && definirErro(e instanceof ErroDeApi ? e.message : 'Sem ligação.'))
    void carregar()
    const t = setInterval(() => document.visibilityState === 'visible' && void carregar(), INTERVALO_DA_LISTA)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [usuario])

  /**
   * TIRAR ALGUÉM DA LISTA — "make i can delete users from chatting list",
   * 28/09. Só o Kanari vê o 🗑 (e o servidor só a ele obedece). A conversa
   * some para os dois, com as mensagens e os arquivos; por isso pergunta
   * antes, com o nome da pessoa.
   */
  async function apagarConversa(c: ResumoDaConversa) {
    if (
      !confirm(
        `Apagar a conversa com ${c.outra.displayName}? Ela some da lista dos dois, com todas as mensagens e arquivos, e não há como desfazer.`,
      )
    )
      return
    definirAApagar(c.id)
    try {
      await mensagens.apagarConversa(c.id)
      apagadas.current.add(c.id)
      definirLista((l) => l && l.filter((x) => x.id !== c.id))
      definirErro(null)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível apagar a conversa.')
    } finally {
      definirAApagar(null)
    }
  }

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
                    {c.ultima?.minha && <Vistos vista={c.ultima.vista} />}
                    {c.ultima ? c.ultima.texto : 'Conversa nova'}
                  </span>
                </span>
                {c.naoLidas > 0 && (
                  <span className="mp-contador" aria-label={`${c.naoLidas} por ler`}>
                    {c.naoLidas}
                  </span>
                )}
              </Link>
              {/* Fora do link: um botão dentro de um <a> abria a conversa. */}
              {c.podeApagar && (
                <button
                  type="button"
                  className="mp-apagar-tudo"
                  disabled={aApagar === c.id}
                  onClick={() => void apagarConversa(c)}
                  aria-label={`Apagar a conversa com ${c.outra.displayName}`}
                  title="Apagar conversa"
                >
                  🗑
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── A conversa ──────────────────────────────────────────────────────── */

/**
 * Até ao fim da PÁGINA, não até à última mensagem: a barra de escrever fica
 * por cima do fundo do ecrã, e alinhar a última mensagem com ele deixava-a
 * escondida atrás da barra.
 */
function irAoFim() {
  window.scrollTo({ top: document.documentElement.scrollHeight })
}

export function ConversaPrivada({ projectSlug, conversaId }: { projectSlug: string; conversaId: string }) {
  const { usuario, aviso } = useSessao(projectSlug)
  const [outra, definirOutra] = useState<PessoaDaConversa | null>(null)
  const [lista, definirLista] = useState<MensagemPrivada[]>([])
  const [texto, definirTexto] = useState('')
  const [aEnviar, definirAEnviar] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const mensagensRef = useRef<HTMLDivElement | null>(null)
  /** Se a pessoa está no fim da conversa — e por isso deve continuar lá. */
  const colado = useRef(true)
  const ultimaVista = useRef<string | null>(null)
  const escolherArquivo = useRef<HTMLInputElement | null>(null)
  const [podeApagar, definirPodeApagar] = useState(false)
  /** As mensagens escolhidas para apagar — só para quem pode apagar. */
  const [escolhidas, definirEscolhidas] = useState<Set<string>>(new Set())
  const aEscolher = escolhidas.size > 0
  const enviarGravacaoRef = useRef<() => void>(() => {})
  const gravador = useGravador(() => enviarGravacaoRef.current())

  const carregar = useCallback(async () => {
    try {
      const r = await mensagens.ver(conversaId)
      definirOutra(r.outra)
      definirPodeApagar(r.podeApagar)
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
      colado.current = true
      irAoFim()
    }
  }, [lista])

  // Quem está no fim continua no fim. Fotos e áudios chegam DEPOIS do texto e
  // fazem a conversa crescer: sem isto, a conversa abria e o fim fugia para
  // baixo do ecrã (28/09). Quem subiu para reler fica onde está.
  useEffect(() => {
    const medir = () => {
      const h = document.documentElement
      colado.current = h.scrollHeight - window.innerHeight - window.scrollY < 120
    }
    window.addEventListener('scroll', medir, { passive: true })
    const caixa = mensagensRef.current
    const observador =
      caixa && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (colado.current) irAoFim()
          })
        : null
    if (caixa) observador?.observe(caixa)
    return () => {
      window.removeEventListener('scroll', medir)
      observador?.disconnect()
    }
  }, [usuario])

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

  function alternarEscolha(id: string) {
    definirEscolhidas((atual) => {
      const nova = new Set(atual)
      if (nova.has(id)) nova.delete(id)
      else nova.add(id)
      return nova
    })
  }

  async function apagarEscolhidas() {
    const ids = [...escolhidas]
    const n = ids.length
    if (!confirm(`Apagar ${n === 1 ? 'esta mensagem' : `estas ${n} mensagens`}? Some${n === 1 ? '' : 'm'} para os dois, e não há como desfazer.`)) return
    try {
      await mensagens.apagarMensagens(conversaId, ids)
      definirLista((l) => l.filter((m) => !escolhidas.has(m.id)))
      definirEscolhidas(new Set())
      definirErro(null)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível apagar.')
    }
  }

  async function apagarHistorico() {
    if (
      !confirm(
        'Apagar TODO o histórico desta conversa? As mensagens e os arquivos somem para os dois, e não há como desfazer.',
      )
    )
      return
    try {
      await mensagens.apagarHistorico(conversaId)
      definirLista([])
      definirEscolhidas(new Set())
      definirErro(null)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível apagar o histórico.')
    }
  }

  async function enviarArquivo(f: File) {
    if (f.size > TAMANHO_MAXIMO_ANEXO) {
      definirErro('O arquivo passa de 25 MB.')
      return
    }
    definirAEnviar(true)
    try {
      const m = await mensagens.enviarAnexo(conversaId, f, f.name)
      definirLista((l) => [...l, m])
      definirErro(null)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível enviar o arquivo.')
    } finally {
      definirAEnviar(false)
    }
  }

  async function comecarGravacao() {
    definirErro(null)
    try {
      await gravador.comecar()
    } catch {
      definirErro('Não foi possível usar o microfone. Verifique a permissão do navegador.')
    }
  }

  async function enviarGravacao() {
    const g = await gravador.parar()
    if (!g) return
    if (g.segundos < 0.7) {
      definirErro('Gravação curta demais. Mantenha a gravação por pelo menos um segundo.')
      return
    }
    definirAEnviar(true)
    try {
      const m = await mensagens.enviarAnexo(conversaId, g.blob, `voz.${extensaoDaVoz(g.mime)}`, {
        voz: true,
        duracaoSeg: Math.round(g.segundos * 10) / 10,
      })
      definirLista((l) => [...l, m])
      definirErro(null)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível enviar o áudio.')
    } finally {
      definirAEnviar(false)
    }
  }
  enviarGravacaoRef.current = () => void enviarGravacao()

  return (
    <div className="mp mp-conversa">
      {aEscolher ? (
        /*
          ESCOLHER O QUE APAGAR.

          "Selectively delete messages" — 28/09. Toca-se em cada mensagem a
          apagar, e esta barra diz quantas e apaga só essas.
        */
        <header className="mp-conversa-topo mp-escolha">
          <button
            type="button"
            className="mp-apagar-tudo"
            onClick={() => definirEscolhidas(new Set())}
            aria-label="Cancelar seleção"
          >
            ✕
          </button>
          <strong className="mp-escolha-conta">
            {escolhidas.size} {escolhidas.size === 1 ? 'selecionada' : 'selecionadas'}
          </strong>
          <button type="button" className="mp-apagar-uma" onClick={() => void apagarEscolhidas()}>
            🗑 Apagar
          </button>
        </header>
      ) : (
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
        {/* Só quem abriu a conversa vê este botão — e só ele o pode usar. */}
        {podeApagar && lista.length > 0 && (
          <button
            type="button"
            className="mp-apagar-tudo"
            onClick={() => void apagarHistorico()}
            aria-label="Apagar histórico"
            title="Apagar histórico"
          >
            🗑
          </button>
        )}
      </header>
      )}

      {aviso}
      {erro && <p className="cartoes-erro">{erro}</p>}

      {usuario && (
        <>
          <div className="mp-mensagens" aria-live="polite" ref={mensagensRef}>
            {lista.length === 0 && outra && (
              <p className="mp-vazio">Escreva a primeira mensagem para {outra.displayName}.</p>
            )}
            {lista.map((m) => (
              <div
                key={m.id}
                className={[
                  'mp-balao',
                  m.minha ? 'minha' : '',
                  escolhidas.has(m.id) ? 'escolhida' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-selected={podeApagar ? escolhidas.has(m.id) : undefined}
                onClick={(e) => {
                  if (!podeApagar) return
                  // Tocar num leitor de áudio ou num anexo não escolhe a mensagem.
                  if ((e.target as HTMLElement).closest('audio, a, button')) return
                  alternarEscolha(m.id)
                }}
              >
                {m.anexo && <Anexo conversaId={conversaId} mensagemId={m.id} anexo={m.anexo} />}
                {m.texto && <p>{m.texto}</p>}
                <time>
                  {quando(m.em)}
                  {m.minha && <Vistos vista={m.vista} />}
                </time>
              </div>
            ))}
          </div>

          {gravador.aGravar ? (
            /*
              A GRAVAR: cancelar à esquerda, o tempo ao meio, enviar à direita.
              Como no WhatsApp, que é o que toda a gente já sabe usar.
            */
            <div className="mp-escrever mp-gravando">
              <button
                type="button"
                className="mp-botao-secundario"
                onClick={gravador.cancelar}
                aria-label="Cancelar gravação"
              >
                ✕
              </button>
              <span className="mp-gravando-tempo" aria-live="polite">
                <span className="mp-gravando-ponto" aria-hidden="true" />
                {duracaoLegivel(gravador.segundos)}
                <small>Gravando…</small>
              </span>
              <button type="button" onClick={() => void enviarGravacao()} aria-label="Enviar áudio">
                ➤
              </button>
            </div>
          ) : (
          <form
            className="mp-escrever"
            onSubmit={(e) => {
              e.preventDefault()
              void enviar()
            }}
          >
            <input
              ref={escolherArquivo}
              type="file"
              className="apenas-leitor-de-ecra"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void enviarArquivo(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="mp-botao-secundario"
              onClick={() => escolherArquivo.current?.click()}
              disabled={aEnviar}
              aria-label="Enviar arquivo"
              title="Enviar arquivo"
            >
              📎
            </button>
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
            {/* Caixa vazia e microfone disponível: o botão grava. Com texto, envia. */}
            {!texto.trim() && gravador.suportado ? (
              <button
                type="button"
                onClick={() => void comecarGravacao()}
                disabled={aEnviar}
                aria-label="Gravar áudio"
                title="Gravar áudio"
              >
                🎤
              </button>
            ) : (
              <button type="submit" disabled={aEnviar || !texto.trim()} aria-label="Enviar">
                ➤
              </button>
            )}
          </form>
          )}
          {aEnviar && <p className="mp-enviando">Enviando…</p>}
        </>
      )}
    </div>
  )
}

/* ── A porta, no perfil ──────────────────────────────────────────────── */

/**
 * No PRÓPRIO perfil: "Mensagens", com o número das que estão por ler — a quem
 * administra, sempre; às outras pessoas, só quando têm alguma conversa ("all
 * users can see message button?" — 28/09). Elas não podem abrir nenhuma, e
 * sem conversas o botão levava a uma página vazia.
 * No perfil de OUTRA pessoa, e só para administradores: "Enviar mensagem".
 */
export function PortaDasMensagens({ projectSlug, pessoaId }: { projectSlug: string; pessoaId: string }) {
  const { usuario } = useAuth()
  const router = useRouter()
  const [naoLidas, definirNaoLidas] = useState(0)
  /** Quantas conversas a pessoa tem; `null` enquanto não se sabe. */
  const [conversas, definirConversas] = useState<number | null>(null)
  const [aAbrir, definirAAbrir] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const meu = !!usuario && usuario.id === pessoaId

  useEffect(() => {
    if (!meu) return
    mensagens
      .naoLidas()
      .then((r) => {
        definirNaoLidas(r.naoLidas)
        definirConversas(r.conversas)
      })
      .catch(() => {})
  }, [meu])

  if (!usuario) return null

  if (meu) {
    // Enquanto não se sabe, também não: o botão aparecia e sumia logo a seguir.
    if (usuario.role !== 'ADMIN' && !conversas) return null
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
