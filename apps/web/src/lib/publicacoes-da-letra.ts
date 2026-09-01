import type { PaginaConteudo } from '@/lib/api'

/**
 * AS PUBLICAÇÕES DE UMA LETRA, NUM SÍTIO SÓ.
 *
 * Isto vivia dentro de `ExperienciaContinua`, que é o alfabeto da página
 * inicial. A página própria de cada letra — a que TODOS os QR Codes impressos
 * abrem — desenhava outra coisa: uma capa e por baixo os sete tocadores
 * empilhados, sem a arte de cada um.
 *
 * Ele apanhou-o em 01/09 com um Android acabado de estrear: "escaneamos o QR
 * Code e os áudios abriram sem as fotos correspondentes". Não era lentidão nem
 * cache. Naquela página as fotos não existiam de todo, e por isso nunca
 * chegariam por mais que ele esperasse.
 *
 * Uma letra tem de se ver igual venha-se por onde se vier, e um QR Code
 * impresso não se corrige depois. Passa a haver uma função e as duas páginas
 * chamam-na.
 */
/**
 * Parte uma letra nas suas publicações.
 *
 * A PRIMEIRA é o conteúdo em si: a capa da letra, o primeiro áudio, o título e
 * o texto educativo. As seguintes são um áudio cada, com a arte própria da
 * faixa. Se a faixa ainda não tiver arte, usa a capa da letra — é melhor ver a
 * letra outra vez do que ver um buraco branco onde devia estar uma imagem.
 *
 * O texto dos blocos de texto que existam vai todo para a primeira publicação,
 * porque é lá que ele o escreveu enquanto a letra era um cartão só. Cada faixa
 * tem o seu próprio texto assim que ele o preencher no painel.
 */
export function publicacoesDe(pagina: PaginaConteudo) {
  const c = pagina.content

  // Só cartões, e cada cartão é uma peça inteira: o servidor já não devolve
  // nenhum incompleto. Aqui não há nada a montar nem a juntar — foi essa
  // montagem, feita de pedaços que por acaso estavam próximos, que durante
  // quatro dias deixou a fotografia aparecer sozinha noutro sítio da página.
  return (
    c.blocks
      // Basta ter áudio OU imagem. Um cartão a que falte a foto continua a ser
      // um cartão, com o lugar da foto lá dentro — que é o oposto de uma
      // fotografia solta noutro sítio da página.
      .filter((b) => b.type === 'AUDIO' && b.papel === 'CARTAO' && (b.asset?.url || b.arte))
      .map((b) => ({
        ancora: `cartao-${b.id}`,
        // SEM ETIQUETA. Os nomes das casas — explicação, música, oração — servem
        // para ele se orientar no painel, e ele foi explícito: não aparecem na
        // página, nem como faixa branca no topo.
        etiqueta: null as string | null,
        imagem: b.arte,
        bloco: b,
        titulo: b.titulo ?? '',
        texto: b.text?.trim() ?? null,
        linkUpgrade: b.linkUpgrade,
        alvo: { tipo: 'faixa' as const, blockId: b.id },
      }))
  )
}
