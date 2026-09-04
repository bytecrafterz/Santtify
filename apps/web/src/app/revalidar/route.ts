import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

/**
 * Esquecer as páginas guardadas de um perfil que acabou de mudar.
 *
 * AS PÁGINAS DELE ESTAVAM A SER GUARDADAS DURANTE 30 SEGUNDOS. Cada página
 * desenhada no servidor busca os dados com `next: { revalidate: 30 }`, e é uma
 * boa ideia para quem visita: poupa uma ida à API por cada pessoa que abre o
 * site. Só que quem acabou de trocar a própria fotografia não é um visitante, e
 * durante esses 30 segundos continuava a ver a antiga.
 *
 * Ele descreveu-o em 29/08 e a palavra dele é a pista que resolveu isto:
 * "MUITAS VEZES continuo vendo a imagem antiga". Muitas vezes, e não sempre,
 * porque dependia de quantos segundos tinham passado.
 *
 * O cabeçalho do perfil já mudava na hora — isso corrigi-o mudando o utilizador
 * da sessão. O que faltava eram as páginas que o servidor desenha: a inicial,
 * onde a fotografia dele é a capa do projecto, e o perfil visto por outra
 * pessoa. Essas não passam pela sessão de ninguém.
 *
 * NÃO PRECISA DE AUTENTICAÇÃO e não é um risco: só manda esquecer o que está
 * guardado, para ser buscado outra vez. O pior que alguém consegue fazer com
 * isto é obrigar o servidor a ir buscar dados que já ia buscar de qualquer
 * maneira. Os caminhos são montados aqui a partir de um slug, e não recebidos
 * de fora, para isto não virar uma porta de esvaziar o que se quiser.
 */
export async function POST(pedido: Request) {
  let corpo: { projectSlug?: string; userId?: string }
  try {
    corpo = await pedido.json()
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 })
  }

  const slug = (corpo.projectSlug ?? '').trim()
  // Um slug é o que está nos endereços do site. Recusar o resto evita que daqui
  // se mande esquecer caminhos que não são de projecto nenhum.
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ erro: 'projeto inválido' }, { status: 400 })
  }

  // O Produto Vivo entra desde 31/08: uma publicação nova lá também ficava
  // meio minuto sem aparecer, pela mesma razão.
  const caminhos = [`/${slug}`, `/${slug}/perfil`, `/${slug}/produto-vivo`]
  if (corpo.userId && /^[0-9a-f-]{36}$/.test(corpo.userId)) {
    caminhos.push(`/${slug}/pessoa/${corpo.userId}`)
  }

  for (const c of caminhos) revalidatePath(c)

  /*
    E AS PÁGINAS DAS LETRAS, QUE FALTAVAM.

    Ele publicou uma música com a imagem em 03/09 e ela só apareceu depois de
    recarregar. A página de cada letra também é desenhada no servidor com 30
    segundos de guarda, e esta rota nunca a esqueceu: em 29/08 eu tratei o
    perfil, em 31/08 acrescentei o Produto Vivo, e as letras — que são o
    conteúdo principal e o que os QR Codes impressos abrem — ficaram de fora
    das duas vezes.

    Esquecidas pelo padrão da rota e não uma a uma: um cartão pode mudar em
    qualquer letra, e listar as 26 seria uma lista para desactualizar no dia em
    que houver um projeto com outro número de blocos.
  */
  revalidatePath('/[projectSlug]/[contentSlug]', 'page')
  revalidatePath('/[projectSlug]/[contentSlug]/cartao', 'page')

  return NextResponse.json({ esquecidos: [...caminhos, 'as páginas das letras'] })
}
