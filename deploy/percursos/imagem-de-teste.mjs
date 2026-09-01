// Imagens de teste feitas aqui, sem ficheiros à parte e sem bibliotecas.
//
// `editor-igual-ao-publico.mjs` carregava `arte-deitada.png`, um ficheiro que
// eu tinha criado à mão e nunca versionei. Passava na minha máquina e rebentava
// em qualquer outra: ENOENT logo na primeira linha que interessa. Um percurso
// que só corre onde foi escrito não serve para o que estes existem — serem
// corridos por outra pessoa, noutro dia, antes de dar uma correção por feita.
//
// Um PNG é assinatura, IHDR, IDAT e IEND, cada um com o seu CRC. São trinta
// linhas e evitam uma dependência e um ficheiro binário no repositório.
import { deflateSync } from 'node:zlib'

const TABELA = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = TABELA[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pedaco(tipo, dados) {
  const t = Buffer.from(tipo, 'ascii')
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, dados])))
  return Buffer.concat([tamanho, t, dados, crc])
}

/**
 * Um PNG RGB a partir de uma função que diz a cor de cada pixel.
 * `pinta(x, y)` devolve `[r, g, b]`.
 */
export function png(largura, altura, pinta) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 2 // RGB
  const linhas = Buffer.alloc(altura * (1 + largura * 3))
  let i = 0
  for (let y = 0; y < altura; y++) {
    linhas[i++] = 0 // sem filtro
    for (let x = 0; x < largura; x++) {
      const [r, g, b] = pinta(x, y)
      linhas[i++] = r
      linhas[i++] = g
      linhas[i++] = b
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(linhas)),
    pedaco('IEND', Buffer.alloc(0)),
  ])
}

/**
 * A arte deitada com um bloco branco no meio.
 *
 * O bloco é a marca que se procura depois: se o editor e o perfil mostrarem o
 * mesmo pedaço da arte, o bloco cai no mesmo sítio nos dois. É por isso que a
 * arte é às riscas por fora — uma cor lisa não deixaria ver que pedaço é.
 */
export function arteDeitada() {
  const L = 1600
  const A = 900
  return {
    name: 'arte-deitada.png',
    mimeType: 'image/png',
    buffer: png(L, A, (x, y) => {
      const noBloco = x > L * 0.42 && x < L * 0.58 && y > A * 0.42 && y < A * 0.58
      if (noBloco) return [255, 255, 255]
      return Math.floor(x / 40) % 2 ? [20, 60, 140] : [230, 120, 40]
    }),
  }
}
