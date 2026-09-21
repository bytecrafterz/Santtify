/**
 * O Modo Karaokê: as regras partilhadas pelo painel, pelo leitor e pela API.
 *
 * Um só sítio pelo mesmo motivo que a geometria dos cartões tem um só sítio.
 * O painel decide quando cada palavra é cantada e com que destaque; o leitor
 * desenha exactamente isso; a API recusa o que não faz sentido. Se as três
 * escrevessem a sua versão de "que palavra é JESUS" ou "a que horas acaba esta
 * frase", o que ele sincronizou no painel não seria o que a criança vê.
 *
 * JavaScript simples, sem dependências, para o navegador e o servidor o
 * importarem tal e qual.
 */

/** Tira acentos e a pontuação das pontas, e passa a maiúsculas: "Fé," → "FE". */
function normalizarPalavra(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .toUpperCase()
}

/** Uma linha em palavras. A pontuação fica agarrada à palavra, para o ecrã. */
function separarPalavras(linha) {
  return String(linha || '')
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * O texto colado no painel, em frases sem tempos.
 *
 * Uma linha é uma frase, que é o que aparece junto no ecrã. Linhas vazias
 * servem para ele arrumar estrofes enquanto escreve e não contam.
 *
 * Se já houver frases sincronizadas, as que ficaram IGUAIS e no mesmo lugar
 * guardam os tempos e as marcas. Corrigir uma gralha na linha 30 não pode
 * obrigar a sincronizar a música outra vez.
 */
function frasesDoTexto(texto, anteriores) {
  const antigas = Array.isArray(anteriores) ? anteriores : []
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linha, i) => {
      const antiga = antigas[i]
      if (antiga && antiga.texto === linha) return antiga
      return {
        texto: linha,
        inicioMs: null,
        fimMs: null,
        palavras: separarPalavras(linha).map((p) => ({ texto: p, inicioMs: null, fimMs: null })),
      }
    })
}

/**
 * Quanto demora cantar uma palavra, em proporção às outras.
 *
 * As vogais aproximam as sílabas, que é o que marca o tempo numa música; o
 * comprimento acerta o resto. Não é exacto e não precisa de ser: serve para
 * espalhar o tempo DENTRO de uma frase cujo começo ele marcou à mão.
 */
function pesoDaPalavra(texto) {
  const limpo = normalizarPalavra(texto)
  const vogais = (limpo.match(/[AEIOUY]/g) || []).length
  return Math.max(1, vogais) + limpo.length * 0.15
}

/** Milissegundos por unidade de peso: o ritmo de uma música infantil cantada. */
const MS_POR_PESO = 380

/**
 * Onde acaba o canto de uma frase.
 *
 * NÃO é simplesmente o começo da seguinte. Entre duas estrofes costuma haver
 * instrumental, e esticar a última frase por esses dez segundos faria o
 * destaque arrastar-se pela última palavra sem ninguém a cantar. Por isso o
 * canto acaba no que a frase demoraria a cantar, com folga — ou no começo da
 * seguinte, se esta vier antes.
 */
function fimDaFrase(frase, inicioMs, proximoInicioMs, duracaoMs) {
  const estimado = frase.palavras.reduce((s, p) => s + pesoDaPalavra(p.texto), 0) * MS_POR_PESO
  const desejado = inicioMs + estimado * 1.6
  let tecto = desejado
  if (typeof proximoInicioMs === 'number') tecto = proximoInicioMs - 80
  else if (typeof duracaoMs === 'number') tecto = duracaoMs
  return Math.max(inicioMs + 1, Math.round(Math.min(tecto, desejado)))
}

/** Espalha o tempo de uma frase pelas palavras dela, em proporção ao peso. */
function distribuirTempos(palavras, inicioMs, fimMs) {
  const pesos = palavras.map((p) => pesoDaPalavra(p.texto))
  const total = pesos.reduce((a, b) => a + b, 0) || 1
  const duracao = Math.max(0, fimMs - inicioMs)
  let cursor = inicioMs
  return palavras.map((p, i) => {
    const d = (duracao * pesos[i]) / total
    const palavra = { ...p, inicioMs: Math.round(cursor), fimMs: Math.round(cursor + d) }
    cursor += d
    return palavra
  })
}

/**
 * Aplica as marcas do painel e calcula o tempo de todas as palavras.
 *
 * `marcas[i]` é o que ele marcou na frase i, de uma de duas maneiras:
 *   - um número: o começo da frase (a sincronização rápida, um toque por frase);
 *   - uma lista com um lugar por palavra: o começo das palavras que marcou,
 *     `null` nas outras (a sincronização palavra a palavra, para as partes onde
 *     o canto não é regular — uma palavra esticada, uma pausa a meio).
 *
 * As palavras marcadas são âncoras e guardam `marcada: true`, para o painel
 * saber na próxima visita o que foi ele e o que foi calculado. Entre duas
 * âncoras o tempo espalha-se pelo peso das palavras; depois da última, a frase
 * acaba no que demoraria a cantar (ver `fimDaFrase`). Uma frase sem a primeira
 * palavra marcada fica por sincronizar: sem saber onde começa, tudo o resto
 * seria adivinhar.
 *
 * As marcas manuais de destaque não se perdem: só os tempos mudam.
 */
function aplicarMarcas(frases, marcas, duracaoMs) {
  const ancorasDe = (i) => {
    const frase = frases[i]
    const m = marcas[i]
    const lista = frase.palavras.map(() => null)
    if (typeof m === 'number') lista[0] = m
    else if (Array.isArray(m)) m.forEach((v, j) => { if (j < lista.length && typeof v === 'number') lista[j] = v })
    return lista
  }
  const inicios = frases.map((_, i) => ancorasDe(i)[0])

  return frases.map((frase, i) => {
    const ancoras = ancorasDe(i)
    const semTempo = (p) => {
      const limpa = { ...p, inicioMs: null, fimMs: null }
      delete limpa.marcada
      return limpa
    }
    if (typeof ancoras[0] !== 'number') {
      return { ...frase, inicioMs: null, fimMs: null, palavras: frase.palavras.map(semTempo) }
    }

    let proximo = null
    for (let j = i + 1; j < inicios.length; j++) {
      if (typeof inicios[j] === 'number') {
        proximo = inicios[j]
        break
      }
    }

    // Âncoras fora de ordem (um toque atrasado) não podem pôr o tempo a andar
    // para trás: a que vier antes da anterior deixa de contar.
    let ultima = -Infinity
    for (let j = 0; j < ancoras.length; j++) {
      if (typeof ancoras[j] !== 'number') continue
      if (ancoras[j] <= ultima || (typeof proximo === 'number' && ancoras[j] >= proximo)) ancoras[j] = null
      else ultima = ancoras[j]
    }

    const palavras = frase.palavras.map(semTempo)
    const indices = ancoras.map((v, j) => (typeof v === 'number' ? j : -1)).filter((j) => j >= 0)
    indices.forEach((a, k) => {
      const b = k + 1 < indices.length ? indices[k + 1] : palavras.length
      const inicio = ancoras[a]
      let fim
      if (b < palavras.length) {
        fim = ancoras[b]
      } else {
        const resto = { palavras: palavras.slice(a) }
        fim = fimDaFrase(resto, inicio, proximo, duracaoMs)
      }
      distribuirTempos(palavras.slice(a, b), inicio, fim).forEach((p, j) => {
        palavras[a + j] = p
      })
      palavras[a].marcada = true
    })

    return {
      ...frase,
      inicioMs: palavras[0].inicioMs,
      fimMs: palavras[palavras.length - 1].fimMs,
      palavras,
    }
  })
}

/**
 * O contrário de `aplicarMarcas`: as marcas que deram estas frases.
 *
 * O painel abre com isto. Guardar só os tempos calculados e não as marcas
 * obrigaria a escolher entre perder o que ele fez à mão e tratar tudo como
 * âncora — e aí mexer numa frase já não redistribuía as palavras dela.
 */
function marcasDasFrases(frases) {
  return frases.map((f) => {
    if (typeof f.inicioMs !== 'number') return null
    const ancoras = f.palavras.map((p, j) => (j === 0 || p.marcada ? p.inicioMs : null))
    return ancoras.slice(1).some((v) => typeof v === 'number') ? ancoras : f.inicioMs
  })
}

/**
 * A letra ouvida pelo sistema, arrumada em frases de karaokê.
 *
 * O transcritor devolve TIRADAS — pedaços que ele ouviu de uma vez — e cada
 * tirada já costuma ser um verso da canção: "Quando eu tenho medo Ele vem me
 * abraçar". É por essa costura que se corta, e não pelas pausas entre palavras:
 * medi-las numa música dele deu zero em 95% dos casos, porque dentro de uma
 * tirada as palavras vêm coladas umas às outras.
 *
 * Uma tirada comprida de mais para o ecrã parte-se: primeiro numa vírgula ou
 * ponto, e se não houver, na maior respiração lá dentro. Uma tirada de duas
 * palavras junta-se à seguinte, senão o ecrã pisca uma palavra e muda.
 *
 * Cada palavra fica `marcada`: o tempo dela veio do áudio, e não de uma conta
 * repartida. Se ele corrigir uma palavra no painel, o resto fica onde estava.
 */
const PALAVRAS_POR_FRASE = 9
const CARACTERES_POR_FRASE = 46
/** Abaixo disto, a frase é curta de mais para viver sozinha no ecrã. */
const PALAVRAS_A_MENOS = 2

function frasesDeTranscricao(tiradas, duracaoMs) {
  const limpar = (p) => ({
    texto: String(p?.texto || '').trim(),
    inicioMs: Math.round(Number(p?.inicioMs)),
    fimMs: Math.round(Number(p?.fimMs)),
  })
  const valida = (p) => p.texto && Number.isFinite(p.inicioMs) && Number.isFinite(p.fimMs)

  /** Onde partir uma tirada comprida: na pontuação, ou na maior respiração. */
  const partir = (palavras) => {
    const comprimento = palavras.reduce((s, p) => s + p.texto.length + 1, 0)
    if (palavras.length <= PALAVRAS_POR_FRASE && comprimento <= CARACTERES_POR_FRASE) {
      return [palavras]
    }
    /*
      O CORTE FICA PERTO DO MEIO, e não onde calhar.

      Cortar no primeiro sinal de pontuação deixava "Quando eu tenho medo Ele
      vem me abraçar Quando eu" de um lado e três palavras do outro — e a parte
      comprida continuava a não caber. Entre os sítios possíveis escolhe-se o
      mais próximo do meio: as duas metades ficam parecidas e a recursão acaba
      sempre.
    */
    const meio = (palavras.length - 1) / 2
    const dentro = (i) => i >= Math.floor(palavras.length / 4) && i <= Math.ceil((palavras.length * 3) / 4)
    const candidatos = []
    for (let i = 0; i < palavras.length - 1; i++) {
      if (dentro(i) && /[.!?;:,]$/.test(palavras[i].texto)) candidatos.push(i)
    }
    if (!candidatos.length) {
      let maior = -1
      for (let i = 0; i < palavras.length - 1; i++) {
        const respiracao = palavras[i + 1].inicioMs - palavras[i].fimMs
        if (dentro(i) && respiracao > maior) {
          maior = respiracao
          candidatos.length = 0
          candidatos.push(i)
        }
      }
    }
    const corte = candidatos.length
      ? candidatos.reduce((a, b) => (Math.abs(a - meio) <= Math.abs(b - meio) ? a : b))
      : Math.floor(meio)
    return [...partir(palavras.slice(0, corte + 1)), ...partir(palavras.slice(corte + 1))]
  }

  const grupos = []
  for (const tirada of tiradas || []) {
    const palavras = (tirada?.palavras || []).map(limpar).filter(valida)
    if (!palavras.length) continue
    grupos.push(...partir(palavras))
  }

  // Uma palavra sozinha não é uma frase: junta-se a quem está mais perto dela.
  for (let i = 0; i < grupos.length; i++) {
    if (grupos[i].length > PALAVRAS_A_MENOS || grupos.length === 1) continue
    const anterior = grupos[i - 1]
    const seguinte = grupos[i + 1]
    const paraTras = anterior ? grupos[i][0].inicioMs - anterior[anterior.length - 1].fimMs : Infinity
    const paraFrente = seguinte ? seguinte[0].inicioMs - grupos[i][grupos[i].length - 1].fimMs : Infinity
    if (anterior && paraTras <= paraFrente) {
      anterior.push(...grupos[i])
      grupos.splice(i, 1)
      i--
    } else if (seguinte) {
      seguinte.unshift(...grupos[i])
      grupos.splice(i, 1)
      i--
    }
  }

  const frases = grupos.map((palavras) => ({
    texto: palavras.map((p) => p.texto).join(' '),
    inicioMs: palavras[0].inicioMs,
    fimMs: palavras[palavras.length - 1].fimMs,
    palavras: palavras.map((p) => ({ ...p, marcada: true })),
  }))

  /*
    O FIM DA MÚSICA VEM SEMPRE ESMAGADO NUM MILISSEGUNDO.

    Quando o modelo chega ao fim do áudio, carimba as últimas palavras todas no
    mesmo instante. Foi o que aconteceu à Letra H: as sete palavras da frase 74
    — "canal e ative as notificações do canal", o remate falado da gravação —
    ficaram todas em 353020 ms, e a frase nasceu a começar e a acabar no mesmo
    sítio. Para o painel isso é um tempo impossível, e com razão: uma frase que
    dura zero não se canta. A letra ficou escrita e sem poder ir ao ar.

    Aqui dá-se-lhe a duração que ela demoraria a cantar (`fimDaFrase`, o mesmo
    cálculo da sincronização à mão), sem passar por cima da frase seguinte nem
    do fim do áudio, e espalham-se as palavras por dentro. Uma estimativa no
    fim de uma gravação é melhor do que uma letra inteira parada à porta.
  */
  frases.forEach((f, i) => {
    if (f.fimMs > f.inicioMs) return
    const proxima = frases[i + 1]
    f.fimMs = fimDaFrase(
      f,
      f.inicioMs,
      typeof proxima?.inicioMs === 'number' ? proxima.inicioMs : null,
      typeof duracaoMs === 'number' ? duracaoMs : null,
    )
    f.palavras = distribuirTempos(f.palavras, f.inicioMs, f.fimMs).map((p) => ({
      ...p,
      marcada: true,
    }))
  })

  /*
    E as palavras soltas que ficaram com duração zero dentro de uma frase boa:
    a palavra acendia e apagava no mesmo instante, ou seja, não acendia. Ganham
    o tempo que sobra até à palavra seguinte, sem nunca passar do fim da frase.
  */
  for (const f of frases) {
    for (let i = 0; i < f.palavras.length; i++) {
      const p = f.palavras[i]
      if (p.fimMs > p.inicioMs) continue
      const seguinte = f.palavras[i + 1]
      const tecto = typeof seguinte?.inicioMs === 'number' ? seguinte.inicioMs : f.fimMs
      p.fimMs = Math.max(p.inicioMs + 1, Math.min(tecto, f.fimMs))
    }
  }

  return frases
}

/** Palavras que nunca ganham destaque sozinhas: artigos, preposições, pronomes. */
const PALAVRAS_PEQUENAS = new Set(
  (
    'A O E AS OS UM UMA UNS UMAS DE DA DO DAS DOS EM NA NO NAS NOS AO AOS PARA PRA POR PELO PELA ' +
    'COM SEM QUE SE MAS OU NEM NAO SIM JA MAIS MUITO TAO EU TU ELE ELA NOS VOS ELES ELAS ME TE LHE ' +
    'MEU MINHA MEUS MINHAS TEU TUA SEU SUA ESTE ESTA ESSE ESSA ISSO ISTO AQUI ALI LA COMO QUANDO ' +
    'ONDE SOU ES SAO FOI SER TEM TER VAI VOU VAMOS ESTOU ESTA TODO TODA TODOS TODAS CADA'
  ).split(' '),
)

/**
 * O nível de cada palavra de uma frase: 0 normal, 1 destaque, 2 forte, 3 máximo.
 *
 * Por esta ordem de autoridade:
 *   1. a marca que ele fez à mão naquela palavra, naquela música;
 *   2. a lista de palavras do projeto — as expressões de duas palavras primeiro,
 *      para "ESPÍRITO SANTO" ganhar como expressão e não só "SANTO";
 *   3. se mesmo assim a frase ficar sem nenhum destaque, a palavra de conteúdo
 *      mais comprida ganha nível 1. Ele pediu que nunca ficasse tudo igual, e
 *      uma frase sem nenhuma palavra da lista é exactamente onde isso acontece.
 */
function niveisDaFrase(palavras, destaques) {
  const mapa = new Map((destaques || []).map((d) => [d.palavra, d.nivel]))
  const norm = palavras.map((p) => normalizarPalavra(p.texto))
  const niveis = norm.map(() => 0)

  for (let i = 0; i < norm.length - 1; i++) {
    const nivel = mapa.get(`${norm[i]} ${norm[i + 1]}`)
    if (nivel) {
      niveis[i] = nivel
      niveis[i + 1] = nivel
    }
  }
  norm.forEach((w, i) => {
    if (!niveis[i] && mapa.has(w)) niveis[i] = mapa.get(w)
  })

  const manual = palavras.map((p) => (typeof p.destaque === 'number' ? p.destaque : null))
  manual.forEach((m, i) => {
    if (m !== null) niveis[i] = m
  })

  if (niveis.every((n) => n === 0)) {
    let melhor = -1
    norm.forEach((w, i) => {
      if (manual[i] !== null || PALAVRAS_PEQUENAS.has(w) || w.length < 4) return
      if (melhor < 0 || w.length > norm[melhor].length) melhor = i
    })
    if (melhor >= 0) niveis[melhor] = 1
  }
  return niveis
}

/**
 * As composições que se alternam entre frases, e as paletas das artes.
 *
 * Um conjunto fixo e não uma composição inventada por frase: dá variedade sem
 * ficar aleatório, e a mesma música desenha-se sempre igual — o que ele aprova
 * no painel é o que a criança vê.
 */
const COMPOSICOES = ['cartaz', 'faixa', 'degrau', 'pilula', 'pilha', 'inclinado']
const PALETAS = ['vermelho-verde', 'amarelo-roxo', 'verde-vermelho', 'azul-amarelo', 'roxo-laranja']

function composicaoDaFrase(indice) {
  return {
    tipo: COMPOSICOES[(indice * 5 + 2) % COMPOSICOES.length],
    paleta: PALETAS[(indice * 3) % PALETAS.length],
  }
}

/**
 * Em que ponto da letra está a música, num dado instante.
 *
 * Procura binária: o leitor pergunta isto a cada fotograma, e uma música tem
 * dezenas de frases. Antes da primeira frase `frase` é -1 — a introdução
 * instrumental, onde o leitor mostra o título.
 */
function posicaoNoTempo(frases, tempoMs) {
  let baixo = 0
  let alto = frases.length - 1
  let frase = -1
  while (baixo <= alto) {
    const meio = (baixo + alto) >> 1
    const inicio = frases[meio].inicioMs
    if (typeof inicio === 'number' && inicio <= tempoMs) {
      frase = meio
      baixo = meio + 1
    } else {
      alto = meio - 1
    }
  }
  const proxima = frase + 1 < frases.length ? frases[frase + 1] : null
  const msAteProxima = proxima && typeof proxima.inicioMs === 'number' ? proxima.inicioMs - tempoMs : null
  if (frase < 0) return { frase: -1, palavra: -1, cantadas: 0, msAteProxima }

  const palavras = frases[frase].palavras
  let palavra = -1
  let cantadas = 0
  for (let i = 0; i < palavras.length; i++) {
    if (palavras[i].fimMs <= tempoMs) cantadas = i + 1
    if (palavras[i].inicioMs <= tempoMs && tempoMs < palavras[i].fimMs) palavra = i
  }
  return { frase, palavra, cantadas, msAteProxima }
}

function estaSincronizada(frases) {
  return (
    Array.isArray(frases) &&
    frases.length > 0 &&
    frases.every((f) => typeof f.inicioMs === 'number' && typeof f.fimMs === 'number')
  )
}

/**
 * O que está errado numa letra, em português, para o painel mostrar.
 *
 * Devolve uma lista vazia quando está tudo bem. `paraPublicar` exige a música
 * toda sincronizada; um rascunho pode ter frases por marcar.
 */
function validarFrases(frases, duracaoMs, paraPublicar) {
  const erros = []
  if (!Array.isArray(frases)) return ['A letra não veio no formato esperado.']
  if (paraPublicar && frases.length === 0) erros.push('A letra está vazia.')
  let anterior = -1
  frases.forEach((f, i) => {
    const n = i + 1
    if (!f || typeof f.texto !== 'string' || !Array.isArray(f.palavras) || f.palavras.length === 0) {
      erros.push(`A frase ${n} está vazia.`)
      return
    }
    const temTempo = typeof f.inicioMs === 'number'
    if (!temTempo) {
      if (paraPublicar) erros.push(`A frase ${n} ainda não foi sincronizada.`)
      return
    }
    if (f.inicioMs < 0 || typeof f.fimMs !== 'number' || f.fimMs <= f.inicioMs) {
      erros.push(`A frase ${n} tem um tempo impossível.`)
    }
    if (f.inicioMs < anterior) erros.push(`A frase ${n} começa antes da frase ${n - 1}.`)
    if (typeof duracaoMs === 'number' && f.inicioMs > duracaoMs + 2000) {
      erros.push(`A frase ${n} começa depois de a música acabar.`)
    }
    f.palavras.forEach((p) => {
      if (p.destaque !== undefined && p.destaque !== null && ![0, 1, 2, 3].includes(p.destaque)) {
        erros.push(`A frase ${n} tem um destaque inválido.`)
      }
    })
    anterior = f.inicioMs
  })
  return erros
}

module.exports = {
  normalizarPalavra,
  separarPalavras,
  frasesDoTexto,
  frasesDeTranscricao,
  pesoDaPalavra,
  fimDaFrase,
  distribuirTempos,
  aplicarMarcas,
  marcasDasFrases,
  niveisDaFrase,
  composicaoDaFrase,
  posicaoNoTempo,
  estaSincronizada,
  validarFrases,
  COMPOSICOES,
  PALETAS,
  MS_POR_PESO,
}
