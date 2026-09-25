/**
 * A geometria do cartão personalizado. UM SÓ SÍTIO.
 *
 * Esta é a peça que o cliente pediu por escrito e a que ele voltou duas vezes:
 * o PDF de impressão não pode ser uma fotografia do ecrã. A prévia é leve para
 * o telemóvel; a folha é renderizada no servidor a 300 dpi. Se as duas contas
 * forem escritas em sítios diferentes, divergem — e a divergência não aparece
 * no ecrã de ninguém, aparece na gráfica, depois de a mãe ter pago.
 *
 * Por isso a conta vive aqui, em JavaScript simples, sem dependências, e é
 * importada tal e qual pelo navegador e pelo servidor. Não é uma abstração
 * elegante: é a única forma de a fidelidade ser estrutural em vez de ser
 * cuidado de quem escreve.
 *
 * O QUE FICA GUARDADO É PROPORÇÃO, NUNCA PIXÉIS.
 * A mãe ajusta num ecrã de 360px e a folha sai com 2480px de largura. Guardar
 * "moveu 40 pixéis para a esquerda" não sobrevive a essa mudança de escala.
 * Guardar "moveu 11% da largura da moldura" sobrevive a qualquer uma.
 */

/** Uma polegada tem 25,4 mm. É daqui que sai tudo o resto. */
const MM_POR_POLEGADA = 25.4

/** A4 em milímetros, de pé. A folha que a gráfica imprime. */
const A4_MM = { largura: 210, altura: 297 }

/** A4 em pontos PostScript, que é a unidade do PDF. 595,28 x 841,89. */
const A4_PT = { largura: 595.28, altura: 841.89 }

/** A régua da impressão profissional. O cliente fixou-a por escrito. */
const DPI_DE_IMPRESSAO = 300

/**
 * As três faixas de qualidade.
 *
 * Duas faixas seriam mais simples e estariam erradas. A fotografia que chega
 * pelo WhatsApp vem recomprimida e cai muitas vezes entre os 200 e os 300 dpi:
 * recusá-la faz a mãe desistir com uma fotografia que ainda dá uma folha
 * aceitável, e aceitá-la sem dizer nada faz a gráfica devolver um cartão
 * borrado. A faixa do meio existe para lhe dizer a verdade e deixá-la decidir.
 */
const DPI_BOM = 300
const DPI_ACEITAVEL = 200

/** Milímetros para pixéis, a uma resolução qualquer. */
function mmParaPx(mm, dpi) {
  return (mm / MM_POR_POLEGADA) * dpi
}

/** Milímetros para pontos PostScript (72 por polegada), a unidade do PDF. */
function mmParaPt(mm) {
  return (mm / MM_POR_POLEGADA) * 72
}

/**
 * O ajuste neutro: a fotografia preenche a moldura, centrada, sem zoom.
 *
 * `escala` 1 é exactamente o "cobrir": o menor aumento que não deixa canto
 * vazio. Acima de 1 a mãe aproximou. Nunca abaixo de 1, porque abaixo de 1
 * apareceria fundo dentro da moldura.
 */
function ajusteNeutro() {
  return { escala: 1, deslocX: 0, deslocY: 0 }
}

/**
 * Onde desenhar a fotografia dentro da moldura, em pixéis de saída.
 *
 * É ESTA a função que o navegador e o servidor partilham. O navegador chama-a
 * com a moldura do ecrã, o servidor chama-a com a moldura a 300 dpi, e sai o
 * mesmo enquadramento nas duas — porque é a mesma conta com outra régua.
 *
 * Devolve o rectângulo da imagem inteira, já esticada e deslocada, com a
 * origem no canto superior esquerdo da moldura. Recortar ao formato da moldura
 * (círculo, elipse ou rectângulo) é trabalho de quem desenha, não desta conta.
 */
function enquadrar(moldura, foto, ajuste) {
  const cobrir = Math.max(moldura.largura / foto.largura, moldura.altura / foto.altura)
  const fator = cobrir * Math.max(1, ajuste.escala)

  const largura = foto.largura * fator
  const altura = foto.altura * fator

  // A FOTOGRAFIA NUNCA SAI DA MOLDURA. O deslocamento empurrava-a sem limite:
  // aproximar, arrastar para o canto e voltar a 1x deixava uma faixa vazia
  // dentro da moldura - no ecra e na folha que vai a grafica. O limite e o
  // que sobra da foto para cada lado; a 1x, no lado justo, nao sobra nada.
  const x = (moldura.largura - largura) / 2 + ajuste.deslocX * moldura.largura
  const y = (moldura.altura - altura) / 2 + ajuste.deslocY * moldura.altura

  return {
    x: Math.min(0, Math.max(moldura.largura - largura, x)),
    y: Math.min(0, Math.max(moldura.altura - altura, y)),
    largura,
    altura,
  }
}

/**
 * Ate onde o deslocamento ainda mexe na foto, em fraccao da moldura.
 *
 * Alem disto `enquadrar` ja trava, e guardar valores maiores so criava uma zona
 * morta: o dedo andava e a foto nao, ate desfazer o excesso.
 */
function limitesDoDesloc(moldura, foto, escala) {
  const cobrir = Math.max(moldura.largura / foto.largura, moldura.altura / foto.altura)
  const fator = cobrir * Math.max(1, escala)
  return {
    x: Math.max(0, (foto.largura * fator - moldura.largura) / 2 / moldura.largura),
    y: Math.max(0, (foto.altura * fator - moldura.altura) / 2 / moldura.altura),
  }
}

/**
 * Quantos dpi a fotografia REALMENTE entrega, já com o enquadramento feito.
 *
 * O cliente escreveu isto com precisão em 08/09: verificar depois do zoom,
 * sobre a área realmente recortada, e não sobre a fotografia inteira. Uma
 * fotografia de 4000px é excelente inteira e pode ser insuficiente se a mãe
 * aproximar até só usar um oitavo dela.
 *
 * A conta não depende da resolução com que se renderiza, e é por isso que se
 * pode chamar no navegador enquanto ela arrasta:
 *
 *     dpi = min(px_largura * 25,4 / mm_largura, px_altura * 25,4 / mm_altura) / escala
 *
 * O mínimo dos dois lados porque a moldura corta pelo lado mais apertado, e a
 * divisão pela escala porque aproximar o dobro usa metade dos pixéis.
 */
function dpiEfetivo(molduraMm, foto, ajuste) {
  const porLargura = (foto.largura * MM_POR_POLEGADA) / molduraMm.largura
  const porAltura = (foto.altura * MM_POR_POLEGADA) / molduraMm.altura
  return Math.min(porLargura, porAltura) / Math.max(1, ajuste.escala)
}

/**
 * O veredicto sobre a fotografia, em linguagem que a mãe entende.
 *
 * Devolve sempre o dpi e o zoom máximo que ainda dá 300, porque uma recusa que
 * não diz o que fazer a seguir é uma porta fechada. Com o zoom máximo, o ecrã
 * pode dizer-lhe "afaste um pouco" em vez de "arranje outra fotografia".
 */
function avaliarFoto(molduraMm, foto, ajuste) {
  const ajusteUsado = ajuste || ajusteNeutro()
  const dpi = dpiEfetivo(molduraMm, foto, ajusteUsado)
  const dpiSemZoom = dpiEfetivo(molduraMm, foto, ajusteNeutro())

  /** Até onde ela pode aproximar mantendo os 300 dpi. 1 = nem um pouco. */
  const zoomMaximo = dpiSemZoom / DPI_BOM

  let nivel
  let mensagem
  if (dpi >= DPI_BOM) {
    nivel = 'BOA'
    mensagem = 'Foto aprovada — qualidade adequada para impressão A4.'
  } else if (dpi >= DPI_ACEITAVEL) {
    nivel = 'ACEITAVEL'
    mensagem =
      'Esta foto imprime, mas sem a nitidez ideal. Se puder, use uma foto maior ' +
      'ou diminua o zoom.'
  } else {
    nivel = 'INSUFICIENTE'
    mensagem =
      'Esta foto não possui qualidade suficiente para impressão A4. ' +
      'Envie outra fotografia com maior resolução.'
  }

  return {
    nivel,
    dpi: Math.round(dpi),
    dpiSemZoom: Math.round(dpiSemZoom),
    zoomMaximo: Math.max(1, Number(zoomMaximo.toFixed(2))),
    aprovada: nivel !== 'INSUFICIENTE',
    mensagem,
  }
}

/**
 * O tamanho mínimo em pixéis que uma fotografia precisa de ter para esta
 * moldura, sem zoom nenhum. É a peneira barata do momento do envio.
 *
 * Serve para recusar de imediato o que nunca vai servir, sem obrigar a mãe a
 * enquadrar primeiro para só depois ouvir que não. A peneira fina — a que conta
 * de verdade — corre depois, sobre o recorte.
 */
function minimoDePixeis(molduraMm) {
  return {
    largura: Math.ceil(mmParaPx(molduraMm.largura, DPI_BOM)),
    altura: Math.ceil(mmParaPx(molduraMm.altura, DPI_BOM)),
  }
}

/**
 * Quanto ocupa um texto a corpo 1, quando ninguém sabe medir a fonte a sério.
 *
 * 0,62 é a largura média de uma letra maiúscula numa sem-serifa a negrito,
 * relativa ao corpo. É uma estimativa, e uma estimativa chega para o caso em
 * que não há fonte nenhuma em mãos.
 */
function larguraEstimada(texto) {
  return Math.max(1, (texto || '').trim().length) * 0.62
}

/**
 * O corpo da letra do nome, em milímetros, para caber na caixa do modelo.
 *
 * `medir` É O PARÂMETRO QUE FAZ ISTO VALER A PENA. Recebe o texto e devolve a
 * largura dele a corpo 1; quem chama passa o medidor da fonte que vai
 * REALMENTE desenhar — o `widthOfTextAtSize` do pdf-lib no servidor, o
 * `measureText` do canvas no navegador. As duas medem Helvetica-Bold e
 * Arial-Bold, que são metricamente compatíveis, por isso dão o mesmo número.
 *
 * Sem ele havia duas contas diferentes e a prévia mentia: "ANA BEATRIZ"
 * partia-se em duas linhas no ecrã e saía numa só no PDF. Um nome que muda de
 * forma entre o que ela aprovou e o que a gráfica imprime é exactamente o que
 * este projeto inteiro existe para não deixar acontecer.
 *
 * `tamanho` é o cursor que ela move, de 0 a 1, entre o mínimo e o máximo que o
 * modelo permite. O resultado nunca passa da caixa, em largura ou em altura.
 */
function corpoDoNome(caixaMm, nome, tamanho, medir) {
  const t = Math.min(1, Math.max(0, tamanho))
  const desejado = caixaMm.corpoMinimo + t * (caixaMm.corpoMaximo - caixaMm.corpoMinimo)

  const largura = (medir || larguraEstimada)(nome)
  const cabe = largura > 0 ? (caixaMm.largura * FOLGA_DO_NOME) / largura : desejado

  return Math.max(
    caixaMm.corpoMinimo * 0.5,
    Math.min(desejado, cabe, caixaMm.altura * FOLGA_DO_NOME),
  )
}

/**
 * A margem que o nome deixa dentro da caixa.
 *
 * Sem ela o corpo cresce até encostar aos bordos, e em português isso põe o til
 * do "Ã" no tecto e a cedilha do "Ç" no chão. No ecrã passa; impresso e cortado
 * na gráfica, tosa-se o acento. Vive aqui para o navegador e o servidor
 * deixarem exactamente a mesma folga.
 */
const FOLGA_DO_NOME = 0.92

/** O preço, com o desconto que o administrador configurou. Em cêntimos. */
function calcularPreco(quantidade, tabela) {
  const q = Math.max(0, Math.trunc(quantidade))
  if (q === 0) return { quantidade: 0, subtotalCent: 0, descontoCent: 0, totalCent: 0, percentagemAplicada: 0 }

  const subtotalCent = q * tabela.precoUnitarioCent
  const aplica = q >= tabela.descontoAPartirDe
  const percentagemAplicada = aplica ? tabela.descontoPercentagem : 0
  const descontoCent = Math.round((subtotalCent * percentagemAplicada) / 100)

  return {
    quantidade: q,
    subtotalCent,
    descontoCent,
    totalCent: subtotalCent - descontoCent,
    percentagemAplicada,
  }
}

/**
 * Números como o cliente os escreveu no ponto 1: 1K, 1,5K, 20K, 100K, 1M, 1,5M.
 *
 * NÃO usa `abreviar` de `lib/numeros`, que dá "1,5 mil" e "1,5 mi". As duas
 * formas estão certas e servem sítios diferentes: aquela é a do trilho de
 * indicadores da letra, e o cliente escreveu-a assim; esta é a dos cartões do
 * carrossel, e o cliente escreveu-a assim. Uniformizar seria contrariar um dos
 * dois pedidos, e nenhum deles está errado.
 *
 * `Intl.NumberFormat('pt-BR', { notation: 'compact' })` também não serve: em
 * português devolve "1,5 mil" e "1,5 mi", nunca "1,5K".
 */
function abreviarKM(n) {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(Math.trunc(n))

  const escrever = (valor, sufixo) => {
    // Casa decimal só abaixo de 10: "1,5K" informa, "20,4K" só ocupa espaço.
    if (valor < 10) {
      const texto = valor.toFixed(1).replace('.', ',')
      return (texto.endsWith(',0') ? texto.slice(0, -2) : texto) + sufixo
    }
    return String(Math.round(valor)) + sufixo
  }

  if (n < 1_000_000) return escrever(n / 1000, 'K')
  return escrever(n / 1_000_000, 'M')
}

module.exports = {
  MM_POR_POLEGADA,
  A4_MM,
  A4_PT,
  DPI_DE_IMPRESSAO,
  DPI_BOM,
  DPI_ACEITAVEL,
  mmParaPx,
  mmParaPt,
  ajusteNeutro,
  enquadrar,
  limitesDoDesloc,
  dpiEfetivo,
  avaliarFoto,
  minimoDePixeis,
  corpoDoNome,
  larguraEstimada,
  FOLGA_DO_NOME,
  calcularPreco,
  abreviarKM,
}
