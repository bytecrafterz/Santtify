// Criar uma conta de teste, pelo formulário, como uma pessoa a cria.
//
// EXISTE PORQUE O CADASTRO MUDOU EM 01/09 e passou a exigir @identificador e
// fotografia. Quatro percursos criavam contas com a sua própria cópia destes
// passos, e nesse dia os quatro partiram-se ao mesmo tempo. Uma cópia por
// ficheiro é uma cópia por ficheiro para consertar, e a que se esquece falha
// calada num percurso que já ninguém lê com atenção.
import { writeFileSync, existsSync } from 'node:fs'

/** Um PNG minúsculo, escrito por nós: o percurso não pode depender de um
 *  ficheiro que por acaso exista na máquina de quem o corre. */
export const FOTO_DE_TESTE = '/tmp/pv-foto-de-teste.png'
if (!existsSync(FOTO_DE_TESTE)) {
  writeFileSync(
    FOTO_DE_TESTE,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWklEQVR4nO3NMQEAAAgDoC1Z+hcaTh' +
        '+gAnOmCggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI' +
        'CAgICAgICAgICAgIDA/wMHFwABZfqzUgAAAABJRU5ErkJggg==',
      'base64',
    ),
  )
}

/**
 * Preenche e envia o cadastro. Devolve o @identificador que ficou.
 *
 * Não decide se correu bem: quem chamou é que sabe o que esperar, e um
 * ajudante que afirma sucesso por si é a maneira mais rápida de um percurso
 * anunciar que passou depois de rebentar.
 */
export async function criarConta(pg, { site, projeto, email, senha, nome, limpar }) {
  await pg.goto(`${site}/${projeto}/cadastrar`, { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(2800)
  if (limpar) await limpar()

  /*
    O NOME DE TESTE NAO PODE TER DIGITOS.

    Em 01/09 pus a regua que recusa numeros no nome do perfil, a pedido dele, e
    nao vim aqui. Todos os percursos batizavam a conta com a marca de tempo —
    "Suite 054004", "Pf 054004" — e no dia seguinte os quatro pararam no
    cadastro, sem conta criada e com a limpeza a queixar-se de nao encontrar o
    que apagar. Mudar uma regra obriga a seguir todos os caminhos que passam
    por ela, e os percursos guardados sao um deles.

    Os digitos viram letras em vez de desaparecerem: o nome continua a ser
    diferente em cada corrida, o que ajuda a reconhecer qual delas o criou.
    E se sobrarem menos de tres letras, entra "Teste" a frente, porque a regua
    exige tres.
  */
  const nomeValido = (() => {
    const letras = 'abcdefghij'
    const trocado = nome.replace(/\d/g, (d) => letras[Number(d)])
    return trocado.replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim().replace(/[^\p{L}]/gu, '')
      .length >= 3
      ? trocado
      : `Teste ${trocado}`
  })()
  await pg.fill('input[name=displayName]', nomeValido)
  await pg.fill('input[name=email]', email)
  await pg.fill('input[name=password]', senha)

  // O identificador é escrito à mão e não deixado à sugestão: a sugestão vem
  // do nome e dois percursos com nomes parecidos colidiriam entre si.
  const id = `t${String(Date.now()).slice(-9)}`
  await pg.fill('.campo-identificador input', id)
  // Espera a conferência de disponibilidade acabar. Enviar durante a
  // conferência funciona, mas deixa o percurso a depender de quem chega
  // primeiro, e um percurso que às vezes passa não serve para nada.
  await pg.waitForTimeout(1800)

  await pg.setInputFiles('.campo-foto-cadastro input[type=file]', FOTO_DE_TESTE)
  await pg.waitForTimeout(2500)
  if (await pg.isVisible('.ajustar-foto')) {
    const botoes = await pg.$$('.ajustar-foto button')
    if (botoes.length) await botoes[botoes.length - 1].click()
    await pg.waitForTimeout(3000)
  }

  await pg.click('button[type=submit]')
  await pg.waitForTimeout(7000)
  if (limpar) await limpar()
  return id
}
