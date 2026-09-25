'use client'

import Link from 'next/link'
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
  | { tipo: 'conteudo'; contentId: string }
  | { tipo: 'faixa'; blockId: string }
  /**
   * Um PERFIL também é uma publicação: tem visitas, curtidas, comentários e
   * partilhas, e são dele. Faltava aqui, e o resultado foi o de sempre — a
   * página de outra pessoa desenhou os quatro números à mão, em `<div>`, e
   * nenhum deles fazia nada. É a terceira vez que este mesmo defeito nasce num
   * ficheiro diferente: capa do projeto, cartão da letra, e agora o perfil.
   * Enquanto houver mais do que um sítio a desenhar isto, há sempre um que
   * fica para trás.
   */
  | { tipo: 'perfil'; userId: string }
  /**
   * A OFERTA DOS CARTÕES — o cartaz por baixo dos dias.
   *
   * "Têm que ter esta funções view like comentário compartilhamento" — 25/09.
   *
   * É a quarta vez que um alvo entra neste ficheiro, e a quarta vez que a
   * alternativa era desenhar quatro números à mão noutro sítio. A nota acima diz
   * o que acontece quando isso se faz: nasce mais um conjunto de `<span>` que
   * parecem botões e não fazem nada.
   *
   * O alvo é a categoria e não o projeto: Crianças e Adultos têm cartazes
   * diferentes, e portanto conversas diferentes.
   */
  | { tipo: 'oferta'; projectSlug: string; categoria: string }

interface Pessoa {
  id: string
  displayName: string
  avatarUrl: string | null
}

const VAZIO: EstadoDaFaixa = {
  visualizacoes: 0,
  curtidas: 0,
  comentarios: 0,
  compartilhamentos: 0,
  curtidoPorMim: false,
  lista: [],
}

/** A quem se pergunta o estado, conforme o alvo. Um sítio, quatro ramos. */
function pedirEstado(alvo: AlvoSocial): Promise<EstadoDaFaixa> {
  switch (alvo.tipo) {
    case 'faixa':
      return social.estadoDaFaixa(alvo.blockId)
    case 'perfil':
      return social.estadoDoPerfil(alvo.userId)
    case 'oferta':
      return social.estadoDaOferta(alvo.projectSlug, alvo.categoria)
    default:
      return social.estado(alvo.contentId)
  }
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
  const { usuario, visitante } = useAuth()
  const [estado, definirEstado] = useState<EstadoDaFaixa>(VAZIO)
  const [comentariosAbertos, definirComentariosAbertos] = useState(false)
  const [convite, definirConvite] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)
  const [aCurtir, definirACurtir] = useState(false)
  const [quemCurtiu, definirQuemCurtiu] = useState<Pessoa[] | null>(null)

  const chave =
    alvo.tipo === 'faixa'
      ? alvo.blockId
      : alvo.tipo === 'perfil'
        ? alvo.userId
        : alvo.tipo === 'oferta'
          ? `${alvo.projectSlug}/${alvo.categoria}`
          : alvo.contentId

  // Relê quando a sessão entra. O access token só vive em memória, e à primeira
  // leitura ainda não existe: sem isto o servidor responde como responde a um
  // visitante e o coração fica vazio mesmo tendo sido a pessoa a enchê-lo.
  /**
   * Relê quando a visita desta abertura ficar registada.
   *
   * Sem isto o número mostrado é sempre o de antes da própria visita — a
   * leitura e a gravação acontecem no mesmo instante e a leitura chega
   * primeiro. Quem abre vê o número parado e conclui, com razão, que não
   * contou.
   */
  useEffect(() => {
    function releitura() {
      void pedirEstado(alvo).then(definirEstado).catch(() => {})
    }
    window.addEventListener('pv:visita-registada', releitura)
    return () => window.removeEventListener('pv:visita-registada', releitura)
  }, [chave, alvo])

  useEffect(() => {
    void pedirEstado(alvo).then(definirEstado).catch(() => {})
  }, [chave, alvo, usuario?.id])

  async function curtir() {
    if (aCurtir) return
    /*
      `visitante` E NÃO `!usuario`: durante o segundo em que a sessão está a ser
      restaurada, `usuario` ainda é nulo e quem tem conta era convidado a criar
      uma. Assim, quem toca a meio da restauração faz a acção quando ela acaba,
      em vez de levar com um convite que não é para ele.
    */
    if (visitante) {
      definirConvite('Para curtir, crie a sua conta grátis')
      return
    }
    definirACurtir(true)
    try {
      const r =
        alvo.tipo === 'faixa'
          ? await social.curtirFaixa(alvo.blockId, projectId)
          : alvo.tipo === 'perfil'
            ? await social.curtirPerfil(alvo.userId)
            : alvo.tipo === 'oferta'
              ? await social.curtirOferta(alvo.projectSlug, alvo.categoria)
              : await social.curtir(alvo.contentId, projectId)
      definirEstado((e) => ({ ...e, curtidoPorMim: r.curtido, curtidas: r.total }))
      definirAviso(null)
    } catch {
      definirAviso('Não foi possível curtir agora.')
    } finally {
      definirACurtir(false)
    }
  }

  async function mostrarQuemCurtiu() {
    const base = process.env.NEXT_PUBLIC_API_URL ?? ''
    const url =
      alvo.tipo === 'faixa'
        ? `${base}/blocks/${alvo.blockId}/people`
        : alvo.tipo === 'perfil'
          ? `${base}/profiles/${alvo.userId}/people`
          : alvo.tipo === 'oferta'
            ? null
            : `${base}/contents/${alvo.contentId}/people`
    /*
      A OFERTA AINDA NÃO TEM LISTA DE QUEM CURTIU, e o número dela não finge que
      tem: sem endereço, o toque no número não abre uma folha vazia. A regra
      dele de 25/08 — "não quero somente um número sem saber de onde ele veio" —
      cumpre-se acrescentando a rota, e não um modal que diz "ainda ninguém".
    */
    if (!url) return
    try {
      const r = await fetch(url)
      const d = r.ok ? await r.json() : { curtiram: [] }
      definirQuemCurtiu(d.curtiram ?? [])
    } catch {
      definirAviso('Não foi possível abrir a lista agora.')
    }
  }

  async function partilhar() {
    /**
     * SEM CONTA NÃO SE INTERAGE, e partilhar é interagir.
     *
     * Ele fixou a regra em 25/08, na versão mais rígida: quem não está
     * registado pode ver, e mais nada. Ao tentar curtir, comentar ou partilhar,
     * abre o pedido de cadastro.
     *
     * A razão dele é de segurança e é boa. Uma partilha leva a plataforma para
     * fora com o nome de quem a mandou, e numa comunidade infantil isso não
     * pode partir de alguém que ninguém sabe quem é. A curtida já estava
     * travada; a partilha ficou aberta e era a porta que faltava fechar.
     */
    if (visitante) {
      definirConvite('Para partilhar, crie a sua conta grátis')
      return
    }
    /**
     * O QUE SE PARTILHA É UM LINK IDENTIFICÁVEL, E NÃO O ENDEREÇO DA PÁGINA.
     *
     * Partilhava-se o endereço tal e qual. Quem o abria voltava sem nada que o
     * distinguisse de alguém que tivesse escrito o endereço à mão, e por isso o
     * painel dizia 244 acessos directos num projecto que cresce por partilha.
     * Ele apanhou-o em 26/08: "praticamente todos os acessos que eu provoquei
     * vieram de links compartilhados", e a plataforma não tinha como saber.
     *
     * O link curto já existia e ninguém o usava aqui. Ele grava de onde veio a
     * visita e conta a partilha de uma vez só, que é também o número que estava
     * a dizer 2 quando deviam ser dezenas.
     *
     * Se a criação do link falhar, parte-se o endereço simples: ficar sem
     * partilhar por causa da contagem seria trocar o principal pelo acessório.
     */
    let url = `${window.location.origin}${ligacao}`
    if (alvo.tipo === 'conteudo') {
      try {
        const curto = await social.compartilhar(alvo.contentId, projectId, 'WHATSAPP')
        url = curto.url
      } catch {
        // fica o endereço simples
      }
    } else if (alvo.tipo === 'oferta') {
      try {
        const curto = await social.compartilharOferta(alvo.projectSlug, alvo.categoria, 'WHATSAPP')
        url = curto.url
      } catch {
        // fica o endereço simples
      }
    }
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
      /*
        O conteúdo já ficou contado ao gerar o link curto, no servidor.
        Registá-lo outra vez aqui contaria a mesma partilha duas vezes, e um
        número inflacionado é tão inútil para uma apresentação como um a menos.
        A faixa e o perfil ainda não têm link próprio e continuam por evento.
      */
      // A oferta também já ficou contada ao gerar o link curto, como o conteúdo.
      if (alvo.tipo !== 'conteudo' && alvo.tipo !== 'oferta') {
        await rastrear({
          projectId,
          ...(alvo.tipo === 'faixa' ? { blockId: alvo.blockId } : {}),
          type: 'CUSTOM',
          props:
            alvo.tipo === 'perfil'
              ? { acao: 'partilhar_perfil', perfilId: alvo.userId }
              : { acao: 'partilhar_faixa' },
        })
      }
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
          {/* TOCAR NO NÚMERO MOSTRA QUEM CURTIU; tocar no coração curte.
              São duas intenções no mesmo sítio, e separá-las pelo alvo do toque
              é o que as redes sociais fazem — foi assim que ele o descreveu em
              25/08: "não quero somente um número sem saber de onde ele veio". */}
          <strong
            onClick={(ev) => {
              ev.stopPropagation()
              if (estado.curtidas > 0) void mostrarQuemCurtiu()
            }}
          >
            {abreviar(estado.curtidas)}
          </strong>
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

      {quemCurtiu && (
        <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Quem curtiu">
          <button
            type="button"
            className="fundo-clicavel"
            aria-label="Fechar"
            onClick={() => definirQuemCurtiu(null)}
          />
          <div className="folha-pessoas">
            <header>
              <h2>Quem curtiu</h2>
              <button
                type="button"
                className="fechar-x"
                aria-label="Fechar"
                onClick={() => definirQuemCurtiu(null)}
              >
                ✕
              </button>
            </header>
            {quemCurtiu.length === 0 && <p className="nota">Ainda ninguém curtiu.</p>}
            <ul className="lista-pessoas">
              {quemCurtiu.map((pessoa) => (
                <li key={pessoa.id}>
                  <Link
                    href={`/${projectSlug}/pessoa/${pessoa.id}`}
                    onClick={() => definirQuemCurtiu(null)}
                  >
                    {pessoa.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pessoa.avatarUrl} alt="" />
                    ) : (
                      <span className="inicial" aria-hidden>
                        {pessoa.displayName.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="quem">
                      <strong>{pessoa.displayName}</strong>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
                : alvo.tipo === 'perfil'
                  ? await social.comentarNoPerfil(alvo.userId, projectId, t, parentId)
                  : alvo.tipo === 'oferta'
                    ? await social.comentarNaOferta(
                        alvo.projectSlug,
                        alvo.categoria,
                        t,
                        parentId,
                      )
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
