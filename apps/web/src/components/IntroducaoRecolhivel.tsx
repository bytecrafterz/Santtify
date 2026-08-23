'use client'

import { useEffect, useState } from 'react'

/**
 * A introdução do projeto: inteira na primeira visita, recolhida depois.
 *
 * Pedido dele em 23/08 — "depois que o usuário já tiver visto a Introdução uma
 * vez, ela deve ficar recolhida; o Alfabeto deve subir e ficar imediatamente
 * abaixo do perfil, sem textos desnecessários ocupando a tela". Tem razão: um
 * texto de apresentação é útil uma vez e é um obstáculo todas as outras.
 *
 * A marca fica no telemóvel de quem visita, e não na conta. Quem chega pelo QR
 * Code de um cartão impresso não tem conta nenhuma, e é justamente essa pessoa
 * que precisa de ver a introdução da primeira vez.
 *
 * NÃO DESAPARECE — recolhe. Continua a dar-se ao toque de quem quiser, porque
 * é ali que está a explicação do projeto e o áudio de apresentação. Esconder
 * de vez obrigaria a pessoa a procurar aquilo que ela viu uma vez e quer rever.
 *
 * O primeiro instante é deliberadamente vazio. Não sei o que a pessoa já viu
 * até ler o telemóvel dela, e isso só acontece no navegador; se eu escolhesse
 * um dos dois estados por omissão, metade das visitas via a introdução abrir e
 * fechar-se sozinha à frente dos olhos, que é pior do que esperar um instante.
 */
const CHAVE = 'pv_introducao_vista'

export function IntroducaoRecolhivel({
  nome,
  children,
}: {
  nome: string
  children: React.ReactNode
}) {
  const [aberta, definirAberta] = useState<boolean | null>(null)

  useEffect(() => {
    let vista = false
    try {
      vista = window.localStorage.getItem(CHAVE) === 'sim'
    } catch {
      // Navegação privada ou dados de site bloqueados: mostra-se a introdução.
    }
    definirAberta(!vista)
    // Marca-se logo. Ver uma vez é ver uma vez, mesmo que a pessoa saia a
    // meio — se só marcasse ao chegar ao fim, quem passa a correr veria a
    // introdução inteira em todas as visitas.
    try {
      window.localStorage.setItem(CHAVE, 'sim')
    } catch {
      // Sem onde guardar, volta a aparecer. É o pior caso e é aceitável.
    }
  }, [])

  if (aberta === null) return <div className="introducao-a-decidir" aria-hidden />

  if (!aberta) {
    return (
      <button
        type="button"
        className="introducao-recolhida"
        onClick={() => definirAberta(true)}
        aria-expanded={false}
      >
        <span>Sobre o {nome}</span>
        <span className="seta" aria-hidden>
          ⌄
        </span>
      </button>
    )
  }

  return (
    <section className="introducao-aberta">
      {children}
      <button
        type="button"
        className="recolher-introducao"
        onClick={() => definirAberta(false)}
        aria-expanded
      >
        Recolher <span aria-hidden>⌃</span>
      </button>
    </section>
  )
}
