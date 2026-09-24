import Link from 'next/link'

/**
 * A OFERTA DOS CARTÕES, POR BAIXO DOS DIAS.
 *
 * Ele descreveu-a em 24/09, em quatro frases seguidas, e a ordem delas é o
 * desenho todo: "abaixo viria esta arte", "quanto clica ja aparece o cartao
 * para editar", "editou finalizou ai vem o pagamento", "aprovou a foto com boa
 * qualidade". Esta peça é a primeira das quatro — a porta.
 *
 * O CARTAZ É DADO, E NÃO CÓDIGO. É a `capaUrl` da categoria, que ele envia no
 * painel. Trocar a arte da promoção, mudar o preço riscado, pôr um cartaz de
 * Natal em dezembro — nada disso volta a passar por mim, que é a regra que
 * governa o módulo dos cartões desde o início.
 *
 * SEM CARTAZ, NÃO HÁ BLOCO. Uma categoria sem arte não vira um retângulo vazio
 * com um botão: desaparece. A página de um projeto que ainda não vende cartões
 * fica exactamente como estava.
 */
export function OfertaDeCartoes({
  projectSlug,
  categorias,
}: {
  projectSlug: string
  categorias: Array<{ slug: string; nome: string; descricao: string | null; capaUrl: string | null }>
}) {
  const comCartaz = categorias.filter((c) => c.capaUrl)
  if (comCartaz.length === 0) return null

  return (
    <section className="oferta-cartoes" aria-label="Cartões personalizados">
      {comCartaz.map((c) => (
        /*
          O LINK É A ARTE. Sem título por cima, sem botão por baixo, sem caixa à
          volta — o cartaz dele já tem tudo isso desenhado, incluindo o "DE
          R$ 79,00" riscado e o "PERSONALIZAR MEUS 7 CARTÕES" no fundo. Repetir
          qualquer uma dessas coisas em HTML seria dizê-la duas vezes e deixar
          as duas a discordar no dia em que ele trocar a arte.

          O `aria-label` é que carrega o texto, para quem não vê a imagem.
        */
        <Link
          key={c.slug}
          href={`/${projectSlug}/cartoes?categoria=${encodeURIComponent(c.slug)}`}
          className="oferta-cartaz"
          aria-label={`Personalizar os cartões — ${c.nome}`}
        >
          <img src={c.capaUrl as string} alt="" />
        </Link>
      ))}
    </section>
  )
}
