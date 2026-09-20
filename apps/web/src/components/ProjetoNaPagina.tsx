'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { abreviarKM } from '@pv/cartoes'
import type { ProjetoNoCarrossel } from '@/lib/carrossel'
import { social, type ComentarioDaFaixa } from '@/lib/social'
import { useAuth } from './ProvedorDeAuth'
import { BalaoGrande, CoracaoGrande, OlhoGrande, SetaGrande } from './IconesGrandes'
import { PainelDeComentarios } from './PainelDeComentarios'
import { ConviteDeCadastro } from './ConviteDeCadastro'

/**
 * Um projeto na página inicial: a imagem, e os quatro indicadores a funcionar.
 *
 * Ele definiu-os um a um em 19/09, e é esta a regra:
 *
 *   👁 visualização = só contador, não se toca
 *   ❤️ curtida = curte o projeto inteiro
 *   💬 comentário = abre os comentários do projeto
 *   ↗️ compartilhar = abre as opções de partilha
 *   e o CARD INTEIRO abre o projeto.
 *
 * O CARD INTEIRO É UM LINK E OS BOTÕES VIVEM POR CIMA DELE. Um botão dentro de
 * um link é HTML inválido e, pior, tocar no coração navegava para o projeto. O
 * link é uma camada que cobre o card (`projeto-abrir`), e a fila dos números
 * fica acima dela — tocar num número não abre o projeto, tocar em qualquer
 * outro sítio abre.
 *
 * Os números iniciais vêm do servidor, já desenhados. Só o "curtido por mim" é
 * que se pergunta no navegador: é de quem está a olhar e não pode viajar numa
 * página guardada em cache para toda a gente.
 */
export function ProjetoNaPagina({
  projeto,
  primeiro,
}: {
  projeto: ProjetoNoCarrossel
  primeiro: boolean
}) {
  const { usuario } = useAuth()
  const [numeros, definirNumeros] = useState(projeto.numeros)
  const [curtido, definirCurtido] = useState(false)
  const [comentarios, definirComentarios] = useState<ComentarioDaFaixa[] | null>(null)
  const [abertos, definirAbertos] = useState(false)
  const [convite, definirConvite] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState(false)

  // O estado de quem está a olhar. Sem conta não há nada para perguntar.
  useEffect(() => {
    let vivo = true
    social
      .estadoDoProjeto(projeto.slug)
      .then((e) => {
        if (!vivo) return
        definirCurtido(e.curtidoPorMim)
        definirNumeros({ views: e.views, likes: e.likes, comments: e.comments, shares: e.shares })
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [projeto.slug, usuario?.id])

  /*
    SEM CONTA NÃO SE INTERAGE — a regra dele, de 25/08, e vale aqui igual.
    Ver continua livre; curtir, comentar e partilhar abrem o convite.
  */
  const precisaDeConta = (motivo: string) => {
    if (usuario) return false
    definirConvite(motivo)
    return true
  }

  const curtir = async () => {
    if (precisaDeConta('Para curtir, crie a sua conta grátis') || ocupado) return
    // O coração responde já, e o servidor confirma a seguir: numa rede lenta,
    // esperar pela resposta faz o toque parecer perdido.
    const antes = curtido
    definirCurtido(!antes)
    definirNumeros((n) => ({ ...n, likes: Math.max(0, n.likes + (antes ? -1 : 1)) }))
    definirOcupado(true)
    try {
      const r = await social.curtirProjeto(projeto.slug)
      definirCurtido(r.curtido)
      definirNumeros((n) => ({ ...n, likes: r.total }))
    } catch {
      definirCurtido(antes)
      definirNumeros((n) => ({ ...n, likes: Math.max(0, n.likes + (antes ? 1 : -1)) }))
    } finally {
      definirOcupado(false)
    }
  }

  const abrirComentarios = async () => {
    if (precisaDeConta('Para comentar, crie a sua conta grátis')) return
    definirAbertos(true)
    if (comentarios === null) {
      definirComentarios(await social.comentariosDoProjeto(projeto.slug).catch(() => []))
    }
  }

  const partilhar = async () => {
    if (precisaDeConta('Para partilhar, crie a sua conta grátis') || ocupado) return
    definirOcupado(true)
    try {
      /*
        O QUE SE PARTILHA É UM LINK IDENTIFICÁVEL, e não o endereço da página.
        É a mesma decisão das publicações: o link curto sabe de quem veio, e é
        isso que faz o número de partilhas dizer a verdade.
      */
      const { url } = await social.compartilharProjeto(projeto.slug, 'WHATSAPP')
      definirNumeros((n) => ({ ...n, shares: n.shares + 1 }))
      const texto = `${projeto.nome} — Santtify`
      if (navigator.share) await navigator.share({ title: texto, text: texto, url })
      else await navigator.clipboard?.writeText(url)
    } catch {
      /* Desistir de partilhar não é um erro para mostrar a ninguém. */
    } finally {
      definirOcupado(false)
    }
  }

  return (
    <article className="projeto-da-pagina">
      {/* A camada que abre o projeto. Cobre o card inteiro, por baixo dos
          números — pedido dele: "quero que o card inteiro seja clicável". */}
      <Link href={`/${projeto.slug}`} className="projeto-abrir" aria-label={projeto.nome}>
        <span className="projeto-imagem">
          {projeto.capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={projeto.capa}
              alt=""
              width={projeto.capaLargura ?? undefined}
              height={projeto.capaAltura ?? undefined}
              loading={primeiro ? 'eager' : 'lazy'}
              decoding="async"
            />
          ) : (
            <span className="projeto-sem-imagem" aria-hidden="true">
              {iniciais(projeto.nome)}
            </span>
          )}
        </span>
      </Link>

      <div className="indicadores-publicacao projeto-numeros">
        <span className="indicador-grande vista" title={`${numeros.views} visualizações`}>
          <span className="simbolo">
            <OlhoGrande />
          </span>
          <strong aria-hidden="true">{abreviarKM(numeros.views)}</strong>
          <span className="apenas-leitor-de-ecra">{numeros.views} visualizações</span>
        </span>

        <button
          type="button"
          className={curtido ? 'indicador-grande activo' : 'indicador-grande'}
          onClick={curtir}
          aria-pressed={curtido}
          aria-label={`Curtir ${projeto.nome}`}
        >
          <span className="simbolo">
            <CoracaoGrande cheio={curtido} />
          </span>
          <strong aria-hidden="true">{abreviarKM(numeros.likes)}</strong>
          <span className="apenas-leitor-de-ecra">{numeros.likes} curtidas</span>
        </button>

        <button
          type="button"
          className="indicador-grande"
          onClick={() => void abrirComentarios()}
          aria-label={`Comentários de ${projeto.nome}`}
        >
          <span className="simbolo">
            <BalaoGrande />
          </span>
          <strong aria-hidden="true">{abreviarKM(numeros.comments)}</strong>
          <span className="apenas-leitor-de-ecra">{numeros.comments} comentários</span>
        </button>

        <button
          type="button"
          className="indicador-grande"
          onClick={() => void partilhar()}
          aria-label={`Compartilhar ${projeto.nome}`}
        >
          <span className="simbolo">
            <SetaGrande />
          </span>
          <strong aria-hidden="true">{abreviarKM(numeros.shares)}</strong>
          <span className="apenas-leitor-de-ecra">{numeros.shares} compartilhamentos</span>
        </button>
      </div>

      {convite && (
        <ConviteDeCadastro
          projectSlug={projeto.slug}
          motivo={convite}
          aoFechar={() => definirConvite(null)}
        />
      )}

      {abertos && (
        <PainelDeComentarios
          projectSlug={projeto.slug}
          titulo={projeto.nome}
          comentarios={comentarios ?? []}
          usuarioId={usuario?.id ?? null}
          avatarUrl={usuario?.avatarUrl ?? null}
          aoFechar={() => definirAbertos(false)}
          aoComentar={async (texto, parentId) => {
            const novo = await social.comentarNoProjeto(projeto.slug, texto, parentId)
            definirComentarios((lista) => [novo, ...(lista ?? [])])
            definirNumeros((n) => ({ ...n, comments: n.comments + 1 }))
          }}
          aoApagar={async (id) => {
            await social.apagarComentario(id)
            definirComentarios((lista) => (lista ?? []).filter((c) => c.id !== id))
            definirNumeros((n) => ({ ...n, comments: Math.max(0, n.comments - 1) }))
          }}
          aoActualizar={(c) =>
            definirComentarios((lista) => (lista ?? []).map((x) => (x.id === c.id ? c : x)))
          }
        />
      )}
    </article>
  )
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
