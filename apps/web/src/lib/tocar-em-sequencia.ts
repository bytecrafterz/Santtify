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

interface Faixa {
  id: string
  slug: string
  categoriaNome: string | null
}

let fila: Faixa[] | null = null
let aBuscar: Promise<Faixa[]> | null = null

/** O projeto sai do endereço: /<projeto>/... em qualquer página pública. */
function projetoDoEndereco(): string | null {
  const p = window.location.pathname.split('/').filter(Boolean)
  return p[0] ?? null
}

async function filaDoProjeto(): Promise<Faixa[]> {
  if (fila) return fila
  if (aBuscar) return aBuscar
  const projeto = projetoDoEndereco()
  if (!projeto) return []
  const base = process.env.NEXT_PUBLIC_API_URL ?? ''
  aBuscar = fetch(`${base}/projects/${projeto}/playlist`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      fila = (d?.faixas ?? []).map((f: Faixa) => ({
        id: f.id,
        slug: f.slug,
        categoriaNome: f.categoriaNome ?? null,
      }))
      return fila!
    })
    .catch(() => [])
  return aBuscar
}

/** O `<audio>` de uma faixa, se ela estiver desenhada nesta página. */
function audioDaFaixa(blockId: string): HTMLAudioElement | null {
  return document.querySelector<HTMLAudioElement>(`#cartao-${blockId} audio`)
}

/** A que faixa pertence este `<audio>`. */
function faixaDoAudio(audio: HTMLAudioElement): string | null {
  const artigo = audio.closest('[id^="cartao-"]')
  return artigo?.id.replace('cartao-', '') ?? null
}

/**
 * Toca a faixa a seguir a esta, dentro da categoria escolhida.
 *
 * Se a seguinte estiver nesta página, toca-a aqui. Se estiver noutra letra,
 * pede à página que a abra — a página inicial abre letras sem sair dela, e é
 * assim que a sequência atravessa de A para B sem partir a regra dele de 20/08
 * de que ninguém sai do perfil.
 */
export async function tocarASeguinte(atual: HTMLAudioElement): Promise<boolean> {
  const daqui = faixaDoAudio(atual)
  if (!daqui) return false

  const todas = await filaDoProjeto()
  if (!todas.length) return false

  /* A ESCOLHA dele, e não o que está a tocar: são valores diferentes desde
     02/09, e a nota em `categoria-a-tocar.ts` diz porquê. */
  const escolhida = lerCategoriaEscolhida()
  const semFiltro = !escolhida || escolhida === 'TODOS'

  /* Sem categoria fica sempre de fora, com filtro ou sem ele. */
  const candidatas = todas.filter(
    (f) => f.categoriaNome && (semFiltro || f.categoriaNome.toUpperCase() === escolhida),
  )

  /* A posição de onde estamos mede-se na fila INTEIRA, e não na filtrada: a
     faixa que está a tocar pode não pertencer à categoria escolhida — é
     exactamente o caso que ele descreveu, "estou a ouvir Explicação e escolho
     Oração". Daí procura-se a primeira da categoria que venha depois desta. */
  const ondeEstou = todas.findIndex((f) => f.id === daqui)
  if (ondeEstou < 0) return false
  const depoisDaqui = new Set(todas.slice(ondeEstou + 1).map((f) => f.id))
  const proxima =
    candidatas.find((f) => depoisDaqui.has(f.id)) ??
    /* Chegou ao fim: não recomeça sozinha. Voltar ao A depois do Z deixaria
       música a tocar sem ninguém ter pedido, que é a regra que já vale na
       playlist. */
    null
  if (!proxima) return false

  const aqui = audioDaFaixa(proxima.id)
  if (aqui) {
    const caixa = aqui.closest('.publicacao') ?? aqui
    caixa.scrollIntoView({ behavior: 'smooth', block: 'center' })
    void aqui.play().catch(() => {})
    return true
  }

  /* Noutra letra: quem sabe abri-la é a página. Se ninguém estiver a ouvir
     este pedido, a sequência pára aqui, que é melhor do que saltar a pessoa
     para outro endereço sem ela pedir. */
  window.dispatchEvent(
    new CustomEvent('pv:tocar-faixa', { detail: { slug: proxima.slug, blockId: proxima.id } }),
  )
  return true
}
