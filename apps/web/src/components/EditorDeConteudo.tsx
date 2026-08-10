'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { admin, type BlocoAdmin, type DetalheAdmin, type TipoBloco } from '@/lib/admin'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Editor de um conteúdo, pensado para uso no celular.
 *
 * Duas decisões que vêm do uso real, não da estética:
 *
 * 1. Cada bloco salva sozinho, com aviso de "salvo". Um botão único de
 *    "Salvar tudo" no fim da página faria o cliente perder trabalho ao trocar
 *    de app no celular no meio do cadastro.
 * 2. O upload mostra progresso e erro explícito. Enviar 30 MB de música em
 *    dado móvel demora, e uma tela parada faz a pessoa achar que travou e
 *    recarregar — perdendo o envio.
 */
export function EditorDeConteudo({
  projectSlug,
  contentSlug,
}: {
  projectSlug: string
  contentSlug: string
}) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [dados, definirDados] = useState<DetalheAdmin | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [salvandoStatus, definirSalvandoStatus] = useState(false)

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
      .detalhe(projectSlug, contentSlug)
      .then(definirDados)
      .catch((e) => definirErro(e.message))
  }, [usuario, carregando, projectSlug, contentSlug, router])

  async function alternarPublicacao() {
    if (!dados) return
    definirSalvandoStatus(true)
    definirErro(null)
    try {
      await admin.publicar(dados.content.id, dados.content.status !== 'PUBLISHED')
      definirDados(await admin.detalhe(projectSlug, contentSlug))
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Erro ao publicar')
    } finally {
      definirSalvandoStatus(false)
    }
  }

  async function recarregar() {
    definirDados(await admin.detalhe(projectSlug, contentSlug))
  }

  if (erro && !dados) return <p className="erro">{erro}</p>
  if (carregando || !dados) return <p className="vazio">Carregando...</p>

  const { content } = dados
  const publicado = content.status === 'PUBLISHED'

  return (
    <>
      <div className="cabecalho">
        <Link href={`/${projectSlug}/admin`}>← Todos os conteúdos</Link>
        {publicado && (
          <Link href={`/${projectSlug}/${content.slug}`} target="_blank">
            Ver página ↗
          </Link>
        )}
      </div>

      <h1>{content.title}</h1>

      {erro && <p className="erro">{erro}</p>}

      <div className="barra-status">
        <span className={publicado ? 'etiqueta publicado' : 'etiqueta'}>
          {publicado ? 'Publicado' : 'Rascunho'}
        </span>
        <button type="button" onClick={alternarPublicacao} disabled={salvandoStatus}>
          {salvandoStatus ? 'Aguarde...' : publicado ? 'Despublicar' : 'Publicar'}
        </button>
      </div>

      <CampoDeTexto
        rotulo="Título"
        valor={content.title}
        aoSalvar={(v) => admin.atualizarConteudo(content.id, { title: v }).then(recarregar)}
      />
      <CampoDeTexto
        rotulo="Subtítulo"
        valor={content.subtitle ?? ''}
        aoSalvar={(v) => admin.atualizarConteudo(content.id, { subtitle: v }).then(recarregar)}
      />

      <h2>Blocos da página</h2>
      {content.blocks.map((bloco) => (
        <EditorDeBloco key={bloco.id} bloco={bloco} aoMudar={recarregar} />
      ))}

      <AdicionarBloco contentId={content.id} aoMudar={recarregar} />

      {content.qrUrl && (
        <div className="caixa-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={admin.urlQrSvg(projectSlug, content.slug)} alt={`QR de ${content.title}`} />
          <div>
            QR Code gerado automaticamente.
            <br />
            <code>{content.qrUrl}</code>
            <br />
            <a href={admin.urlQrSvg(projectSlug, content.slug)} download={`qr-${content.slug}.svg`}>
              Baixar para impressão (SVG)
            </a>
          </div>
        </div>
      )}
    </>
  )
}

/** Campo de texto que salva ao sair do foco, com confirmação visível. */
function CampoDeTexto({
  rotulo,
  valor,
  aoSalvar,
  multilinha,
}: {
  rotulo: string
  valor: string
  aoSalvar: (v: string) => Promise<unknown>
  multilinha?: boolean
}) {
  const [atual, definirAtual] = useState(valor)
  const [estado, definirEstado] = useState<'parado' | 'salvando' | 'salvo'>('parado')
  const original = useRef(valor)

  useEffect(() => {
    definirAtual(valor)
    original.current = valor
  }, [valor])

  async function salvar() {
    if (atual === original.current) return
    definirEstado('salvando')
    try {
      await aoSalvar(atual)
      original.current = atual
      definirEstado('salvo')
      setTimeout(() => definirEstado('parado'), 2000)
    } catch {
      definirEstado('parado')
    }
  }

  const Campo = multilinha ? 'textarea' : 'input'
  return (
    <label className="campo-admin">
      <span>
        {rotulo}
        {estado === 'salvando' && <em> salvando...</em>}
        {estado === 'salvo' && <em className="ok"> salvo ✓</em>}
      </span>
      <Campo
        value={atual}
        rows={multilinha ? 6 : undefined}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          definirAtual(e.target.value)
        }
        onBlur={salvar}
      />
    </label>
  )
}

function EditorDeBloco({ bloco, aoMudar }: { bloco: BlocoAdmin; aoMudar: () => Promise<void> }) {
  const [enviando, definirEnviando] = useState(false)
  const [erroUpload, definirErroUpload] = useState<string | null>(null)

  const ehMidia = ['AUDIO', 'VIDEO', 'IMAGE'].includes(bloco.type)
  const ehTexto = ['TEXT', 'RICH_TEXT'].includes(bloco.type)

  async function enviar(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    definirEnviando(true)
    definirErroUpload(null)
    try {
      const asset = await admin.enviarArquivo(arquivo)
      await admin.salvarBloco(bloco.id, { assetId: asset.id })
      await aoMudar()
    } catch (e) {
      definirErroUpload(e instanceof Error ? e.message : 'Falha ao enviar o arquivo')
    } finally {
      definirEnviando(false)
      evento.target.value = ''
    }
  }

  return (
    <div className="bloco bloco-admin">
      <div className="topo-bloco">
        <span className="bloco-rotulo">{bloco.label ?? bloco.type}</span>
        <button
          type="button"
          className="remover"
          onClick={async () => {
            if (confirm('Remover este bloco? O conteúdo dele será perdido.')) {
              await admin.removerBloco(bloco.id)
              await aoMudar()
            }
          }}
        >
          Remover
        </button>
      </div>

      {ehTexto && (
        <CampoDeTexto
          rotulo="Texto"
          valor={bloco.text ?? ''}
          multilinha
          aoSalvar={(v) => admin.salvarBloco(bloco.id, { text: v })}
        />
      )}

      {ehMidia && (
        <>
          {bloco.asset ? (
            <div className="midia-atual">
              {bloco.type === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bloco.asset.url} alt="" />
              ) : (
                <audio controls src={bloco.asset.url} />
              )}
              <small>{bloco.asset.title}</small>
            </div>
          ) : (
            <p className="bloco-vazio">Nenhum arquivo enviado ainda.</p>
          )}

          <label className="enviar-arquivo">
            <input
              type="file"
              accept={
                bloco.type === 'IMAGE' ? 'image/*' : bloco.type === 'VIDEO' ? 'video/*' : 'audio/*'
              }
              onChange={enviar}
              disabled={enviando}
            />
            <span>{enviando ? 'Enviando...' : bloco.asset ? 'Trocar arquivo' : 'Enviar arquivo'}</span>
          </label>
          {enviando && (
            <small>Não feche esta tela. Arquivos grandes podem demorar no dado móvel.</small>
          )}
          {erroUpload && <p className="erro">{erroUpload}</p>}
        </>
      )}

      {(bloco.type === 'EMBED' || bloco.type === 'LINK') && (
        <CampoDeTexto
          rotulo="Endereço (URL)"
          valor={bloco.url ?? ''}
          aoSalvar={(v) => admin.salvarBloco(bloco.id, { url: v })}
        />
      )}
    </div>
  )
}

function AdicionarBloco({
  contentId,
  aoMudar,
}: {
  contentId: string
  aoMudar: () => Promise<void>
}) {
  const [tipo, definirTipo] = useState<TipoBloco>('RICH_TEXT')
  const [rotulo, definirRotulo] = useState('')

  return (
    <div className="bloco adicionar-bloco">
      <h3>Adicionar bloco</h3>
      <div className="linha-campos">
        <select value={tipo} onChange={(e) => definirTipo(e.target.value as TipoBloco)}>
          <option value="RICH_TEXT">Texto</option>
          <option value="AUDIO">Áudio ou música</option>
          <option value="VIDEO">Vídeo</option>
          <option value="IMAGE">Imagem</option>
          <option value="EMBED">Vídeo de outro site</option>
          <option value="LINK">Link</option>
        </select>
        <input
          value={rotulo}
          onChange={(e) => definirRotulo(e.target.value)}
          placeholder="Nome do bloco"
          maxLength={80}
        />
      </div>
      <button
        type="button"
        onClick={async () => {
          await admin.criarBloco(contentId, { type: tipo, label: rotulo || undefined })
          definirRotulo('')
          await aoMudar()
        }}
      >
        Adicionar
      </button>
    </div>
  )
}
