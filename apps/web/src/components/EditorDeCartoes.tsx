'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cartoes,
  type Categoria,
  type CriancaDoPedido,
  type ModeloDeCartao,
  type Pedido,
} from '@/lib/cartoes'
import { ErroDeApi } from '@/lib/auth'
import { useAuth } from './ProvedorDeAuth'
import { EntregaDosCartoes } from './EntregaDosCartoes'
import { CartaoComoEditor } from './CartaoComoEditor'
import { Voltar } from './Voltar'

/**
 * O editor dos cartões personalizados.
 *
 * O PERCURSO É O QUE ELE ESCREVEU, por esta ordem: quantas crianças → uma foto
 * por criança, analisada logo → escolher quais produzir → pagar → escrever o
 * nome uma vez → enquadrar uma vez → os sete actualizam-se juntos → conferir →
 * aprovar → o ficheiro.
 *
 * O QUE ESTE FICHEIRO NÃO FAZ, e é a decisão mais importante: não recorta a
 * fotografia. O `AjustarFoto` da capa do perfil recorta no telemóvel e envia a
 * imagem já cortada, e ali está certo — o que se guarda é uma capa de 1200px.
 * Aqui o que se guarda é uma folha A4 a 300 dpi, com 2480px de largura, e uma
 * imagem recortada no telemóvel nunca teria essa resolução. Por isso o que sobe
 * é a fotografia INTEIRA e três números: escala, deslocX, deslocY. O recorte
 * acontece no servidor, à resolução de impressão.
 *
 * É essa a razão de `enquadrar` viver em `@pv/cartoes` e ser importado aqui e
 * lá: o que ela vê ao arrastar e o que a gráfica imprime saem da mesma conta.
 * Foi o que prometi ao cliente por escrito, duas vezes.
 */

type Passo = 'categoria' | 'quantidade' | 'fotos' | 'selecao' | 'pagamento' | 'editor' | 'pronto'

/**
 * Onde fica guardado o pedido em curso, por projeto.
 *
 * ISTO NÃO É UMA COMODIDADE. O pagamento por Pix confirma-se por fora, e o
 * cliente pediu de propósito que a mãe pudesse continuar sem ficar parada à
 * espera — o que significa que ela vai sair da página. Sem esta linha, fechar o
 * separador depois de pagar apagava o único caminho de volta ao pedido: ela
 * tinha pago e não tinha como chegar aos ficheiros.
 *
 * Guarda-se só o identificador. A fotografia e o nome vivem no servidor, e o
 * telemóvel dela não fica com nada da criança.
 */
const CHAVE_DO_PEDIDO = 'santtify:cartoes:pedido'

function pedidoGuardado(projeto: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(`${CHAVE_DO_PEDIDO}:${projeto}`)
  } catch {
    // Navegação privada e alguns telemóveis atiram ao ler. Sem pedido guardado
    // o editor começa do princípio, que é mau mas não é uma página partida.
    return null
  }
}

function guardarPedido(projeto: string, id: string | null) {
  if (typeof window === 'undefined') return
  try {
    const chave = `${CHAVE_DO_PEDIDO}:${projeto}`
    if (id) window.localStorage.setItem(chave, id)
    else window.localStorage.removeItem(chave)
  } catch {
    /* ver acima */
  }
}

/** "criança" -> "Criança", para os títulos das caixas. */
function maiuscula(texto: string): string {
  return texto ? texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1) : texto
}

/** Só o bastante para apanhar gralhas; quem decide se o e-mail serve é o servidor. */
function emailValido(texto: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto.trim())
}

export function EditorDeCartoes({
  projectSlug,
  categoriaInicial = null,
}: {
  projectSlug: string
  /** A categoria por que a pessoa entrou, vinda do cartaz da oferta. */
  categoriaInicial?: string | null
}) {
  const [modelos, definirModelos] = useState<ModeloDeCartao[]>([])
  const [pedido, definirPedido] = useState<Pedido | null>(null)
  const [passo, definirPasso] = useState<Passo>('categoria')
  const [quantidade, definirQuantidade] = useState(1)
  const [activa, definirActiva] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const { usuario } = useAuth()
  const [email, definirEmail] = useState('')
  const [pixCopiado, definirPixCopiado] = useState(false)
  const [categorias, definirCategorias] = useState<Categoria[] | null>(null)
  const [categoria, definirCategoria] = useState<string | null>(null)

  /**
   * As categorias: Crianças, Adultos, e as que o cliente criar no painel.
   *
   * Com UMA só, o ecrã de escolha nem aparece — a mãe que chega para os
   * cartões das crianças não tem de responder a uma pergunta que não existe.
   * As actualizações são funcionais de propósito: se o pedido guardado for
   * retomado primeiro, é ele que manda, e esta resposta não o atropela.
   */
  useEffect(() => {
    let vivo = true
    cartoes
      .categorias(projectSlug)
      .then((lista) => {
        if (!vivo) return
        definirCategorias(lista)
        // Uma só categoria não é uma escolha. Nem é escolha quando a pessoa já
        // escolheu lá atrás, ao tocar no cartaz de uma delas.
        const escolhida =
          lista.length === 1
            ? lista[0]
            : (categoriaInicial && lista.find((c) => c.slug === categoriaInicial)) || null
        if (escolhida) {
          definirCategoria((actual) => actual ?? escolhida.slug)
          definirPasso((actual) => (actual === 'categoria' ? 'quantidade' : actual))
        }
      })
      .catch(() => {
        if (vivo) definirCategorias([])
      })
    return () => {
      vivo = false
    }
  }, [projectSlug])

  /** Os cartões DA categoria escolhida — os dos adultos não entram no editor das crianças. */
  useEffect(() => {
    if (!categoria) return
    cartoes
      .modelos(projectSlug, categoria)
      .then(definirModelos)
      .catch(() => definirModelos([]))
  }, [projectSlug, categoria])

  /**
   * Retomar o pedido de quem já cá esteve.
   *
   * Um pedido expirado ou apagado já não responde: nesse caso limpa-se a chave
   * e ela recomeça, em vez de ficar presa num ecrã que não carrega.
   */
  useEffect(() => {
    const guardado = pedidoGuardado(projectSlug)
    if (!guardado) return
    let vivo = true
    cartoes
      .verPedido(projectSlug, guardado)
      .then((p) => {
        if (!vivo) return
        if (p.estado === 'EXPIRADO') {
          guardarPedido(projectSlug, null)
          return
        }
        definirPedido(p)
        definirCategoria(p.categoria?.slug ?? null)
        const porConfirmar = p.criancas.find((c) => c.selecionada && !c.confirmada)
        /*
          UM RASCUNHO RETOMA NO CARTÃO, e não no passo das fotos nem no da
          escolha. Desde 25/09 esses passos deixaram de existir no caminho
          normal — o cartão é o editor — e mandar quem volta para lá era
          ressuscitá-los.

          Um pedido com mais do que uma criança ainda usa os ecrãs antigos: foram
          feitos antes desta mudança e há pedidos assim guardados em telemóveis.
          Quebrá-los para arrumar código seria trocar o cliente pelo repositório.
        */
        if (p.estado === 'RASCUNHO') {
          if (p.criancas.length === 1) {
            definirActiva(p.criancas[0].id)
            definirPasso('editor')
          } else {
            definirPasso(p.criancas.some((c) => c.aprovada) ? 'selecao' : 'fotos')
          }
        } else if (porConfirmar) {
          definirActiva(porConfirmar.id)
          definirPasso('editor')
        } else {
          definirPasso('pronto')
        }
      })
      .catch(() => guardarPedido(projectSlug, null))
    return () => {
      vivo = false
    }
  }, [projectSlug])

  /**
   * ESCOLHIDA A CATEGORIA, O CARTÃO ABRE. Não há nada a perguntar antes.
   *
   * Havia: "quantas crianças?", depois "envie as fotos", depois "escolha quais
   * quer produzir", e só então o cartão. Três ecrãs de perguntas antes de se ver
   * o que se está a comprar — e ele em 25/09: "Não quero várias telas, vários
   * blocos ou ferramentas espalhadas. O próprio cartão deve funcionar como
   * editor."
   *
   * Uma criança, porque é o que o cartaz vende: "7 cartões personalizados A4 com
   * a foto + nome da criança", R$ 49. Quem quiser um segundo conjunto faz outro
   * pedido no fim, que é o botão que já lá está.
   *
   * O rascunho nasce a pedido do dedo dela — ao abrir a página — e não é uma
   * compra: sem foto e sem nome não segue para lado nenhum, e o expurgo leva-o.
   */
  const aCriar = useRef(false)
  useEffect(() => {
    if (pedido || !categoria || aCriar.current) return
    if (pedidoGuardado(projectSlug)) return
    aCriar.current = true
    cartoes
      .criarPedido(projectSlug, 1, categoria)
      .then((novo) => {
        definirPedido(novo)
        guardarPedido(projectSlug, novo.id)
        definirActiva(novo.criancas[0]?.id ?? null)
        definirPasso('editor')
      })
      .catch((e) => {
        aCriar.current = false
        definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível começar o pedido.')
      })
  }, [projectSlug, categoria, pedido])

  const crianca = useMemo(
    () => pedido?.criancas.find((c) => c.id === activa) ?? null,
    [pedido, activa],
  )

  /**
   * Como o editor chama quem aparece nos cartões: "criança", "pessoa"...
   *
   * Vem da categoria, e é por isso que as frases do ecrã evitam o artigo e o
   * género: "Quantas fotos?", "a foto de cada pessoa", "Pessoa 1". Uma frase
   * como "Quantas crianças?" parte-se na primeira categoria de nome masculino —
   * "Quantas casais?" — e a correcção seria um `if` por categoria.
   */
  const rotulo = useMemo(() => {
    const actual = pedido?.categoria ?? categorias?.find((c) => c.slug === categoria) ?? null
    return { um: actual?.rotuloSingular ?? 'criança' }
  }, [pedido, categorias, categoria])

  const comErro = useCallback(async (chave: string, accao: () => Promise<void>) => {
    definirErro(null)
    definirOcupado(chave)
    try {
      await accao()
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível concluir. Tente de novo.')
    } finally {
      definirOcupado(null)
    }
  }, [])

  // Quem tem conta não escreve o e-mail outra vez.
  useEffect(() => {
    if (usuario?.email) definirEmail((actual) => actual || usuario.email)
  }, [usuario?.email])

  /*
    O ESTADO DO PAGAMENTO ACTUALIZA-SE SOZINHO.

    Com o Pix a sério, ela paga no aplicativo do banco e volta para aqui. Antes
    tinha de adivinhar que havia um botão para verificar; agora o ecrã pergunta
    de 5 em 5 segundos enquanto está à espera, e só com o separador à vista.

    EM QUALQUER PASSO, e não só no do pagamento: ela pode ir personalizar
    enquanto o Pix confirma, e quem volta da página do cartão retoma no editor.
    Pára ao fim de 20 minutos: quem ainda não pagou nessa altura volta pelo
    botão, e o servidor não fica a responder a um separador esquecido.
  */
  const aEsperarPagamento = pedido?.estado === 'AGUARDANDO_PAGAMENTO' ? pedido.id : null
  useEffect(() => {
    if (!aEsperarPagamento) return
    const fim = Date.now() + 20 * 60_000
    const temporizador = window.setInterval(() => {
      if (Date.now() > fim) return window.clearInterval(temporizador)
      if (document.visibilityState !== 'visible') return
      cartoes
        .verPedido(projectSlug, aEsperarPagamento)
        .then((p) => {
          if (p.estado !== 'AGUARDANDO_PAGAMENTO') definirPedido(p)
        })
        .catch(() => {})
    }, 5_000)
    return () => window.clearInterval(temporizador)
  }, [aEsperarPagamento, projectSlug])

  // ── Passo 0: para quem são os cartões ───────────────────────────

  if (passo === 'categoria') {
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} />
        <section className="cartoes-passo">
          {categorias === null ? (
            <p className="cartoes-ajuda">A carregar…</p>
          ) : categorias.length === 0 ? (
            <p className="cartoes-ajuda">
              Os cartões ainda estão sendo preparados. Volte em breve.
            </p>
          ) : (
            <>
              <h2>Para quem são os cartões?</h2>
              <ul className="cartoes-categorias">
                {categorias.map((c) => (
                  <li key={c.slug}>
                    <button
                      type="button"
                      className="cartoes-categoria"
                      onClick={() => {
                        definirCategoria(c.slug)
                        definirPasso('quantidade')
                      }}
                    >
                      {c.capaUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.capaUrl} alt="" />
                      )}
                      <strong>{c.nome}</strong>
                      {c.descricao && <span>{c.descricao}</span>}
                      <span className="cartoes-categoria-preco">
                        {c.cartoes === 1 ? '1 cartão' : `${c.cartoes} cartões`} ·{' '}
                        {(c.preco.precoUnitarioCent / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: c.preco.moeda,
                        })}{' '}
                        por conjunto
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    )
  }

  // ── Passo 1: quantas crianças ────────────────────────────────────

  if (passo === 'quantidade') {
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} />
        {/* A MONTRA VEM ANTES DA PERGUNTA.
            Quem chega aqui era recebido com "quantas fotos?" sem nunca ter
            visto um cartão. Ninguém decide quantos compra de uma coisa que
            ainda não viu. */}
        {modelos.length > 0 && (
          <section className="cartoes-passo">
            <h2>
              Os cartões <span className="cartoes-conta">{modelos.length} modelos</span>
            </h2>
            <p className="cartoes-ajuda">
              Cada conjunto traz os {modelos.length}, com o nome e a foto de quem
              você escolher.
            </p>
            <GaleriaDeModelos modelos={modelos} />
          </section>
        )}

        <section className="cartoes-passo">
          <h2>Quantas fotos você vai enviar?</h2>
          <p className="cartoes-ajuda">
            Uma foto de cada {rotulo.um}. Depois você escolhe quais quer
            produzir — não precisa comprar todas.
          </p>
          <div className="cartoes-contador">
            <button
              type="button"
              onClick={() => definirQuantidade((q) => Math.max(1, q - 1))}
              aria-label="Menos uma foto"
            >
              −
            </button>
            <strong aria-live="polite">{quantidade}</strong>
            <button
              type="button"
              onClick={() => definirQuantidade((q) => Math.min(10, q + 1))}
              aria-label="Mais uma foto"
            >
              +
            </button>
          </div>
          {erro && <p className="cartoes-erro">{erro}</p>}
          <button
            type="button"
            className="cartoes-accao"
            disabled={ocupado !== null}
            onClick={() =>
              comErro('criar', async () => {
                const novo = await cartoes.criarPedido(projectSlug, quantidade, categoria ?? undefined)
                definirPedido(novo)
                guardarPedido(projectSlug, novo.id)
                definirPasso('fotos')
              })
            }
          >
            {ocupado === 'criar' ? 'A preparar…' : 'Continuar'}
          </button>
          {categorias && categorias.length > 1 && (
            <button
              type="button"
              className="cartoes-ligacao"
              onClick={() => definirPasso('categoria')}
            >
              Escolher outra categoria
            </button>
          )}
        </section>
      </div>
    )
  }

  if (!pedido) return <div className="editor-cartoes">A carregar…</div>

  // ── Passo 2: as fotos, uma por criança ───────────────────────────

  if (passo === 'fotos') {
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} />
        <section className="cartoes-passo">
          <h2>Envie a foto de cada {rotulo.um}</h2>
          <p className="cartoes-ajuda">
            Assim que a foto chega, verificamos se ela tem qualidade para
            impressão em A4. Uma foto recusada não impede as outras.
          </p>

          <ul className="cartoes-lista-de-criancas">
            {pedido.criancas.map((c) => (
              <CaixaDaCrianca
                key={c.id}
                crianca={c}
                rotuloUm={rotulo.um}
                projectSlug={projectSlug}
                pedidoId={pedido.id}
                modelos={modelos}
                ocupado={ocupado}
                aoMudar={definirPedido}
                aoOcupar={definirOcupado}
                aoErrar={definirErro}
              />
            ))}
          </ul>

          {erro && <p className="cartoes-erro">{erro}</p>}

          <button
            type="button"
            className="cartoes-accao"
            disabled={!pedido.criancas.some((c) => c.aprovada)}
            onClick={() => definirPasso('selecao')}
          >
            Continuar
          </button>
          {!pedido.criancas.some((c) => c.aprovada) && (
            <p className="cartoes-ajuda">Envie pelo menos uma foto aprovada para continuar.</p>
          )}
        </section>
      </div>
    )
  }

  // ── Passo 3: escolher quais produzir ─────────────────────────────

  if (passo === 'selecao') {
    const aprovadas = pedido.criancas.filter((c) => c.aprovada)
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} />
        <section className="cartoes-passo">
          <h2>Quais você quer produzir agora?</h2>
          <p className="cartoes-ajuda">
            Cada conjunto tem os {modelos.length || 7} cartões personalizados.
          </p>

          <ul className="cartoes-selecao">
            {aprovadas.map((c) => (
              <li key={c.id}>
                <label className="cartoes-escolha">
                  <input
                    type="checkbox"
                    checked={c.selecionada}
                    onChange={(ev) => {
                      /**
                       * A marca aparece ANTES da resposta do servidor.
                       *
                       * Sem isto, tocar na caixa não fazia nada visível até a
                       * ida e volta terminar. Numa ligação de telemóvel isso é
                       * meio segundo em que o ecrã parece avariado, e a reacção
                       * natural é tocar outra vez — e a segunda toca desmarca o
                       * que a primeira acabou de marcar.
                       *
                       * Se o servidor recusar, o `catch` repõe o estado real: a
                       * verdade continua a ser dele, só deixou de ser a primeira
                       * coisa que ela vê.
                       */
                      const querMarcada = ev.target.checked
                      definirPedido({
                        ...pedido,
                        criancas: pedido.criancas.map((x) =>
                          x.id === c.id ? { ...x, selecionada: querMarcada } : x,
                        ),
                      })
                      void comErro(`sel-${c.id}`, async () => {
                        try {
                          definirPedido(
                            await cartoes.actualizar(projectSlug, pedido.id, c.id, {
                              selecionada: querMarcada,
                            }),
                          )
                        } catch (falha) {
                          definirPedido(await cartoes.verPedido(projectSlug, pedido.id))
                          throw falha
                        }
                      })
                    }}
                  />
                  <img
                    src={cartoes.urlDaFoto(projectSlug, pedido.id, c.id)}
                    alt=""
                    className="cartoes-miniatura-foto"
                  />
                  <span>{maiuscula(rotulo.um)} {c.ordem}</span>
                </label>
              </li>
            ))}
          </ul>

          <Resumo pedido={pedido} />
          {erro && <p className="cartoes-erro">{erro}</p>}

          <button
            type="button"
            className="cartoes-accao"
            disabled={pedido.preco.quantidade === 0}
            onClick={() => definirPasso('pagamento')}
          >
            Ir para o pagamento
          </button>
        </section>
      </div>
    )
  }

  // ── Passo 4: pagamento ───────────────────────────────────────────

  if (passo === 'pagamento') {
    const pago = pedido.estado === 'PAGO' || pedido.estado === 'PRONTO'
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} />
        <section className="cartoes-passo">
          <h2>Pagamento</h2>
          <Resumo pedido={pedido} />

          {/*
            QUEM PROCESSA O PAGAMENTO, DITO PELO NOME.

            "Deixa bem claro que estamos usado mercado pago para mostrar
            credibilidade" — 24/09. O ecrã dizia "Pagar com Pix" e "Pagar com
            cartão" e nunca dizia para onde iam os dados do cartão. Numa loja que
            a pessoa não conhece, e a vender fotografias de crianças, esse
            silêncio custa vendas — e o nome que o quebra já era verdade desde
            que o módulo existe: o cartão é sempre cobrado na página deles.
          */}
          {!pago && (
            <p className="cartoes-processador">
              <span aria-hidden="true">🔒</span>
              <span>
                Pagamento processado pelo <strong>Mercado&nbsp;Pago</strong>. O número do
                cartão é digitado na página deles — nós nunca o vemos nem o guardamos.
              </span>
            </p>
          )}

          {!pedido.meio && (
            <div className="cartoes-meios">
              {/* O processador de pagamentos exige um e-mail de quem paga. Vai
                  para ele e não fica guardado no pedido. */}
              <label className="cartoes-email-pagamento">
                <span>Seu e-mail, para o comprovante</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => definirEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </label>
              <button
                type="button"
                className="cartoes-accao"
                disabled={ocupado !== null || !emailValido(email)}
                onClick={() =>
                  comErro('pix', async () => {
                    definirPedido(await cartoes.pagar(projectSlug, pedido.id, 'PIX', email.trim()))
                  })
                }
              >
                Pagar com Pix
              </button>
              <button
                type="button"
                className="cartoes-accao-secundaria"
                disabled={ocupado !== null || !emailValido(email)}
                onClick={() =>
                  comErro('cartao', async () => {
                    const resposta = await cartoes.pagar(projectSlug, pedido.id, 'CARTAO', email.trim())
                    definirPedido(resposta)
                    // O cartão paga-se na página do Mercado Pago, e ela devolve
                    // a pessoa aqui. O pedido fica guardado neste aparelho, por
                    // isso o editor retoma onde estava.
                    if (resposta.urlDeRedireccionamento) {
                      window.location.assign(resposta.urlDeRedireccionamento)
                    }
                  })
                }
              >
                Pagar com cartão
              </button>
            </div>
          )}

          {pedido.pixQrSvg && !pago && (
            <div className="cartoes-pix">
              <div
                className="cartoes-pix-qr"
                // O SVG vem do nosso próprio servidor, gerado pela biblioteca de
                // QR a partir de um texto que nós escrevemos. Não é conteúdo de
                // utilizador.
                dangerouslySetInnerHTML={{ __html: pedido.pixQrSvg }}
              />
              {/*
                O "COPIA E COLA" É O QUE SE USA NO TELEMÓVEL.

                Quem compra no telemóvel não consegue apontar a câmara ao próprio
                ecrã. O caminho real é copiar o código e colá-lo no aplicativo
                do banco, e por isso ele vem primeiro e num botão grande.
              */}
              {pedido.pixCopiaECola && (
                <>
                  <button
                    type="button"
                    className="cartoes-accao"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(pedido.pixCopiaECola ?? '')
                        .then(() => {
                          definirPixCopiado(true)
                          window.setTimeout(() => definirPixCopiado(false), 3000)
                        })
                        .catch(() => definirPixCopiado(false))
                    }}
                  >
                    {pixCopiado ? '✓ Código copiado' : 'Copiar código Pix'}
                  </button>
                  <p className="cartoes-ajuda">
                    Abra o aplicativo do seu banco, escolha Pix copia e cola e cole o
                    código. Ou aponte a câmera para o QR Code acima.
                  </p>
                  <textarea
                    className="cartoes-pix-codigo"
                    readOnly
                    value={pedido.pixCopiaECola}
                    rows={3}
                    aria-label="Código Pix copia e cola"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </>
              )}
              <p className="cartoes-ajuda">
                Você pode continuar personalizando enquanto o pagamento é
                confirmado. Os arquivos ficam liberados assim que a confirmação
                chegar.
              </p>
            </div>
          )}

          <p className={pago ? 'cartoes-estado-pago' : 'cartoes-estado-espera'}>
            {pago ? '✓ Pagamento confirmado.' : 'Aguardando confirmação do pagamento…'}
          </p>

          {erro && <p className="cartoes-erro">{erro}</p>}

          <button
            type="button"
            className="cartoes-accao"
            onClick={() => {
              const primeira = pedido.criancas.find((c) => c.selecionada)
              definirActiva(primeira?.id ?? null)
              definirPasso('editor')
            }}
          >
            Personalizar os cartões
          </button>
          <button
            type="button"
            className="cartoes-ligacao"
            onClick={() =>
              comErro('recarregar', async () => {
                definirPedido(await cartoes.verPedido(projectSlug, pedido.id))
              })
            }
          >
            Já paguei — verificar agora
          </button>
        </section>
      </div>
    )
  }

  // ── Passo 5: o editor ────────────────────────────────────────────

  if (passo === 'editor' && crianca) {
    return (
      <div className="editor-cartoes editor-cartoes-uma-tela">
        <Cabecalho projectSlug={projectSlug} enxuto />
        {erro && <p className="cartoes-erro">{erro}</p>}
        <CartaoComoEditor
          projectSlug={projectSlug}
          pedidoId={pedido.id}
          crianca={crianca}
          modelos={modelos}
          aSalvar={ocupado === 'salvar'}
          aoMudarCrianca={(nova) =>
            definirPedido({
              ...pedido,
              criancas: pedido.criancas.map((c) => (c.id === nova.id ? nova : c)),
            })
          }
          aoErrar={definirErro}
          /*
            "Editou finalizou ai vem o pagamento" — 24/09.

            Salvar marca a criança como escolhida e confirmada e leva ao
            pagamento. São as duas marcas que o servidor exige para cobrar, e
            pôr as duas aqui é o que apaga os dois ecrãs que as pediam antes.
          */
          aoSalvar={() =>
            comErro('salvar', async () => {
              const p = await cartoes.actualizar(projectSlug, pedido.id, crianca.id, {
                selecionada: true,
                confirmada: true,
              })
              definirPedido(p)
              definirPasso('pagamento')
            })
          }
        />
      </div>
    )
  }

  // ── Passo 6: os ficheiros ────────────────────────────────────────

  return (
    <div className="editor-cartoes">
      <Cabecalho projectSlug={projectSlug} />
      <section className="cartoes-passo">
        <h2>Seus cartões estão prontos</h2>
        <ul className="cartoes-prontos">
          {pedido.criancas
            .filter((c) => c.selecionada && c.confirmada)
            .map((c) => (
              <li key={c.id}>
                <strong>
                  {c.nome} — {modelos.length || 7} cartões
                </strong>
                <EntregaDosCartoes
                  projectSlug={projectSlug}
                  pedidoId={pedido.id}
                  criancaId={c.id}
                  nome={c.nome}
                  liberado={pedido.estado === 'PAGO' || pedido.estado === 'PRONTO'}
                />
              </li>
            ))}
        </ul>
        <p className="cartoes-ajuda">
          O arquivo fica disponível por tempo limitado. Depois disso, a foto e o
          PDF são apagados dos nossos servidores.
        </p>
        {/* Sem isto, o pedido guardado prendia-a: voltar à página retomava sempre
            o mesmo pedido já pronto, e não havia forma de começar outro. */}
        <button
          type="button"
          className="cartoes-accao-secundaria"
          onClick={() => {
            guardarPedido(projectSlug, null)
            definirPedido(null)
            definirActiva(null)
            definirQuantidade(1)
            definirPasso(categorias && categorias.length > 1 ? 'categoria' : 'quantidade')
          }}
        >
          Fazer outro pedido
        </button>
      </section>
    </div>
  )
}

/**
 * Os modelos como se veem: a arte, e não o nome dela.
 *
 * Isto eram sete botões de texto — "Dia 1", "Dia 2" — numa página onde o
 * cliente tinha acabado de carregar sete artes. Quem escolhe um cartão escolhe
 * pelo desenho, e um nome escrito não deixa escolher nada.
 *
 * A fila rola de lado: sete miniaturas não cabem num telemóvel, e espremê-las
 * até caberem tirava-lhes justamente o que se vem cá ver.
 *
 * Sem `aoEscolher` é montra e não escolha — é assim que aparece a quem ainda
 * nem sabe o que está a comprar, no primeiro ecrã.
 */
function GaleriaDeModelos({
  modelos,
  activo,
  aoEscolher,
}: {
  modelos: ModeloDeCartao[]
  activo?: number
  aoEscolher?: (i: number) => void
}) {
  if (modelos.length === 0) return null
  const escolhe = Boolean(aoEscolher)
  return (
    <>
      <ul className="cartoes-modelos">
        {modelos.map((m, i) => {
          const dentro = (
            <>
              {/* SEM SELO DO DIA POR CIMA DA ARTE.
                  A arte dele já traz um — "DIA 1", no canto de cima à esquerda —
                  e o meu caía exactamente em cima dele, a tapar metade do
                  título. O dia diz-se na legenda, que é onde sobra espaço. */}
              <span className="cartoes-modelo-arte">
                {m.arteUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.arteUrl} alt={escolhe ? '' : m.nome} loading="lazy" />
                ) : (
                  <span className="cartoes-modelo-sem-arte" aria-hidden="true" />
                )}
              </span>
              <span className="cartoes-modelo-nome">
                <span className="cartoes-modelo-dia">Dia {m.dia}</span>
                {m.nome}
              </span>
            </>
          )
          return (
            <li key={m.id}>
              {escolhe ? (
                <button
                  type="button"
                  className={i === activo ? 'cartoes-modelo activo' : 'cartoes-modelo'}
                  onClick={() => aoEscolher?.(i)}
                  aria-pressed={i === activo}
                >
                  {dentro}
                </button>
              ) : (
                <div className="cartoes-modelo">{dentro}</div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="cartoes-ajuda cartoes-rolar">
        Arraste para os lados para ver todos os modelos →
      </p>
    </>
  )
}

/**
 * ESTA PÁGINA NÃO TINHA SAÍDA.
 *
 * Todos os outros ecrãs abrem com a pastilha de voltar; este abria com o
 * título e mais nada, e de dentro dele só se saía pelo botão do navegador ou
 * pela barra de baixo. Numa página de compra, não ter porta é o género de
 * pormenor que faz desistir sem que ninguém saiba porquê.
 */
/**
 * O cabeçalho, e o que dele sobra no ecrã do cartão.
 *
 * "Quando o usuário abrir a personalização, o cartão já aparece grande" —
 * 25/09. O título e o subtítulo comiam 450 dos 900 pixels de um telemóvel, e o
 * cartão começava a meio do ecrã. Num ecrã cujo assunto é um cartão à frente
 * dos olhos, explicar por escrito o que ele é custa metade do ecrã e não diz
 * nada que a imagem não diga melhor.
 *
 * `enxuto` deixa só o Voltar. Os outros passos — pagamento, ficheiros —
 * continuam com o título, porque aí não há nenhuma imagem a explicar-se sozinha.
 */
function Cabecalho({ projectSlug, enxuto }: { projectSlug: string; enxuto?: boolean }) {
  return (
    <>
      <div className="cabecalho">
        <Voltar href={`/${projectSlug}`}>Voltar</Voltar>
      </div>
      {!enxuto && (
        <header className="cartoes-cabecalho">
          <h1>Crie seu cartão personalizado</h1>
          <p>
            Personalize com o nome e a foto e receba seus cartões prontos para
            imprimir.
          </p>
        </header>
      )}
    </>
  )
}

function Resumo({ pedido }: { pedido: Pedido }) {
  const dinheiro = (cent: number) =>
    (cent / 100).toLocaleString('pt-BR', { style: 'currency', currency: pedido.moeda })

  return (
    <dl className="cartoes-resumo">
      <div>
        <dt>Conjuntos</dt>
        <dd>{pedido.preco.quantidade}</dd>
      </div>
      <div>
        <dt>Subtotal</dt>
        <dd>{dinheiro(pedido.preco.subtotalCent)}</dd>
      </div>
      {pedido.preco.descontoCent > 0 && (
        <div className="cartoes-resumo-desconto">
          <dt>Desconto ({pedido.preco.percentagemAplicada}%)</dt>
          <dd>−{dinheiro(pedido.preco.descontoCent)}</dd>
        </div>
      )}
      <div className="cartoes-resumo-total">
        <dt>Total</dt>
        <dd>{dinheiro(pedido.preco.totalCent)}</dd>
      </div>
    </dl>
  )
}

/**
 * A caixa de uma criança no passo das fotos.
 *
 * VERDE, AMARELO OU VERMELHO, como ele desenhou. O amarelo não estava no
 * pedido dele e acrescentei-o: a fotografia que vem pelo WhatsApp cai muitas
 * vezes entre os 200 e os 300 dpi, e as duas respostas possíveis eram más —
 * recusá-la faz a mãe desistir com uma foto que ainda dá uma folha aceitável,
 * aceitá-la calado faz a gráfica devolver um cartão borrado. A terceira faixa
 * diz-lhe a verdade e deixa-a decidir.
 */
function CaixaDaCrianca({
  crianca,
  rotuloUm,
  projectSlug,
  pedidoId,
  modelos,
  ocupado,
  aoMudar,
  aoOcupar,
  aoErrar,
}: {
  crianca: CriancaDoPedido
  rotuloUm: string
  projectSlug: string
  pedidoId: string
  modelos: ModeloDeCartao[]
  ocupado: string | null
  aoMudar: (p: Pedido) => void
  aoOcupar: (v: string | null) => void
  aoErrar: (v: string | null) => void
}) {
  const [veredicto, definirVeredicto] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement | null>(null)

  const estado = crianca.aprovada
    ? crianca.nivel === 'ACEITAVEL'
      ? 'aceitavel'
      : 'boa'
    : crianca.temFoto
      ? 'boa'
      : 'vazia'

  async function enviar(ficheiro: File) {
    aoErrar(null)
    aoOcupar(`foto-${crianca.id}`)
    try {
      const resposta = await cartoes.enviarFoto(projectSlug, pedidoId, crianca.id, ficheiro)
      definirVeredicto(resposta.mensagem)
      aoMudar(await cartoes.verPedido(projectSlug, pedidoId))
    } catch (e) {
      aoErrar(e instanceof ErroDeApi ? e.message : 'Não foi possível enviar a foto.')
    } finally {
      aoOcupar(null)
    }
  }

  const minimo = modelos[0]
    ? Math.ceil((modelos[0].moldura.largura / 25.4) * 300)
    : null

  return (
    <li className={`cartoes-crianca cartoes-crianca-${estado}`}>
      <span className="cartoes-crianca-titulo">
        {maiuscula(rotuloUm)} {crianca.ordem}
      </span>

      {crianca.temFoto ? (
        <img
          src={cartoes.urlDaFoto(projectSlug, pedidoId, crianca.id)}
          alt=""
          className="cartoes-miniatura-foto"
        />
      ) : (
        <span className="cartoes-sem-foto" aria-hidden="true">
          ＋
        </span>
      )}

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="apenas-leitor-de-ecra"
        onChange={(ev) => {
          const f = ev.target.files?.[0]
          if (f) void enviar(f)
          ev.target.value = ''
        }}
      />

      <button
        type="button"
        className="cartoes-accao-secundaria"
        disabled={ocupado !== null}
        onClick={() => entrada.current?.click()}
      >
        {ocupado === `foto-${crianca.id}`
          ? 'A analisar…'
          : crianca.temFoto
            ? 'Trocar foto'
            : 'Enviar foto'}
      </button>

      {crianca.temFoto && (
        <button
          type="button"
          className="cartoes-ligacao"
          disabled={ocupado !== null}
          onClick={async () => {
            aoOcupar(`apagar-${crianca.id}`)
            try {
              aoMudar(await cartoes.removerFoto(projectSlug, pedidoId, crianca.id))
              definirVeredicto(null)
            } finally {
              aoOcupar(null)
            }
          }}
        >
          Apagar esta foto
        </button>
      )}

      {crianca.aprovada && (
        <p className="cartoes-veredicto cartoes-veredicto-boa">
          ✓ Foto aprovada — {crianca.dpi} dpi na impressão A4.
        </p>
      )}
      {!crianca.aprovada && veredicto && (
        <p className="cartoes-veredicto cartoes-veredicto-ma">
          ✕ {veredicto}
          {minimo && (
            <span className="cartoes-ajuda">
              A foto precisa de pelo menos {minimo} pixels no lado menor.
            </span>
          )}
        </p>
      )}
    </li>
  )
}
