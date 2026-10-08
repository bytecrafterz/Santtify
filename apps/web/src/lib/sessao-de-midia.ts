/**
 * O que aparece no ecrã bloqueado e nos auscultadores (08/10).
 *
 * O cliente: "com a tela apagada, o áudio continua tocando, o que está certo;
 * mas, quando termina uma faixa, não passa automaticamente para a seguinte".
 * A passagem em si resolve-se em quem toca (a faixa seguinte entra no mesmo
 * `<audio>`, dentro do próprio `ended`). Isto é a outra metade: dizer ao
 * telemóvel o que está a tocar e o que fazem os botões de "seguinte" e
 * "anterior" do ecrã bloqueado — sem isto, nesses botões não acontece nada.
 */

export interface DescricaoDaFaixa {
  titulo: string
  rotulo?: string | null
  capa?: string | null
}

export function descreverNaSessao(f: DescricaoDaFaixa) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') {
    return
  }
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: f.rotulo ? `${f.rotulo} · ${f.titulo}` : f.titulo,
      artist: 'Santtify',
      artwork: f.capa ? [{ src: f.capa, sizes: '512x512' }] : [],
    })
  } catch {
    // Um navegador sem suporte completo não pode estragar o som.
  }
}

/** Liga os botões do ecrã bloqueado. Nulo desliga o botão. */
export function botoesDaSessao(acoes: {
  tocar?: () => void
  pausar?: () => void
  seguinte?: (() => void) | null
  anterior?: (() => void) | null
}) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  const definir = (acao: MediaSessionAction, f: (() => void) | null | undefined) => {
    try {
      navigator.mediaSession.setActionHandler(acao, f ?? null)
    } catch {
      // Ações que este navegador não conhece.
    }
  }
  definir('play', acoes.tocar)
  definir('pause', acoes.pausar)
  definir('nexttrack', acoes.seguinte)
  definir('previoustrack', acoes.anterior)
}
