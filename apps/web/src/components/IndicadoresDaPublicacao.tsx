'use client'

import { useEffect, useState } from 'react'
import { social, type EstadoDaFaixa } from '@/lib/social'
import { useAuth } from './ProvedorDeAuth'
import { rastrear } from '@/lib/track'
import { abreviar } from '@/lib/numeros'
import { OlhoGrande, CoracaoGrande, BalaoGrande, SetaGrande } from './IconesGrandes'
import { PainelDeComentarios } from './PainelDeComentarios'
import { ConviteDeCadastro } from './ConviteDeCadastro'

/**
 * Os quatro indicadores de UMA publicação — o ícone em cima, o número por baixo.
 *
 * Existe um único sítio na aplicação onde estes quatro números são desenhados,
 * e é este. Havia três: o cabeçalho do perfil, o cartão da letra, e a capa do
 * projeto — e o da capa eram `<span>` sem nada por trás, números pintados que
 * pareciam botões. Enquanto forem três implementações, uma delas vai divergir
 * outra vez, e o cliente vai voltar a tocar num número que não faz nada.
 *
 * O ALVO PODE SER O CONTEÚDO OU UMA FAIXA. É a mesma fila, os mesmos gestos e o
 * mesmo desenho; muda só a quem se pergunta e a quem se responde. Foi o que ele
 * exigiu em 23/08: cada publicação com os seus próprios números.
 *
 * O olho não é botão e nunca foi. Ver mostra o número, curtir mostra quem
 * curtiu — regra dele, de 22/08.
 */
export type AlvoSocial =
  { tipo: 'conteudo'; contentId: string } | { tipo: 'faixa'; blockId: string }

const VAZIO: EstadoDaFaixa = {
  visualizacoes: 0,
  curtidas: 0,
  comentarios: 0,
  compartilhamentos: 0,
  curtidoPorMim: false,
  lista: [],
}

export function IndicadoresDaPublicacao({
  alvo,
  projectId,
  projectSlug,
  titulo,
  ligacao,
}: {
  alvo: AlvoSocial
  projectId: string
  projectSlug: string
  titulo: string
  /** O endereço a partilhar: leva a esta publicação e não à página inteira. */
  ligacao: string
}) {
  const { usuario } = useAuth()
  const [estado, definirEstado] = useState<EstadoDaFaixa>(VAZIO)
  const [comentariosAbertos, definirComentariosAbertos] = useState(false)
  const [convite, definirConvite] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)
  const [aCurtir, definirACurtir] = useState(false)

  const chave = alvo.tipo === 'faixa' ? alvo.blockId : alvo.contentId

  // Relê quando a sessão entra. O access token só vive em memória, e à primeira
  // leitura ainda não existe: sem isto o servidor responde como responde a um
  // visitante e o coração fica vazio mesmo tendo sido a pessoa a enchê-lo.
  useEffect(() => {
    const pedido =
      alvo.tipo === 'faixa' ? social.estadoDaFaixa(alvo.blockId) : social.estado(alvo.contentId)
    void pedido.then(definirEstado).catch(() => {})
  }, [chave, alvo, usuario?.id])

  async function curtir() {
    if (aCurtir) return
    if (!usuario) {
      definirConvite('Para curtir, crie a sua conta grátis')
      return
    }
    definirACurtir(true)
    try {
      const r =
        alvo.tipo === 'faixa'
          ? await social.curtirFaixa(alvo.blockId, projectId)
          : await social.curtir(alvo.contentId, projectId)
      definirEstado((e) => ({ ...e, curtidoPorMim: r.curtido, curtidas: r.total }))
      definirAviso(null)
    } catch {
      definirAviso('Não foi possível curtir agora.')
    } finally {
      definirACurtir(false)
    }
  }

  async function partilhar() {
    const url = `${window.location.origin}${ligacao}`
    try {
      // Contar ANTES de partilhar contava também quem desistia. Cancelar
      // rejeita a promessa, e cancelar não é partilhar.
      if (navigator.share) await navigator.share({ title: titulo, url })
      else {
        await navigator.clipboard?.writeText(url)
        definirAviso('Link copiado.')
      }
    } catch {
      return
    }
    try {
      await rastrear({
        projectId,
        ...(alvo.tipo === 'conteudo' ? { contentId: alvo.contentId } : { blockId: alvo.blockId }),
        type: 'CUSTOM',
        props: { acao: alvo.tipo === 'faixa' ? 'partilhar_faixa' : 'partilhar_conteudo' },
      })
      definirEstado((e) => ({ ...e, compartilhamentos: e.compartilhamentos + 1 }))
    } catch {
      // Falhar a contar não desfaz a partilha.
    }
  }

  return (
    <>
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
            const novo =
              alvo.tipo === 'faixa'
                ? await social.comentarNaFaixa(alvo.blockId, projectId, t, parentId)
                : await social.comentar(alvo.contentId, projectId, t, parentId)
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
    </>
  )
}
