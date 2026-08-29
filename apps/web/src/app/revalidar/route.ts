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

  const caminhos = [`/${slug}`, `/${slug}/perfil`]
  if (corpo.userId && /^[0-9a-f-]{36}$/.test(corpo.userId)) {
    caminhos.push(`/${slug}/pessoa/${corpo.userId}`)
  }

  for (const c of caminhos) revalidatePath(c)
  return NextResponse.json({ esquecidos: caminhos })
}
