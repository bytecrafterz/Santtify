'use client'

import Link from 'next/link'
import { Voltar } from './Voltar'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  admin,
  type BlocoAdmin,
  type CategoriaAdmin,
  type DetalheAdmin,
  type TipoBloco,
} from '@/lib/admin'
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
  const [categorias, definirCategorias] = useState<CategoriaAdmin[]>([])

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(
        `/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname),
      )
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

    // As categorias vêm separadas: se esta chamada falhar, o editor continua
    // funcionando e só o seletor de categoria fica vazio.
    admin
      .categorias(projectSlug)
      .then((r) => definirCategorias(r.categorias))
      .catch(() => definirCategorias([]))
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
        <Voltar href={`/${projectSlug}/admin`}>Todos os conteúdos</Voltar>
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

      <Capa content={content} aoMudar={recarregar} />

      <MaterialGratis content={content} aoMudar={recarregar} />

      <h2>Blocos da página</h2>
      {content.blocks.map((bloco) => (
        <EditorDeBloco key={bloco.id} bloco={bloco} categorias={categorias} aoMudar={recarregar} />
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

/**
 * O PDF gratuito desta letra.
 *
 * Fica por letra e não numa configuração geral: hoje só a letra A tem
 * demonstração grátis, e o botão no site aparece apenas onde existe arquivo.
 * Liberar outra letra depois é subir o PDF dela aqui — sem me chamar.
 */
function MaterialGratis({
  content,
  aoMudar,
}: {
  content: DetalheAdmin['content']
  aoMudar: () => void
}) {
  const [enviando, definirEnviando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return
    definirErro(null)
    definirEnviando(true)
    try {
      // Uma chamada só: o servidor converte a fotografia em PDF se for preciso.
      await admin.enviarMaterialGratis(content.id, arquivo)
      aoMudar()
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível enviar')
    } finally {
      definirEnviando(false)
    }
  }

  return (
    <div className="bloco capa-editor">
      <span className="bloco-rotulo">Material grátis para baixar</span>

      {content.freeFileUrl ? (
        <p className="nota">
          <strong>{content.freeFileName ?? 'Material enviado'}</strong>
          <br />O botão de baixar já aparece nesta letra.
        </p>
      ) : (
        <p className="bloco-vazio">
          Sem arquivo. Suba o PDF do cartão e o botão de baixar aparece nesta letra — só nela.
        </p>
      )}

      <label className="botao-arquivo">
        {enviando ? 'Enviando...' : content.freeFileUrl ? 'Trocar PDF' : 'Enviar PDF'}
        <input
          type="file"
          accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.heic,.webp"
          hidden
          disabled={enviando}
          onChange={(e) => enviar(e.target.files?.[0])}
        />
      </label>

      {content.freeFileUrl && (
        <button
          type="button"
          className="secundario"
          disabled={enviando}
          onClick={() => admin.definirMaterialGratis(content.id, null).then(aoMudar)}
        >
          Remover material
        </button>
      )}

      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

/**
 * A capa da letra.
 *
 * Fica antes dos blocos porque é o primeiro passo do fluxo que o cliente
 * descreveu: título, imagem, áudio, texto.
 *
 * O aviso sobre o tamanho não é decoração. A arte chega do arquivo de
 * impressão, com quase 10 MB, e é o servidor que reduz — a tela diz isso para
 * ele não achar que precisa preparar duas versões de cada uma das 26 letras.
 */
function Capa({ content, aoMudar }: { content: DetalheAdmin['content']; aoMudar: () => void }) {
  const [enviando, definirEnviando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return
    definirErro(null)
    definirEnviando(true)
    try {
      const asset = await admin.enviarArquivo(arquivo)
      await admin.definirCapa(content.id, asset.id)
      aoMudar()
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível enviar')
    } finally {
      definirEnviando(false)
    }
  }

  return (
    <div className="bloco capa-editor">
      <span className="bloco-rotulo">Imagem da letra</span>

      {content.coverUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="capa-previa" src={content.coverUrl} alt={`Capa de ${content.title}`} />
          <p className="nota">
            É esta imagem que aparece na página e na prévia do link quando alguém compartilha no
            WhatsApp.
          </p>
        </>
      ) : (
        <p className="bloco-vazio">
          Sem imagem ainda. É ela que aparece na página da letra e na prévia do link quando alguém
          compartilha.
        </p>
      )}

      <label className="botao-arquivo">
        {enviando ? 'Enviando...' : content.coverUrl ? 'Trocar imagem' : 'Enviar imagem'}
        <input
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.heic,.webp"
          hidden
          disabled={enviando}
          onChange={(e) => enviar(e.target.files?.[0])}
        />
      </label>

      {content.coverUrl && (
        <button
          type="button"
          className="secundario"
          disabled={enviando}
          onClick={() => admin.definirCapa(content.id, null).then(aoMudar)}
        >
          Remover imagem
        </button>
      )}

      <p className="nota">
        Pode mandar a imagem grande, do arquivo de impressão. O sistema reduz sozinho para o tamanho
        certo do site e monta o cartão do compartilhamento.
      </p>
      {/* O site guarda a página pronta por meio minuto para não pesar no
          servidor a cada visita. Sem este aviso, quem acabou de trocar a imagem
          abre a letra, vê a antiga e acha que não salvou. */}
      <p className="nota">Na página da letra a troca aparece em até meio minuto.</p>

      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

/** A arte de uma faixa, no painel. */
function ArteDaFaixa({ bloco, aoMudar }: { bloco: BlocoAdmin; aoMudar: () => Promise<void> }) {
  const [enviando, definirEnviando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return
    definirErro(null)
    definirEnviando(true)
    try {
      const asset = await admin.enviarArquivo(arquivo)
      await admin.definirArteDoBloco(bloco.id, asset.id)
      await aoMudar()
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível enviar')
    } finally {
      definirEnviando(false)
    }
  }

  return (
    <div className="arte-editor">
      {bloco.imageAsset?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="arte-previa" src={bloco.imageAsset.url} alt="Arte desta faixa" />
      ) : (
        <p className="nota">Sem arte própria. Esta faixa usa a imagem da letra.</p>
      )}

      <label className="botao-arquivo">
        {enviando ? 'Enviando...' : bloco.imageAsset?.url ? 'Trocar arte' : 'Enviar arte da faixa'}
        <input
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.heic,.webp"
          hidden
          disabled={enviando}
          onChange={(e) => enviar(e.target.files?.[0])}
        />
      </label>

      {bloco.imageAsset?.url && (
        <button
          type="button"
          className="secundario"
          disabled={enviando}
          onClick={() => admin.definirArteDoBloco(bloco.id, null).then(aoMudar)}
        >
          Remover arte
        </button>
      )}

      {erro && <p className="erro">{erro}</p>}
    </div>
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

function EditorDeBloco({
  bloco,
  categorias,
  aoMudar,
}: {
  bloco: BlocoAdmin
  categorias: CategoriaAdmin[]
  aoMudar: () => Promise<void>
}) {
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
        <div className="acoes-bloco">
          {/* Subir e descer em vez de arrastar: o painel é usado no celular, e
              arrastar uma lista briga com a rolagem da página. */}
          <button
            type="button"
            className="mover"
            aria-label="Subir este bloco"
            onClick={async () => {
              await admin.moverBloco(bloco.id, 'cima')
              await aoMudar()
            }}
          >
            ▲
          </button>
          <button
            type="button"
            className="mover"
            aria-label="Descer este bloco"
            onClick={async () => {
              await admin.moverBloco(bloco.id, 'baixo')
              await aoMudar()
            }}
          >
            ▼
          </button>
          <button
            type="button"
            className="remover"
            onClick={async () => {
              // O nome do ficheiro, e não "este bloco".
              // Em 22/08 ele apagou um áudio a pensar que era outro. A caixa
              // dizia "este bloco", e "este" só quer dizer alguma coisa a quem
              // já sabe qual é — que é justamente quem não precisa de perguntar.
              const nome = bloco.asset?.title || bloco.label || 'este bloco'
              if (confirm(`Remover "${nome}"? Só este será removido; os outros ficam.`)) {
                await admin.removerBloco(bloco.id)
                await aoMudar()
              }
            }}
          >
            Remover
          </button>
        </div>
      </div>

      {/* A arte desta faixa. Fica junto do áudio, e não na capa da letra,
          porque o cliente manda uma imagem por faixa: palco na música,
          versículo na memorização, oração na oração. */}
      {bloco.type === 'AUDIO' && <ArteDaFaixa bloco={bloco} aoMudar={aoMudar} />}

      {/* A categoria é o que permite à playlist tocar "só músicas" de A a Z.
          Só faz sentido em áudio: um texto não entra numa fila de reprodução. */}
      {bloco.type === 'AUDIO' && categorias.length > 0 && (
        <label className="campo-categoria">
          Categoria
          <select
            value={bloco.categoryId ?? ''}
            onChange={async (e) => {
              await admin.classificarBloco(bloco.id, e.target.value || null)
              await aoMudar()
            }}
          >
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Cada áudio é uma publicação inteira desde 23/08, com o seu próprio
          título e o seu próprio texto por baixo dos indicadores. Sem estes dois
          campos, o desenho existe e não há como o preencher: o "rótulo" passa a
          ser o título grande e este texto é a descrição que aparece na página. */}
      {ehTexto || bloco.type === 'AUDIO' ? (
        <CampoDeTexto
          rotulo={bloco.type === 'AUDIO' ? 'Texto que aparece por baixo do áudio' : 'Texto'}
          valor={bloco.text ?? ''}
          multilinha
          aoSalvar={(v) => admin.salvarBloco(bloco.id, { text: v })}
        />
      ) : null}

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
              /* As extensões vão à letra além do tipo geral. No iPhone, um ficheiro
                 descarregado para Ficheiros aparece a cinzento se o campo só pedir
                 `audio/*`: o sistema não lhe reconhece o tipo e não deixa escolher. */
              accept={
                bloco.type === 'IMAGE'
                  ? 'image/*,.jpg,.jpeg,.png,.heic,.webp'
                  : bloco.type === 'VIDEO'
                    ? 'video/*,.mp4,.mov,.m4v'
                    : undefined /* áudio: sem filtro, ver nota acima */
              }
              onChange={enviar}
              disabled={enviando}
            />
            <span>
              {enviando ? 'Enviando...' : bloco.asset ? 'Trocar arquivo' : 'Enviar arquivo'}
            </span>
          </label>
          {bloco.asset && (
            /* Tirar só o ficheiro, mantendo título, texto, imagem e posição.
               Sem isto, quem enviava o áudio errado tinha de apagar o bloco
               inteiro e refazer tudo à volta — foi o que lhe aconteceu. */
            <button
              type="button"
              className="secundario"
              disabled={enviando}
              onClick={async () => {
                await admin.salvarBloco(bloco.id, { assetId: null })
                aoMudar()
              }}
            >
              {bloco.type === 'IMAGE'
                ? 'Remover imagem'
                : bloco.type === 'VIDEO'
                  ? 'Remover vídeo'
                  : 'Remover áudio'}
            </button>
          )}
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
        {/*
          SÓ OS DOIS QUE O SITE SABE MOSTRAR.

          O painel oferecia também Vídeo, Imagem, "Vídeo de outro site" e Link.
          Nenhum deles é desenhado em página nenhuma: a página da letra mostra
          os blocos de ÁUDIO, e o texto serve de descrição da pré-visualização
          do link. Ele podia escrever um bloco de vídeo inteiro, vê-lo no
          painel, e nunca o encontrar no site — e o trabalho ficava perdido sem
          ninguém lhe dizer nada.

          Os tipos continuam todos na base de dados: o dia em que houver
          tocador de vídeo, volta a linha aqui e o que já estiver escrito
          aparece. Retirar o que não se mostra é a mesma regra de sempre — a
          tela sai, o servidor fica.
        */}
        <select value={tipo} onChange={(e) => definirTipo(e.target.value as TipoBloco)}>
          <option value="RICH_TEXT">Texto</option>
          <option value="AUDIO">Áudio ou música</option>
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
