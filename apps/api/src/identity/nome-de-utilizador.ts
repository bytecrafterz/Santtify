/**
 * O @identificador de cada pessoa.
 *
 * Pedido dele em 31/08: "duas pessoas podem ter o mesmo nome verdadeiro, isso
 * é normal, mas o identificador não pode se repetir". E disse para que serve:
 * "pesquisar, localizar e identificar exatamente uma determinada pessoa".
 *
 * A REGRA VIVE AQUI E SÓ AQUI. É medida no cadastro, na edição do perfil e na
 * consulta de disponibilidade, e já sei o que acontece quando a mesma regra é
 * escrita em três sítios: em 28/08 mudei uma das três cópias da régua do
 * cartão e o botão PUBLICAR passou a acender para cartões que o servidor
 * recusava. O navegador tem uma cópia desta régua, para o campo poder avisar
 * antes de haver pedido nenhum, e essa cópia não é a autoridade.
 */

/** Comprimento: curto o suficiente para caber num ecrã, longo para ser único. */
export const MIN = 3
export const MAX = 20

/**
 * Nomes que ninguém pode tomar.
 *
 * Não é uma lista de palavras feias, é uma lista de palavras que MENTEM: um
 * perfil `@suporte` ou `@santtify` parece a plataforma a falar, e numa
 * plataforma usada por famílias isso é a primeira ferramenta de quem se quer
 * fazer passar por outra pessoa. Os caminhos do site entram na mesma lista,
 * para nunca haver um `@perfil` que colida com o endereço /perfil.
 */
export const RESERVADOS = new Set([
  'admin',
  'administrador',
  'santtify',
  'produtovivo',
  'produto_vivo',
  'suporte',
  'ajuda',
  'contato',
  'contacto',
  'oficial',
  'root',
  'sistema',
  'system',
  'api',
  'perfil',
  'pessoa',
  'entrar',
  'cadastrar',
  'playlist',
  'alfabeto',
  'moderacao',
  'privacidade',
  'termos',
  'null',
  'undefined',
])

/**
 * Põe o que a pessoa escreveu na forma em que é guardado.
 *
 * Minúsculas sempre, acentos resolvidos para a letra sem acento (para "joão"
 * dar "joao" e não perder o caractere), e o resto do que não é permitido cai.
 * O `@` que ela escreveu à frente sai aqui, porque o `@` é do ecrã e não do
 * dado — guardá-lo faria `@@joao` existir.
 */
export function normalizarNomeDeUtilizador(bruto: string): string {
  return bruto
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, MAX)
}

/**
 * Devolve o que está errado, por palavras, ou `null` se estiver bom.
 *
 * Devolve a FRASE e não um sim/não pela mesma razão que a régua do cartão
 * devolve a lista do que falta: "identificador inválido" obriga a adivinhar
 * qual das cinco regras é que se partiu, e quem está a criar uma conta no
 * telemóvel desiste antes de adivinhar.
 */
/**
 * Palavras que ninguém pode usar NEM SEQUER LÁ DENTRO.
 *
 * A lista de reservados acima é de correspondência exacta, e isso deixa uma
 * porta aberta que só vi quando ele escolheu o identificador dele: `@santtify`
 * está travado, mas `@santtifyoficial`, `@santtify_oficial` ou `@santtify2`
 * não estavam. Numa plataforma para crianças, um perfil que parece ser a
 * plataforma a falar é a ferramenta mais útil que se pode dar a quem entra de
 * má intenção, e foi exactamente isso que ele quis impedir em 31/08.
 *
 * Só a marca. Não tento adivinhar mais nada: uma lista grande de pedaços de
 * palavra acabaria a recusar o nome de alguém, e recusar o nome de uma pessoa
 * real é pior do que deixar passar um identificador feio.
 */
const MARCAS = ['santtify', 'produtovivo', 'jesusalfabeto']

/** Tira o que se usa para disfarçar: pontos, traços baixos e dígitos. */
function esqueleto(nome: string): string {
  return nome.replace(/[._\d]/g, '')
}

/**
 * SE ISTO SE PARECE COM A PLATAFORMA A FALAR.
 *
 * Vive aqui e é usada nos DOIS campos que uma pessoa escolhe: o identificador e
 * o nome do perfil. Estava só no identificador, e em 09/09 medi o buraco: o
 * servidor recusava `@santtifyoficial` e aceitava, sem uma palavra, o nome de
 * perfil "Santtify Oficial" — que é justamente o que aparece no perfil, nos
 * comentários e nas publicações. A porta estava trancada e a janela aberta.
 *
 * Normaliza mais do que o `esqueleto` porque um nome de perfil tem espaços e
 * acentos: "Santtify Oficial", "sânttify" e "S a n t t i f y" reduzem-se todos
 * à mesma coisa. Para um identificador o resultado é o mesmo que o `esqueleto`
 * já dava, porque ali só entram letras, dígitos, ponto e traço baixo.
 */
export function pareceNomeDaPlataforma(texto: string): boolean {
  const so = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
  return MARCAS.some((m) => so.includes(m))
}

export function problemaNoNomeDeUtilizador(nome: string, ehDaCasa = false): string | null {
  if (!nome) return 'Escolha um identificador.'
  if (nome.length < MIN) return `O identificador precisa de pelo menos ${MIN} caracteres.`
  if (nome.length > MAX) return `O identificador pode ter no máximo ${MAX} caracteres.`
  if (!/^[a-z]/.test(nome)) return 'O identificador precisa de começar por uma letra.'
  if (!/^[a-z0-9._]+$/.test(nome))
    return 'Use apenas letras, números, ponto e traço baixo, sem espaços nem acentos.'
  if (RESERVADOS.has(nome)) return 'Este identificador é reservado. Escolha outro.'
  /*
    Quem é da casa pode usar o nome da casa. O responsável do projeto é
    `@santtifyoficial` e tem de continuar a poder sê-lo; o que isto impede é
    que qualquer outra pessoa se ponha a parecer a plataforma.
  */
  if (!ehDaCasa && pareceNomeDaPlataforma(esqueleto(nome))) {
    return 'Este identificador parece o nome da plataforma. Escolha outro.'
  }
  return null
}

/**
 * Um ponto de partida a partir do nome que a pessoa escreveu.
 *
 * Serve para o campo já vir preenchido em vez de vazio, e serve para dar
 * identificador às contas que existiam antes desta regra. Não garante que
 * esteja livre: quem grava é que decide isso, contra a base.
 */
export function sugerirNomeDeUtilizador(displayName: string): string {
  const base = normalizarNomeDeUtilizador(displayName.replace(/\s+/g, ''))
  if (base.length >= MIN && /^[a-z]/.test(base)) return base
  // Sem nada aproveitável — um nome só de símbolos, ou começado por número —
  // vale mais uma letra à frente do que devolver vazio e obrigar quem chama a
  // tratar o caso outra vez.
  return `pessoa${base}`.slice(0, MAX)
}
