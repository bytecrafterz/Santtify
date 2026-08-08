import { redirect } from 'next/navigation'

/**
 * Hoje existe um projeto só, então a raiz leva direto para ele. Quando o
 * painel multi-projeto da Fase 2 chegar, esta página vira a vitrine.
 */
const PROJETO_PADRAO = process.env.NEXT_PUBLIC_PROJETO_PADRAO ?? 'jesus-alfabeto-saudavel'

export default function Home() {
  redirect(`/${PROJETO_PADRAO}`)
}
