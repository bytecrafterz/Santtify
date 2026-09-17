'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  composicaoDaFrase,
  niveisDaFrase,
  posicaoNoTempo,
  type Destaque,
  type Frase,
  type NivelDeDestaque,
} from '@pv/karaoke'
import { fonteDoKaraoke } from '@/app/fontes/karaoke'

/**
 * O palco do Modo Karaokê: a frase que se canta, desenhada no estilo das artes.
 *
 * O cliente mandou seis artes da Santtify como referência em 14/09 e pediu que
 * a letra não fosse "toda com a mesma fonte, mesmo tamanho e mesma aparência".
 * Nas artes, a palavra que importa (CRISTO, AMAR, JESUS) é enorme e colorida,
 * com contorno e relevo; as outras são mais pequenas, às vezes dentro de uma
 * faixa roxa ou de uma pílula verde. É isso que isto faz, com texto vivo e não
 * com imagens: o combinado foi "o mesmo estilo, não uma cópia das ilustrações".
 *
 * É o MESMO componente no ecrã público e na pré-visualização do painel. O que
 * ele aprova ao sincronizar é, por construção, o que a criança vê.
 *
 * Não sabe nada de áudio: recebe o tempo e desenha. Quem toca é quem o usa.
 */

interface Linha {
  nivel: NivelDeDestaque
  palavras: Array<{ indice: number; texto: string; nivel: NivelDeDestaque }>
}

/** Caracteres por linha para as palavras pequenas, antes de partir. */
const LARGURA_DA_LINHA = 16
/** Até este comprimento, um grupo de palavras pequenas encosta-se à grande. */
const CURTA_PARA_ENCOSTAR = 4

/**
 * Arruma uma frase em linhas, como numa arte.
 *
 * Uma palavra de nível 2 ou 3 fica numa linha só dela — é o que a torna
 * grande sem espremer as outras. Duas seguidas do mesmo nível ficam juntas
 * ("ESPÍRITO SANTO"). As restantes enchem linhas curtas, porque uma linha
 * comprida obrigaria a letra inteira a encolher.
 */
function linhasDaFrase(frase: Frase, niveis: NivelDeDestaque[]): Linha[] {
  type Palavra = Linha['palavras'][number]
  // Primeiro, blocos: corridas de palavras pequenas e grupos de grandes.
  const blocos: Array<{ grande: boolean; palavras: Palavra[] }> = []
  frase.palavras.forEach((p, i) => {
    const palavra = { indice: i, texto: p.texto, nivel: niveis[i] }
    const grande = palavra.nivel >= 2
    const ultimo = blocos[blocos.length - 1]
    const junta =
      ultimo &&
      ultimo.grande === grande &&
      (!grande || (ultimo.palavras.length < 2 && ultimo.palavras[0].nivel === palavra.nivel))
    if (junta) ultimo.palavras.push(palavra)
    else blocos.push({ grande, palavras: [palavra] })
  })

  /*
    UMA PALAVRA PEQUENA SOZINHA NUMA LINHA FICA PERDIDA.

    "A / LUZ / DO / ESPÍRITO SANTO" eram quatro linhas, duas delas com uma
    letra só, espalhadas pelo ecrã. Nas artes, estas palavras curtas encostam
    à grande, mais pequenas: "A AMAR". Encosta-se à grande seguinte, ou à
    anterior se já não houver seguinte.
  */
  const comprimento = (ps: Palavra[]) => ps.reduce((s, x) => s + x.texto.length, 0) + ps.length - 1
  const linhas: Linha[] = []
  let prefixo: Palavra[] = []
  blocos.forEach((bloco, b) => {
    if (bloco.grande) {
      const nivel = bloco.palavras[0].nivel
      linhas.push({ nivel, palavras: [...prefixo, ...bloco.palavras] })
      prefixo = []
      return
    }
    const curta = comprimento(bloco.palavras) <= CURTA_PARA_ENCOSTAR
    const haGrandeDepois = b + 1 < blocos.length
    const anterior = linhas[linhas.length - 1]
    if (curta && haGrandeDepois) {
      prefixo = bloco.palavras
      return
    }
    if (curta && anterior && anterior.nivel >= 2) {
      anterior.palavras.push(...bloco.palavras)
      return
    }
    let atual: Linha | null = null
    for (const palavra of bloco.palavras) {
      if (!atual || comprimento([...atual.palavras, palavra]) > LARGURA_DA_LINHA) {
        atual = { nivel: 0, palavras: [] }
        linhas.push(atual)
      }
      atual.palavras.push(palavra)
      if (palavra.nivel > atual.nivel) atual.nivel = palavra.nivel
    }
  })
  return linhas
}

/** Quanto tempo depois de a frase acabar se passa a mostrar a seguinte. */
const MS_ATE_MOSTRAR_A_SEGUINTE = 1200
/** A contagem antes de uma frase que vem depois de silêncio. */
const MS_DA_CONTAGEM = 3000

export function PalcoDoKaraoke({
  frases,
  destaques,
  tempoMs,
  titulo,
  compacto = false,
}: {
  frases: Frase[]
  destaques: Destaque[]
  tempoMs: number
  titulo: string
  compacto?: boolean
}) {
  const posicao = posicaoNoTempo(frases, tempoMs)

  /*
    QUE FRASE MOSTRAR.

    A que se está a cantar. Mas depois de ela acabar, num intervalo
    instrumental, a frase cantada ficava ali parada; passado um momento mostra-se
    a seguinte, apagada e com a contagem, para a criança se preparar para
    entrar a tempo — como num karaokê a sério.
  */
  let indice = posicao.frase
  let aEspera = false
  const atual = indice >= 0 ? frases[indice] : null
  const seguinte = frases[indice + 1]
  if (
    seguinte &&
    typeof seguinte.inicioMs === 'number' &&
    (indice < 0 || (atual?.fimMs != null && tempoMs > atual.fimMs + MS_ATE_MOSTRAR_A_SEGUINTE))
  ) {
    if (indice >= 0 || seguinte.inicioMs - tempoMs <= MS_DA_CONTAGEM) {
      indice += 1
      aEspera = true
    }
  }

  const contagem =
    aEspera && posicao.msAteProxima !== null && posicao.msAteProxima <= MS_DA_CONTAGEM
      ? Math.ceil(posicao.msAteProxima / 1000)
      : null

  const frase = indice >= 0 ? frases[indice] : null
  const niveis = useMemo(
    () => (frase ? niveisDaFrase(frase.palavras, destaques) : []),
    [frase, destaques],
  )
  const linhas = useMemo(() => (frase ? linhasDaFrase(frase, niveis) : []), [frase, niveis])
  const composicao = composicaoDaFrase(Math.max(0, indice))

  /*
    NENHUMA LINHA SAI DO ECRÃ.

    Os tamanhos são proporcionais à largura do palco e chegam para quase tudo,
    mas "GRATIDÃO" em nível máximo num telemóvel pequeno não chega. Mede-se cada
    linha depois de desenhada e encolhe-se só a que não cabe.

    Mede-se com as palavras PARADAS (`a-medir` desliga o crescer e o pulo). No
    Chrome o `scrollWidth` conta as transformações, e medir enquanto a palavra
    cantada está maior encolhia a frase inteira à conta de um pulo que dura meio
    segundo. É tudo no mesmo fotograma, antes de pintar: não se vê.
  */
  const palco = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = palco.current
    if (!el) return
    const ajustar = () => {
      el.classList.add('a-medir')
      el.querySelectorAll<HTMLElement>('.k-linha').forEach((linha) => {
        linha.style.setProperty('--k-encolher', '1')
        const disponivel = linha.clientWidth
        const precisa = linha.scrollWidth
        if (precisa > disponivel && disponivel > 0) {
          linha.style.setProperty('--k-encolher', String(Math.max(0.35, (disponivel / precisa) * 0.97)))
        }
      })
      el.classList.remove('a-medir')
    }
    ajustar()
    const observador = new ResizeObserver(ajustar)
    observador.observe(el)
    // A fonte pode chegar depois do primeiro desenho, com outra largura.
    void document.fonts?.ready.then(ajustar)
    return () => observador.disconnect()
  }, [linhas])

  const classes = [
    'k-palco',
    fonteDoKaraoke.variable,
    compacto ? 'compacto' : '',
    `k-${composicao.tipo}`,
    `k-paleta-${composicao.paleta}`,
  ].join(' ')

  if (!frase) {
    return (
      <div ref={palco} className={`k-palco ${fonteDoKaraoke.variable} ${compacto ? 'compacto' : ''} k-cartaz k-paleta-amarelo-roxo`}>
        <div className="k-frase k-abertura">
          <p className="k-linha k-nivel-3">
            <span className="k-palavra cantada">{titulo}</span>
          </p>
          <p className="k-aviso">♪ prepare-se para cantar ♪</p>
        </div>
      </div>
    )
  }

  let primeiraPequena = true
  return (
    <div ref={palco} className={classes}>
      {/* A chave muda a cada frase: a entrada anima uma vez por frase, e não a
          cada palavra. */}
      <div key={indice} className={`k-frase${aEspera ? ' a-espera' : ''}`}>
        {linhas.map((linha, l) => {
          const pequena = linha.nivel < 2
          const envolvida = pequena && primeiraPequena && linhas.length > 1
          if (pequena) primeiraPequena = false
          return (
            <p
              key={l}
              className={`k-linha k-nivel-${linha.nivel}${envolvida ? ' k-envolvida' : ''}${l % 2 ? ' k-impar' : ''}`}
            >
              {linha.palavras.map((p, j) => {
                let estado = 'por-cantar'
                if (!aEspera && indice === posicao.frase) {
                  if (p.indice === posicao.palavra) estado = 'a-cantar'
                  else if (p.indice < posicao.cantadas || p.indice < posicao.palavra) estado = 'cantada'
                }
                // O espaço é texto, e não margem: copiar a letra do ecrã e
                // o leitor de ecrã têm de ler palavras, e não uma palavra só.
                return (
                  <span key={p.indice}>
                    {j > 0 && ' '}
                    <span className={`k-palavra k-p${p.nivel} ${estado}`}>{p.texto}</span>
                  </span>
                )
              })}
            </p>
          )
        })}
        {contagem !== null && (
          <p className="k-contagem" aria-hidden>
            {[3, 2, 1].map((n) => (
              <span key={n} className={n <= contagem ? 'acesa' : ''} />
            ))}
          </p>
        )}
      </div>
    </div>
  )
}
