'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Bloco } from '@/lib/api'
import { social, type EstadoSocial } from '@/lib/social'
import { rastrear } from '@/lib/track'
import { abreviar } from '@/lib/numeros'
import { useAuth } from './ProvedorDeAuth'
import { PainelDeComentarios } from './PainelDeComentarios'
import { ConviteDeCadastro } from './ConviteDeCadastro'
import { OlhoGrande, CoracaoGrande, BalaoGrande, SetaGrande } from './IconesGrandes'
import { TocadorDeOnda } from './TocadorDeOnda'

/**
 * UM CONTEÚDO, UM CARTÃO.
 *
 * Antes eu desenhava um cartão por PEÇA: o texto numa caixa, o áudio noutra, e
 * o título do cartão saía como o nome interno do espaço do áudio — o cliente
 * viu um cartão chamado "1", que ele nunca escreveu. E a imagem da letra não
 * aparecia em lado nenhum, porque eu a tinha retirado dali ao corrigir uma
 * repetição: tirei a repetição e levei a imagem com ela.
 *
 * A unidade passa a ser a publicação, que é como ele pensa e como a tela de
 * publicar já funciona: título, subtítulo, imagem, texto, áudio e interações
 * numa caixa contínua, com um único selo Produto Vivo.
 *
 * É o MESMO componente para o administrador e para quem visita. Não existem
 * duas versões da página, e não pode existir: um layout que só o dono vê é um
 * layout que ninguém testa.
 */
export function CartaoDeConteudo({
  contentId,
  projectId,
  projectSlug,
  titulo,
  subtitulo,
  capa,
  blocos,
}: {
  contentId: string
  projectId: string
  projectSlug: string
  titulo: string
  subtitulo: string | null
  capa: string | null
  blocos: Bloco[]
}) {
  const { usuario } = useAuth()
  const [estado, definirEstado] = useState<EstadoSocial>({
    visualizacoes: 0,
    curtidas: 0,
    comentarios: 0,
    compartilhamentos: 0,
    curtidoPorMim: false,
    lista: [],
  })
  const [comentariosAbertos, definirComentariosAbertos] = useState(false)
  const [convite, definirConvite] = useState<string | null>(null)
  const [expandido, definirExpandido] = useState(false)
  const [aviso, definirAviso] = useState<string | null>(null)
  const aCurtir = useRef(false)

  const audios = blocos.filter((b) => b.type === 'AUDIO' && b.asset?.url)
  const textos = blocos
    .filter((b) => (b.type === 'TEXT' || b.type === 'RICH_TEXT') && b.text?.trim())
    .map((b) => b.text!.trim())
  const descricao = textos.join('\n\n')

  // Relê quando a sessão entra. Sem isto, quem abre a página e só depois é
  // reconhecido fica a ver o cartão com o coração vazio — o servidor foi
  // perguntado antes de haver alguém a quem responder. Ver a mesma nota no
  // cabeçalho do perfil.
  useEffect(() => {
    void social
      .estado(contentId)
      .then(definirEstado)
      .catch(() => {})
  }, [contentId, usuario?.id])

  async function curtir() {
    if (aCurtir.current) return
    if (!usuario) {
      definirConvite('Para curtir, crie a sua conta grátis')
      return
    }
    aCurtir.current = true
    try {
      const r = await social.curtir(contentId, projectId)
      definirEstado((e) => ({ ...e, curtidoPorMim: r.curtido, curtidas: r.total }))
      definirAviso(null)
    } catch {
      definirAviso('Não foi possível curtir agora.')
    } finally {
      aCurtir.current = false
    }
  }

  async function partilhar() {
    const url = `${window.location.origin}/${projectSlug}#conteudo-${contentId}`
    try {
      if (navigator.share) await navigator.share({ title: titulo, url })
      else {
        await navigator.clipboard?.writeText(url)
        definirAviso('Link copiado.')
      }
    } catch {
      return // cancelar não é partilhar
    }
    try {
      await rastrear({
        projectId,
        contentId,
        type: 'CUSTOM',
        props: { acao: 'partilhar_conteudo' },
      })
      definirEstado((e) => ({ ...e, compartilhamentos: e.compartilhamentos + 1 }))
    } catch {
      // Falhar a contar não desfaz a partilha.
    }
  }

  const precisaVerMais = descricao.length > 150

  return (
    <article className="cartao-publicacao" id={`conteudo-${contentId}`}>
      {capa && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="imagem-publicacao" src={capa} alt={titulo} />
      )}

      {/* Um tocador por áudio, todos dentro do mesmo cartão. */}
      {audios.map((a) => (
        <TocadorDeOnda
          key={a.id}
          bloco={a}
          projectId={projectId}
          contentId={contentId}
          rotulo={audios.length > 1 ? a.label : null}
          aoTerminar={() => {
            if (!usuario) definirConvite('Gostou desta música?')
          }}
        />
      ))}

      <div className="indicadores-publicacao">
        <span className="indicador-grande">
          <span className="simbolo">
            <OlhoGrande />
          </span>
          <strong>{abreviar(estado.visualizacoes)}</strong>
        </span>

        <button
          type="button"
          className={estado.curtidoPorMim ? 'indicador-grande activo' : 'indicador-grande'}
          onClick={curtir}
          aria-pressed={estado.curtidoPorMim}
          aria-label="Curtir"
        >
          <span className="simbolo">
            <CoracaoGrande cheio={estado.curtidoPorMim} />
          </span>
          <strong>{abreviar(estado.curtidas)}</strong>
        </button>

        <button
          type="button"
          className="indicador-grande"
          onClick={() =>
            usuario
              ? definirComentariosAbertos(true)
              : definirConvite('Para comentar, crie a sua conta grátis')
          }
          aria-label="Comentários"
        >
          <span className="simbolo">
            <BalaoGrande />
          </span>
          <strong>{abreviar(estado.comentarios)}</strong>
        </button>

        <button
          type="button"
          className="indicador-grande"
          onClick={partilhar}
          aria-label="Partilhar"
        >
          <span className="simbolo">
            <SetaGrande />
          </span>
          <strong>{abreviar(estado.compartilhamentos)}</strong>
        </button>
      </div>

      {aviso && <p className="nota">{aviso}</p>}

      <h3 className="titulo-publicacao">{titulo}</h3>
      {subtitulo && <p className="subtitulo-publicacao">{subtitulo}</p>}

      {descricao && (
        <p className={expandido ? 'descricao-publicacao' : 'descricao-publicacao cortada'}>
          {descricao}
        </p>
      )}
      {precisaVerMais && !expandido && (
        <button type="button" className="ver-mais" onClick={() => definirExpandido(true)}>
          ver mais
        </button>
      )}

      <Link className="selo-pv-rodape" href={`/${projectSlug}/produto-vivo`}>
        <span className="marca-pv" aria-hidden>
          PV
        </span>
        Produto Vivo
      </Link>

      {convite && (
        <ConviteDeCadastro
          projectSlug={projectSlug}
          motivo={convite}
          aoFechar={() => definirConvite(null)}
        />
      )}

      {comentariosAbertos && (
        <PainelDeComentarios
          projectSlug={projectSlug}
          titulo={titulo}
          comentarios={estado.lista}
          usuarioId={usuario?.id ?? null}
          avatarUrl={usuario?.avatarUrl ?? null}
          aoFechar={() => definirComentariosAbertos(false)}
          aoComentar={async (t, parentId) => {
            const novo = await social.comentar(contentId, projectId, t, parentId)
            definirEstado((x) => ({
              ...x,
              comentarios: x.comentarios + 1,
              lista: [novo, ...x.lista],
            }))
          }}
          aoApagar={async (id) => {
            await social.apagarComentario(id)
            definirEstado((x) => ({
              ...x,
              comentarios: Math.max(0, x.comentarios - 1),
              lista: x.lista.filter((c) => c.id !== id),
            }))
          }}
          aoActualizar={(c) =>
            definirEstado((x) => ({ ...x, lista: x.lista.map((y) => (y.id === c.id ? c : y)) }))
          }
        />
      )}
    </article>
  )
}
