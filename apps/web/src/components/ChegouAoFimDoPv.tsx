'use client'

import { useEffect, useRef } from 'react'
import { rastrear } from '@/lib/track'

/**
 * Marca quem chegou ao fim da apresentação do Produto Vivo.
 *
 * ELE PEDIU ESTE NÚMERO EM 27/08 E ELE NÃO EXISTIA. O funil tinha o primeiro
 * degrau (tocou no selo, por curiosidade) e o último (pediu para entrar no
 * grupo, por intenção), e nada pelo meio. Sem o degrau do meio não se sabe se
 * quem não entrou no grupo se desinteressou pela proposta ou nunca chegou a
 * lê-la, e são duas conclusões comerciais opostas.
 *
 * MEDE-SE PELO QUE SE VÊ, e não por deslizar até baixo. O `IntersectionObserver`
 * dispara quando este ponto, que fica logo antes do botão do grupo, entra mesmo
 * no ecrã. Deslizar depressa até ao fim sem parar não conta como ter lido, mas
 * conta como ter chegado, e é isso que o degrau diz: chegou.
 *
 * UMA VEZ POR VISITA. Sem a marca, a mesma pessoa a subir e a descer contaria
 * cinco vezes, e o número do meio ficaria maior do que o de cima — que é o tipo
 * de gráfico que ninguém consegue apresentar a uma empresa.
 */
export function ChegouAoFimDoPv({ projectId }: { projectId: string }) {
  const marca = useRef<HTMLDivElement | null>(null)
  const jaContou = useRef(false)

  useEffect(() => {
    const alvo = marca.current
    if (!alvo || jaContou.current) return
    if (typeof IntersectionObserver === 'undefined') return

    /**
     * SE A PÁGINA CABE NO ECRÃ, CHEGAR AO FIM NÃO QUER DIZER NADA.
     *
     * Publiquei isto e o painel ficou a dizer 1 clique no Produto Vivo e 2
     * chegaram ao fim: o degrau do meio maior do que o de cima, que é um funil
     * impossível. A causa é que a página do PV ainda não tem conteúdo nenhum e
     * tem 579px num ecrã de 844: toda a gente que a abre vê o fim no mesmo
     * instante, sem ter lido coisa nenhuma.
     *
     * Enquanto não houver o que deslizar, este número não é medido. Fica a
     * zero, que é a verdade, em vez de um número que contradiz o de cima. Assim
     * que ele carregar as artes do Produto Vivo, começa a medir sozinho.
     */
    const precisaDeDeslizar = document.documentElement.scrollHeight > window.innerHeight * 1.2
    if (!precisaDeDeslizar) return

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting) || jaContou.current) return
        jaContou.current = true
        observador.disconnect()
        void rastrear({ projectId, type: 'CUSTOM', props: { acao: 'pv_ate_ao_fim' } })
      },
      { threshold: 0.6 },
    )
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [projectId])

  return <div ref={marca} className="marca-fim-pv" aria-hidden />
}
