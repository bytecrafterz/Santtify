/**
 * Quando uma faixa acaba, começa a seguinte DA MESMA CATEGORIA.
 *
 * Pedido dele em 02/09, depois de a reprodução contínua já funcionar: "se
 * estiver tocando Explicação e eu selecionar Oração, a próxima faixa tem que
 * ser uma Oração; se eu escolher Explicação, deve tocar Explicação da letra A,
 * depois da B, depois da C". E a segunda metade, que é de segurança: "existem
 * áudios administrativos que estão Sem categoria; esses não podem entrar na
 * reprodução automática, nem mesmo em TODOS".
 *
 * O QUE ESTAVA AQUI seguia a ordem dos áudios NA PÁGINA. Dentro de uma letra
 * dava a ilusão de funcionar, porque ali a ordem da página é a ordem dele. Mas
 * nunca atravessava para a letra seguinte e não sabia o que era uma categoria,
 * então um aviso administrativo entrava na fila como qualquer outra coisa.
 *
 * A FILA VEM DO SERVIDOR, da mesma lista que alimenta a playlist: todas as
 * faixas publicadas do projeto, por ordem de letra e depois por ordem dentro da
 * letra. É a ordem A → B → C que ele descreveu, e não a inventei aqui.
 *
 * SEM CATEGORIA NUNCA TOCA SOZINHA. Nem no filtro TODOS. Um aviso que começa a
 * tocar por si, no meio de uma sequência de músicas, é o género de coisa que
 * numa plataforma para crianças não se pode deixar acontecer por distração.
 * Continua a tocar quando alguém carrega nela, que é o pedido dele.
 */
import { lerCategoriaEscolhida } from './categoria-a-tocar'

/**
 * Uma faixa da fila, com tudo o que é preciso para a TOCAR sem a página.
 *
 * 08/10: a seguinte deixou de ser procurada como um `<audio>` desenhado na
 * página. Com o telefone bloqueado, o iPhone não deixa começar um elemento
 * diferente do que estava a tocar, nem esperar que a página abra outra letra.
 * Por isso a fila traz o endereço do áudio, e quem toca troca a fonte no
 * mesmo elemento — ver `tocador-da-pagina.ts`.
 */
export interface FaixaDaFila {
  id: string
  slug: string
  contentId: string
  /** A letra do conteúdo. `null` nos projetos por dias, na introdução e no Produto Vivo. */
  letra: string | null
  /** O número do dia, nos projetos por dias. */
  ordinal: number | null
  categoriaNome: string | null
  title: string
  rotulo: string | null
  coverUrl: string | null
  url: string
  durationMs: number | null
}

let fila: FaixaDaFila[] | null = null
let aBuscar: Promise<FaixaDaFila[]> | null = null
/**
 * De que projeto é a fila (10/10). Era uma por página aberta, e com a música a
 * seguir pela plataforma inteira deixou de chegar: tocar no Jesus Alfabeto
 * depois de ouvir o Quem é Jesus tem de trazer a fila do Alfabeto.
 */
let filaDe: string | null = null

/** O projeto sai do endereço: /<projeto>/... em qualquer página pública. */
function projetoDoEndereco(): string | null {
  const p = window.location.pathname.split('/').filter(Boolean)
  return p[0] ?? null
}

/** A fila do projeto, guardada: busca-se ao primeiro play, para o fim da faixa não esperar pela rede. */
export async function prepararFila(): Promise<FaixaDaFila[]> {
  const projeto = projetoDoEndereco()
  if (!projeto) return fila ?? []
  if (projeto !== filaDe) {
    fila = null
    aBuscar = null
    filaDe = projeto
  }
  if (fila) return fila
  if (aBuscar) return aBuscar
  const base = process.env.NEXT_PUBLIC_API_URL ?? ''
  aBuscar = fetch(`${base}/projects/${projeto}/playlist`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      /*
        POR ORDEM DE LETRA, e não pela ordem em que os conteúdos foram criados.

        A lista chega ordenada por `position`. Durante muito tempo isso foi a
        mesma coisa que o alfabeto, e deixou de ser quando a Letra B foi criada
        depois das outras: ficou no fim da lista, e a sequência ia de A para C
        sem passar por ela. Ele apanhou-o em 02/09.

        E só letras: a introdução e o Produto Vivo não fazem parte do percurso
        que ele descreveu, que é "percorrendo todas as letras disponíveis".
      */
      /*
        E OS DIAS (08/10): nos projetos por dias as casas não têm letra, têm
        número, e a fila ficava vazia — a sequência nunca passava do Dia 1 ao
        Dia 2. Uma casa é uma letra OU um número; a introdução e o Produto Vivo
        não são nenhum dos dois e continuam de fora.
      */
      const chave = (f: FaixaDaFila) => f.letra ?? String(f.ordinal ?? 0).padStart(4, '0')
      fila = ((d?.faixas ?? []) as Array<FaixaDaFila & { categoriaNome?: string | null }>)
        .filter((f) => f.letra || f.ordinal != null)
        .map((f) => ({
          id: f.id,
          slug: f.slug,
          contentId: f.contentId,
          letra: f.letra ?? null,
          ordinal: f.ordinal ?? null,
          categoriaNome: f.categoriaNome ?? null,
          title: f.title,
          rotulo: f.rotulo ?? null,
          coverUrl: f.coverUrl ?? null,
          url: f.url,
          durationMs: f.durationMs ?? null,
        }))
        // Estável: dentro da mesma casa fica a ordem do painel.
        .sort((a, b) => (chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0))
      return fila!
    })
    .catch(() => [])
  return aBuscar
}

/**
 * A faixa a seguir a esta, dentro da categoria escolhida — SEM ESPERAR.
 *
 * Usa a fila já guardada (ver `prepararFila`): é chamada dentro do fim da faixa,
 * e com o telefone bloqueado não há tempo para ir à rede. Sem fila ainda,
 * devolve nula e a sequência pára, como antes de a fila chegar.
 */
/** O projeto da fila carregada, e uma faixa dela (o tocador global leva lá). */
export const projetoDaFila = () => filaDe
export const faixaNaFila = (id: string) => fila?.find((f) => f.id === id) ?? null

export function proximaDaFila(daqui: string): FaixaDaFila | null {
  const todas = fila
  if (!todas?.length) return null

  /*
    A ESCOLHA dele quando existe; senão, a CATEGORIA DO QUE ESTÁ A TOCAR.

    A escolha do menu e o que está a tocar são valores diferentes desde 02/09, e
    a nota em `categoria-a-tocar.ts` diz porquê. O que faltava era o caso de não
    haver escolha nenhuma: quem abre uma letra e carrega no play de uma
    Explicação nunca passou pelo menu, e eu lia isso como "sem filtro" e tocava
    a faixa seguinte fosse ela qual fosse. Ele apanhou-o em 05/09: "toquei a
    Explicação da Letra A; quando ela terminasse deveria seguir para a
    Explicação da Letra B, mas ele foi para a Memorização da Letra A".

    Carregar no play de uma Explicação É escolher Explicação. A escolha
    explícita do menu continua a mandar quando existe — incluindo TODOS, que é
    a maneira dele de pedir tudo de propósito.
  */
  const escolhida = lerCategoriaEscolhida()
  const categoriaDaqui = todas.find((f) => f.id === daqui)?.categoriaNome?.toUpperCase() ?? null
  const alvo = escolhida ? (escolhida === 'TODOS' ? null : escolhida) : categoriaDaqui
  const semFiltro = !alvo

  /* Sem categoria fica sempre de fora, com filtro ou sem ele. */
  const candidatas = todas.filter(
    (f) => f.categoriaNome && (semFiltro || f.categoriaNome.toUpperCase() === alvo),
  )

  /* A posição de onde estamos mede-se na fila INTEIRA, e não na filtrada: a
     faixa que está a tocar pode não pertencer à categoria escolhida — é
     exactamente o caso que ele descreveu, "estou a ouvir Explicação e escolho
     Oração". Daí procura-se a primeira da categoria que venha depois desta. */
  /*
    QUEM ESTÁ A TOCAR PODE NÃO SER UMA LETRA.

    A página inicial desenha as publicações da INTRODUÇÃO por cima das da letra
    aberta, e o Produto Vivo tem a sua. Nenhuma delas está na fila das letras,
    e eu fazia a sequência morrer aí em silêncio: acabava a introdução e não
    acontecia nada.

    Não estar na fila não é motivo para parar. É motivo para começar do
    princípio da categoria escolhida, que é o que a pessoa está à espera quando
    carrega no play a seguir a escolher uma categoria.
  */
  const ondeEstou = todas.findIndex((f) => f.id === daqui)
  const depoisDaqui =
    ondeEstou < 0
      ? new Set(todas.map((f) => f.id))
      : new Set(todas.slice(ondeEstou + 1).map((f) => f.id))

  /*
    AO CHEGAR AO FIM, VOLTA AO PRINCÍPIO na mesma categoria.

    Pedido dele em 02/09: "ao chegar ao fim das letras disponíveis, ela deve
    voltar para o início e continuar na mesma categoria". Antes parava, e era
    isso que ele via como "no final da Letra B não continuou".
  */
  const proxima = candidatas.find((f) => depoisDaqui.has(f.id)) ?? candidatas[0] ?? null
  if (!proxima) return null

  /*
    SALVO SE FOR ELA PRÓPRIA. Há categorias com uma faixa só — hoje só existe
    uma Oração em todo o projeto. Dar a volta traria a mesma faixa outra vez, e
    repetir uma música de cinco minutos para sempre não é o que ele pediu; é o
    que sai de aplicar a regra à letra num caso que ele não tinha em mente.
  */
  if (proxima.id === daqui) return null
  return proxima
}
