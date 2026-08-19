'use client'

import { useEffect, useState } from 'react'
import { social, type ComentarioDaFaixa, type EstadoDaFaixa } from '@/lib/social'
import { useAuth } from './ProvedorDeAuth'
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
  const [texto, definirTexto] = useState('')
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
    try {
      await rastrear({
        projectId,
        type: 'CUSTOM',
        props: { acao: 'partilhar_faixa', blockId },
      })
      definirEstado((e) => ({ ...e, compartilhamentos: e.compartilhamentos + 1 }))
    } catch {
      // Contar é bom; partilhar é o que a pessoa pediu.
    }
    if (navigator.share) {
      await navigator.share({ title: titulo, url }).catch(() => {})
    } else {
      await navigator.clipboard?.writeText(url).catch(() => {})
      definirAviso('Link copiado.')
    }
  }

  async function comentar(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario) {
      definirAviso('Entre na sua conta para comentar.')
      return
    }
    if (!texto.trim()) return
    definirOcupado(true)
    try {
      const novo: ComentarioDaFaixa = await social.comentarNaFaixa(blockId, projectId, texto)
      definirEstado((e2) => ({
        ...e2,
        comentarios: e2.comentarios + 1,
        lista: [novo, ...e2.lista],
      }))
      definirTexto('')
      definirAviso(null)
    } catch {
      definirAviso('Não foi possível comentar agora.')
    } finally {
      definirOcupado(false)
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
        <div className="comentarios-faixa">
          {usuario ? (
            <form className="formulario-comentario" onSubmit={comentar}>
              <textarea
                rows={2}
                maxLength={2000}
                placeholder={`Comente sobre ${titulo.toLocaleLowerCase('pt')}`}
                value={texto}
                onChange={(e) => definirTexto(e.target.value)}
              />
              <button type="submit" disabled={ocupado || !texto.trim()}>
                Comentar
              </button>
            </form>
          ) : (
            <p className="nota">Entre na sua conta para comentar nesta faixa.</p>
          )}

          <ul className="lista-comentarios">
            {estado.lista.map((c) => (
              <li key={c.id}>
                <strong>{c.user.displayName}</strong>
                <p>{c.body}</p>
              </li>
            ))}
            {estado.lista.length === 0 && (
              <li className="nota">Ainda ninguém comentou esta faixa.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
