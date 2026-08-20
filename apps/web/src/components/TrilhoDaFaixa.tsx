'use client'

import { useEffect, useState } from 'react'
import { social, type ComentarioDaFaixa, type EstadoDaFaixa } from '@/lib/social'
import { useAuth } from './ProvedorDeAuth'
import { PainelDeComentarios } from './PainelDeComentarios'
import { abreviar } from '@/lib/numeros'
import { rastrear } from '@/lib/track'
import { IconeOlho, IconeCoracao, IconeComentario, IconePartilhar } from './Icones'

/**
 * Os indicadores próprios de cada faixa: música, explicação, memorização e
 * oração, cada uma com a sua vida.
 *
 * Foi o pedido mais insistente do cliente em 19/08 — "não pode existir somente
 * uma barra geral no final" — e ele tem razão. As quatro faixas têm propósitos
 * diferentes, e uma barra única esconde precisamente o que interessa saber:
 * qual delas as famílias voltam a ouvir.
 *
 * Os comentários abrem só quando alguém toca. Quatro caixas de comentários
 * abertas na mesma página empurrariam o áudio seguinte para fora do ecrã, e
 * quem chega pelo QR Code vem para ouvir, não para ler.
 */
export function TrilhoDaFaixa({
  blockId,
  projectId,
  titulo,
}: {
  blockId: string
  projectId: string
  titulo: string
}) {
  const { usuario } = useAuth()
  const [estado, definirEstado] = useState<EstadoDaFaixa>({
    visualizacoes: 0,
    curtidas: 0,
    comentarios: 0,
    compartilhamentos: 0,
    curtidoPorMim: false,
    lista: [],
  })
  const [comentariosAbertos, definirComentariosAbertos] = useState(false)
  const [ocupado, definirOcupado] = useState(false)
  const [aviso, definirAviso] = useState<string | null>(null)

  useEffect(() => {
    void social.estadoDaFaixa(blockId).then(definirEstado).catch(() => {})
  }, [blockId])

  async function curtir() {
    if (!usuario) {
      definirAviso('Entre na sua conta para curtir.')
      return
    }
    definirOcupado(true)
    try {
      const r = await social.curtirFaixa(blockId, projectId)
      definirEstado((e) => ({ ...e, curtidoPorMim: r.curtido, curtidas: r.total }))
      definirAviso(null)
    } catch {
      definirAviso('Não foi possível curtir agora.')
    } finally {
      definirOcupado(false)
    }
  }

  async function partilhar() {
    // O endereço aponta para a âncora da própria faixa, e não para o topo da
    // letra: quem recebe o link veio por causa daquela oração, não da página.
    const url = `${window.location.origin}${window.location.pathname}#faixa-${blockId}`

    // CONTA DEPOIS, E SÓ SE FOR ATÉ AO FIM. A versão anterior registava antes
    // de abrir o menu do telemóvel, e então cancelar contava na mesma — foi o
    // que o cliente apanhou em 20/08. `navigator.share` rejeita a promessa
    // quando a pessoa desiste, e é essa rejeição que separa partilhar de
    // pensar em partilhar.
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url })
      } else {
        await navigator.clipboard?.writeText(url)
        definirAviso('Link copiado.')
      }
    } catch {
      return
    }

    try {
      await rastrear({
        projectId,
        type: 'CUSTOM',
        props: { acao: 'partilhar_faixa', blockId },
      })
      definirEstado((e) => ({ ...e, compartilhamentos: e.compartilhamentos + 1 }))
    } catch {
      // Falhar a contar não desfaz uma partilha que já aconteceu.
    }
  }




  return (
    <div className="faixa-social" id={`faixa-${blockId}`}>
      <div className="trilho sem-capa">
        <span className="indicador contagem">
          <span className="bolha">
            <IconeOlho />
          </span>
          {abreviar(estado.visualizacoes)}
        </span>

        <button
          type="button"
          className={estado.curtidoPorMim ? 'indicador curtido' : 'indicador'}
          onClick={curtir}
          disabled={ocupado}
          aria-pressed={estado.curtidoPorMim}
        >
          <span className="bolha">
            <IconeCoracao cheio={estado.curtidoPorMim} />
          </span>
          {abreviar(estado.curtidas)}
        </button>

        <button
          type="button"
          className="indicador"
          onClick={() => definirComentariosAbertos((v) => !v)}
        >
          <span className="bolha">
            <IconeComentario />
          </span>
          {abreviar(estado.comentarios)}
        </button>

        <button type="button" className="indicador" onClick={partilhar} disabled={ocupado}>
          <span className="bolha">
            <IconePartilhar />
          </span>
          {abreviar(estado.compartilhamentos)}
        </button>
      </div>

      {aviso && <p className="nota">{aviso}</p>}

      {comentariosAbertos && (
        <PainelDeComentarios
          titulo={titulo}
          comentarios={estado.lista}
          usuarioId={usuario?.id ?? null}
          avatarUrl={usuario?.avatarUrl ?? null}
          aoFechar={() => definirComentariosAbertos(false)}
          aoComentar={async (t, parentId) => {
            const novo = await social.comentarNaFaixa(blockId, projectId, t, parentId)
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
    </div>
  )
}
