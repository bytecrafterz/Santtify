/**
 * A PROMOÇÃO DOS CARTÕES, COM PRAZO (08/10).
 *
 * O cliente: "quero poder alterar o preço normal, o preço promocional e o
 * período da promoção no painel. A arte deve mostrar os valores e o período
 * que eu configurar."
 *
 * No preço do projeto, o promocional é o `precoUnitarioCent` e o normal é o
 * `precoDeTabelaCent` (o riscado). Dentro do período cobra-se o promocional,
 * com o normal riscado; fora dele cobra-se o normal, sem riscado nenhum. Sem
 * datas, a promoção não acaba — que é como era antes de haver datas.
 *
 * Funções puras: a caixa (`CartoesService.precoEfetivo`), a faixa da área do
 * afiliado e as simulações leem a mesma regra, e não podem discordar.
 */

export interface PeriodoDaPromocao {
  promocaoInicio: Date | null
  promocaoFim: Date | null
}

/** Agora está dentro do período? Sem datas, sim. */
export function dentroDaPromocao(p: PeriodoDaPromocao, agora = new Date()): boolean {
  if (p.promocaoInicio && agora < p.promocaoInicio) return false
  if (p.promocaoFim && agora > p.promocaoFim) return false
  return true
}

/** O que se anuncia: o normal, o promocional, e se a promoção está a decorrer. */
export function promocaoDe(
  preco: PeriodoDaPromocao & { precoUnitarioCent: number; precoDeTabelaCent: number | null },
  agora = new Date(),
) {
  const temPromocao = preco.precoDeTabelaCent != null && preco.precoDeTabelaCent > preco.precoUnitarioCent
  const normalCent = temPromocao ? (preco.precoDeTabelaCent as number) : preco.precoUnitarioCent
  const promocionalCent = temPromocao ? preco.precoUnitarioCent : null
  return {
    normalCent,
    promocionalCent,
    emCurso: promocionalCent != null && dentroDaPromocao(preco, agora),
    inicio: preco.promocaoInicio,
    fim: preco.promocaoFim,
  }
}

/**
 * "2026-10-31" no horário de Brasília: o início do dia, ou o fim dele.
 *
 * O painel escolhe dias; "até 31/10" quer dizer até ao fim de 31/10 para quem
 * compra no Brasil, e não até à meia-noite de outro fuso.
 */
export function diaDeBrasilia(dia: string, fimDoDia: boolean): Date {
  return new Date(`${dia}T${fimDoDia ? '23:59:59.999' : '00:00:00.000'}-03:00`)
}
