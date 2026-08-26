'use client'

import { useState } from 'react'
import { AvisoDeIdentidade } from './AvisoDeIdentidade'
import { FolhaDeInstalacao } from './FolhaDeInstalacao'

/**
 * O que recebe quem chega, e por que ordem.
 *
 * DUAS FOLHAS AO MESMO TEMPO NÃO SÃO DUAS FOLHAS, SÃO UMA A TAPAR A OUTRA.
 *
 * Ele pediu as duas coisas na mesma mensagem de 27/08: o convite a instalar o
 * ícone à entrada, e a mensagem sobre nome verdadeiro e fotografia ao criar
 * conta. Montei-as lado a lado e ficaram as duas por cima da página, com a de
 * instalar a comer os toques da outra. Quem acabava de se registar via o convite
 * a instalar e nunca chegava a ler as regras.
 *
 * A ordem é esta e tem razão de ser: primeiro as regras, que são a condição para
 * participar, e só depois o convite a instalar, que é uma conveniência. Quem já
 * tem fotografia não vê a primeira e recebe logo a segunda.
 */
export function AvisosDeEntrada({ projectSlug }: { projectSlug: string }) {
  const [identidadeAberta, definirIdentidadeAberta] = useState(false)

  return (
    <>
      <AvisoDeIdentidade projectSlug={projectSlug} aoMudar={definirIdentidadeAberta} />
      {!identidadeAberta && <FolhaDeInstalacao />}
    </>
  )
}
