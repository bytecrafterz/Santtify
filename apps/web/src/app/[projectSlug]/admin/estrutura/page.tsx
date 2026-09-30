import { redirect } from 'next/navigation'

/**
 * A ESTRUTURA RAIZ JUNTOU-SE À SEQUÊNCIA (30/09).
 *
 * "Eu simplesmente não consegui encontrar a introdução, porque ela está
 * separada e chamada de 'raiz'. Está tudo muito fragmentado." A introdução
 * passou a ser a primeira etapa do ecrã do projeto, por cima dos blocos (ver
 * `SequenciaDoAlfabeto`). Este endereço fica a levar para lá, para os links e
 * o hábito de quem já o usava.
 */
export default async function PaginaDaEstrutura({
  params,
}: {
  params: Promise<{ projectSlug: string }>
}) {
  const { projectSlug } = await params
  redirect(`/${projectSlug}/admin/alfabeto`)
}
