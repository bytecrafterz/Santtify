'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './ProvedorDeAuth'

/**
 * O aviso sobre nome verdadeiro e fotografia real, logo depois do cadastro.
 *
 * Texto dele, de 25/08, e a razão que deu é a melhor deste projeto todo:
 * "imagine a plataforma com 100 usuários e vários perfis sem foto real e usando
 * nomes que não identificam a pessoa. Uma família entrando com uma criança e
 * vendo comentários desses perfis perderia imediatamente a confiança".
 *
 * APARECE UMA VEZ E SÓ A QUEM AINDA NÃO CUMPRE. Quem já tem fotografia não o
 * vê nunca: um aviso que aparece a quem já fez o que se pede é ruído, e ruído
 * treina as pessoas a fechar avisos sem os ler — incluindo o dia em que o aviso
 * for a sério.
 *
 * E não tranca nada. Ele quer que a interação seja bloqueada a quem não
 * regularizar, mas bloquear ANTES de avisar seria punir sem ter pedido. O
 * caminho dele é o certo: primeiro o aviso, depois o bloqueio.
 */
const CHAVE = 'pv_aviso_identidade'

export function AvisoDeIdentidade({
  projectSlug,
  aoMudar,
}: {
  projectSlug: string
  /** Avisa quem está por fora se este aviso está à vista, para não se taparem. */
  aoMudar?: (visivel: boolean) => void
}) {
  const { usuario, carregando } = useAuth()
  const [mostrar, definirMostrar] = useState(false)

  useEffect(() => {
    if (carregando || !usuario) return
    if (usuario.avatarUrl) return
    try {
      if (window.localStorage.getItem(CHAVE) === usuario.id) return
    } catch {
      // Sem onde guardar, volta a aparecer. É o pior caso e é aceitável.
    }
    definirMostrar(true)
    aoMudar?.(true)
  }, [usuario, carregando, aoMudar])

  if (!mostrar) return null

  function fechar() {
    try {
      if (usuario) window.localStorage.setItem(CHAVE, usuario.id)
    } catch {
      /* nada a fazer */
    }
    definirMostrar(false)
    aoMudar?.(false)
  }

  return (
    <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Nome e fotografia">
      <div className="folha-identidade">
        <span className="emblema" aria-hidden>
          🛡️
        </span>
        <h2>Bem-vindo à nossa comunidade</h2>
        <p>
          O Jesus Alfabeto Saudável é uma plataforma cristã, infantil e familiar. Para participar,
          pedimos que use o seu <strong>nome verdadeiro</strong> e uma{' '}
          <strong>fotografia real</strong> da pessoa.
        </p>
        <p className="nota">
          Os perfis podem ser verificados pela nossa equipa, e as contas que não cumprirem estas
          regras podem ter a interação limitada. É assim que garantimos que uma família sabe com
          quem está a falar.
        </p>

        <a className="botao-acao largo" href={`/${projectSlug}/perfil/editar`} onClick={fechar}>
          COLOCAR A MINHA FOTOGRAFIA
        </a>
        <button type="button" className="folha-sair" onClick={fechar}>
          AGORA NÃO
        </button>
      </div>
    </div>
  )
}
