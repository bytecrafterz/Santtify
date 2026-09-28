import { Prisma } from '@pv/db'

/**
 * AS DATAS NO SQL À MÃO, SEMPRE EM UTC.
 *
 * O Prisma guarda os `DateTime` em colunas `timestamp` SEM fuso, com o valor
 * em UTC. Comparar uma dessas colunas com `now()` — ou com uma data do
 * JavaScript, que chega à base com fuso — obriga o Postgres a converter, e ele
 * converte pelo fuso da SESSÃO. Numa base em UTC dá certo por acaso; numa base
 * noutro fuso, "disponível" passa a sê-lo duas ou três horas depois, e o
 * relatório do dia corta as vendas à hora errada.
 *
 * Apanhou-se nos testes de 28/09, numa base local em CEST: o painel dizia
 * R$ 39,20 disponíveis e o "Marcar como pago" dizia que não havia nada — um
 * contava com o fuso da sessão, o outro em UTC. Com estes dois, as contas não
 * dependem do fuso de ninguém.
 */

/** "Agora", como as colunas o guardam: UTC, sem fuso. */
export const AGORA = Prisma.sql`(now() AT TIME ZONE 'UTC')`

/** Um instante do JavaScript como as colunas o guardam: UTC, sem fuso. */
export function emUtc(data: Date): Prisma.Sql {
  return Prisma.sql`(${data}::timestamptz AT TIME ZONE 'UTC')`
}
