'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ajusteNeutro } from '@pv/cartoes'
import { cartoes, type Categoria, type ModeloDeCartao, type Pedido } from '@/lib/cartoes'
import { ErroDeApi } from '@/lib/auth'
import { abrirFoto, descartar, FotoRecusada, type FotoNoAparelho } from '@/lib/foto-no-aparelho'
import { gerarPdfNoAparelho, type Personalizacao } from '@/lib/pdf-no-aparelho'
import { useAuth } from './ProvedorDeAuth'
import { EntregaDosCartoes } from './EntregaDosCartoes'
import { CartaoComoEditor } from './CartaoComoEditor'
import { AvisoDaFoto, CaixaDoResponsavel, ConfirmarPersonalizacao } from './ConfirmarPersonalizacao'
import { Voltar } from './Voltar'

/**
 * O editor dos cartões personalizados.
 *
 * O PERCURSO, DESDE 03/10: escolher a foto e escrever o nome no próprio cartão
 * → pagar → GERAR O PDF NESTE APARELHO → baixar ou enviar.
 *
 * O cliente pediu em seis pontos, e o que muda tudo é este:
 *
 *   "Zero armazenamento: nada de foto guardada no servidor nem no navegador
 *    (sem upload, IndexedDB, localStorage ou cache). A foto fica só na memória
 *    e é descartada após gerar o PDF. O servidor guarda só pagamento e código
 *    de liberação."
 *
 * Por isso aqui:
 *   - a foto é uma `FotoNoAparelho`, aberta em memória e nunca enviada;
 *   - o nome e o enquadramento vivem no estado deste ecrã, e não no servidor;
 *   - o servidor conhece o pedido, o preço e o pagamento, e devolve o código
 *     de liberação quando o pagamento entra;
 *   - com o código, o aparelho busca as artes de impressão, monta o PDF
 *     (`gerarPdfNoAparelho`), descarta a foto, e entrega o ficheiro.
 *
 * O ÚNICO DADO GUARDADO NO APARELHO é o número do pedido (ver
 * `CHAVE_DO_PEDIDO`): sem ele, quem paga por Pix e vai ao banco perdia o
 * caminho de volta ao pedido pago. Não é a foto, nem o nome.
 *
 * SE A PÁGINA FOR RECARREGADA — o cartão de crédito, que paga na página do
 * Mercado Pago e volta; um telemóvel que fechou o separador — a foto já não
 * existe, porque nunca foi guardada. O pedido pago continua, e o ecrã pede a
 * foto e o nome outra vez para gerar. É o preço de não guardar nada, e é o
 * que ele pediu.
 */

type Passo = 'categoria' | 'editor' | 'pagamento' | 'gerar' | 'pronto'

/**
 * Onde fica guardado o pedido em curso, por projeto.
 *
 * Guarda-se só o identificador. O pagamento por Pix confirma-se por fora, e a
 * mãe vai sair da página para pagar no banco: sem isto, voltar era perder o
 * pedido pago.
 */
const CHAVE_DO_PEDIDO = 'santtify:cartoes:pedido'

function pedidoGuardado(projeto: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(`${CHAVE_DO_PEDIDO}:${projeto}`)
  } catch {
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
    /* Navegação privada: sem pedido guardado, que é mau mas não é uma página partida. */
  }
}

/** Só o bastante para apanhar gralhas; quem decide se o e-mail serve é o servidor. */
function emailValido(texto: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto.trim())
}

const pago = (p: Pedido | null) => p?.estado === 'PAGO' || p?.estado === 'PRONTO'

const PERSONALIZACAO_INICIAL: Personalizacao = {
  nome: '',
  ajuste: ajusteNeutro(),
  tamanhoDoNome: 0.6,
  nomeAlinhamento: 'CENTRO',
  nomeCorHex: null,
}

/** "Guilherme Souza" → "cartoes-guilherme-souza.pdf". */
function nomeDoArquivo(nome: string): string {
  const base = nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `cartoes-${base || 'personalizados'}.pdf`
}

export function EditorDeCartoes({
  projectSlug,
  categoriaInicial = null,
  pedidoInicial = null,
  codigoInicial = null,
}: {
  projectSlug: string
  /** A categoria por que a pessoa entrou, vinda do cartaz da oferta. */
  categoriaInicial?: string | null
  /** `?pedido=`: a volta do Mercado Pago, ou a ligação do e-mail. */
  pedidoInicial?: string | null
  /** `?codigo=`: o código de liberação, vindo da ligação do e-mail. */
  codigoInicial?: string | null
}) {
  const [modelos, definirModelos] = useState<ModeloDeCartao[]>([])
  const [pedido, definirPedido] = useState<Pedido | null>(null)
  const [passo, definirPasso] = useState<Passo>('categoria')
  /** Em qual dos sete cartões ela está — fora do editor, para sobreviver ao pagamento. */
  const [cartaoActivo, definirCartaoActivo] = useState(0)
  const [aConfirmar, definirAConfirmar] = useState<'PIX' | 'CARTAO' | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const { usuario } = useAuth()
  const [email, definirEmail] = useState('')
  const [pixCopiado, definirPixCopiado] = useState(false)
  const [codigoCopiado, definirCodigoCopiado] = useState(false)
  const [categorias, definirCategorias] = useState<Categoria[] | null>(null)
  const [categoria, definirCategoria] = useState<string | null>(null)
  /** A lista não chegou — que é diferente de chegar vazia. */
  const [categoriasFalharam, definirCategoriasFalharam] = useState(false)
  const [tentativaDeCategorias, definirTentativaDeCategorias] = useState(0)

  /** A foto em memória. Nunca vai ao servidor, nunca é guardada. */
  const [foto, definirFoto] = useState<FotoNoAparelho | null>(null)
  const [aAbrirFoto, definirAAbrirFoto] = useState(false)
  const [personalizacao, definirPersonalizacao] = useState<Personalizacao>(PERSONALIZACAO_INICIAL)
  /** A caixa do responsável, marcada nesta visita (antes de pagar, ou ao gerar). */
  const [consentiu, definirConsentiu] = useState(false)
  const [progresso, definirProgresso] = useState<{ feitos: number; total: number } | null>(null)
  /** O PDF gerado, em memória até a página fechar. */
  const [pdf, definirPdf] = useState<{ blob: Blob; nome: string } | null>(null)
  /** O código que veio na ligação, para quem abre noutro aparelho. */
  const [codigoDaLigacao] = useState(codigoInicial)

  const codigo = pedido?.codigoDeLiberacao ?? codigoDaLigacao ?? null

  // A foto sai da memória quando o editor sai de cena, e não só depois de gerar.
  const fotoAgora = useRef<FotoNoAparelho | null>(null)
  fotoAgora.current = foto
  useEffect(() => () => descartar(fotoAgora.current), [])

  /**
   * As categorias: Crianças, Adultos, e as que o cliente criar no painel.
   *
   * Com UMA só, o ecrã de escolha nem aparece — a mãe que chega para os
   * cartões das crianças não tem de responder a uma pergunta que não existe.
   */
  useEffect(() => {
    let vivo = true
    definirCategoriasFalharam(false)
    cartoes
      .categorias(projectSlug)
      .then((lista) => {
        if (!vivo) return
        definirCategorias(lista)
        const escolhida =
          lista.length === 1
            ? lista[0]
            : (categoriaInicial && lista.find((c) => c.slug === categoriaInicial)) || null
        if (escolhida) definirCategoria((actual) => actual ?? escolhida.slug)
      })
      .catch(() => {
        if (vivo) definirCategoriasFalharam(true)
      })
    return () => {
      vivo = false
    }
  }, [projectSlug, categoriaInicial, tentativaDeCategorias])

  useEffect(() => {
    if (!categoriasFalharam) return
    const tentar = () => definirTentativaDeCategorias((n) => n + 1)
    window.addEventListener('online', tentar)
    return () => window.removeEventListener('online', tentar)
  }, [categoriasFalharam])

  /** Os cartões DA categoria escolhida — os dos adultos não entram no editor das crianças. */
  useEffect(() => {
    if (!categoria) return
    cartoes
      .modelos(projectSlug, categoria)
      .then(definirModelos)
      .catch(() => definirModelos([]))
  }, [projectSlug, categoria])

  /** O passo certo para um pedido que se retoma. */
  const passoDoPedido = useCallback((p: Pedido): Passo => {
    if (pago(p)) return 'gerar'
    if (p.estado === 'AGUARDANDO_PAGAMENTO') return 'pagamento'
    return 'editor'
  }, [])

  /**
   * Retomar o pedido de quem já cá esteve — pela ligação (`?pedido=`) ou pelo
   * número guardado neste aparelho.
   */
  // Começa "a retomar" até se saber se há pedido para retomar: o número
  // guardado só se lê no navegador, e lê-lo no primeiro desenho dava um ecrã
  // diferente do que veio do servidor.
  const [retomando, definirRetomando] = useState(true)
  useEffect(() => {
    const id = pedidoInicial ?? pedidoGuardado(projectSlug)
    if (!id) {
      definirRetomando(false)
      return
    }
    let vivo = true
    cartoes
      .verPedido(projectSlug, id)
      .then((p) => {
        if (!vivo) return
        if (p.estado === 'EXPIRADO') {
          guardarPedido(projectSlug, null)
          if (pedidoInicial) definirErro('O prazo deste pedido terminou. Faça um novo pedido.')
        } else {
          guardarPedido(projectSlug, p.id)
          definirPedido(p)
          definirCategoria(p.categoria?.slug ?? null)
          definirPasso(passoDoPedido(p))
        }
        definirRetomando(false)
      })
      .catch(() => {
        if (!vivo) return
        guardarPedido(projectSlug, null)
        definirRetomando(false)
      })
    return () => {
      vivo = false
    }
  }, [projectSlug, pedidoInicial, passoDoPedido])

  /**
   * ESCOLHIDA A CATEGORIA, O CARTÃO ABRE. Não há nada a perguntar antes.
   *
   * Uma criança por pedido, porque é o que o cartaz vende: "7 cartões
   * personalizados A4 com a foto + nome da criança". Quem quiser um segundo
   * conjunto faz outro pedido no fim. O pedido nasce sem nada da criança: é só
   * o lugar a pagar.
   */
  const aCriar = useRef(false)
  useEffect(() => {
    if (pedido || !categoria || aCriar.current || retomando) return
    aCriar.current = true
    cartoes
      .criarPedido(projectSlug, 1, categoria)
      .then((novo) => {
        definirPedido(novo)
        guardarPedido(projectSlug, novo.id)
        definirPasso('editor')
      })
      .catch((e) => {
        aCriar.current = false
        definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível começar o pedido.')
      })
  }, [projectSlug, categoria, pedido, retomando])

  const comErro = useCallback(async (chave: string, accao: () => Promise<void>) => {
    definirErro(null)
    definirOcupado(chave)
    try {
      await accao()
    } catch (e) {
      definirErro(
        e instanceof ErroDeApi || e instanceof FotoRecusada || e instanceof Error
          ? e.message
          : 'Não foi possível concluir. Tente de novo.',
      )
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

    Com o Pix, ela paga no aplicativo do banco e volta para aqui. O ecrã
    pergunta de 5 em 5 segundos enquanto está à espera, só com o separador à
    vista, e pára ao fim de 20 minutos.
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

  // Pago enquanto esperava no ecrã do pagamento: segue para gerar.
  useEffect(() => {
    if (pago(pedido) && passo === 'pagamento') definirPasso('gerar')
  }, [pedido, passo])

  /** Abre a foto escolhida, em memória, e troca a anterior (que é largada). */
  const escolherFoto = useCallback(
    (ficheiro: File) => {
      definirErro(null)
      definirAAbrirFoto(true)
      abrirFoto(ficheiro, modelos)
        .then((nova) => {
          definirFoto((antiga) => {
            descartar(antiga)
            return nova
          })
          // Uma foto nova começa centrada: o enquadramento da outra não lhe serve.
          definirPersonalizacao((p) => ({ ...p, ajuste: ajusteNeutro() }))
        })
        .catch((e) => definirErro(e instanceof FotoRecusada ? e.message : 'Não foi possível abrir esta foto.'))
        .finally(() => definirAAbrirFoto(false))
    },
    [modelos],
  )

  const mudar = useCallback((m: Partial<Personalizacao>) => definirPersonalizacao((p) => ({ ...p, ...m })), [])

  /**
   * GERAR, NESTE APARELHO.
   *
   * 1. O código de liberação pede ao servidor as artes de impressão (só existe
   *    depois de pago). Vai o código; não vai a foto, nem o nome.
   * 2. O PDF é montado aqui (`gerarPdfNoAparelho`).
   * 3. A foto é descartada: "descartada após gerar o PDF".
   * 4. O servidor fica a saber que o PDF foi gerado — para o painel dizer
   *    "concluído" —, e é tudo o que fica a saber.
   */
  const gerar = () =>
    comErro('gerar', async () => {
      if (!pedido || !foto || !codigo) return
      const { artes } = await cartoes.liberacao(projectSlug, pedido.id, codigo)
      definirProgresso({ feitos: 0, total: modelos.length })
      const blob = await gerarPdfNoAparelho({
        modelos,
        artes,
        foto,
        personalizacao,
        aoAvancar: (feitos, total) => definirProgresso({ feitos, total }),
      })
      definirPdf({ blob, nome: nomeDoArquivo(personalizacao.nome) })
      descartar(foto)
      definirFoto(null)
      definirPasso('pronto')
      void cartoes
        .marcarGerado(projectSlug, pedido.id, codigo)
        .then(() => cartoes.verPedido(projectSlug, pedido.id))
        .then(definirPedido)
        .catch(() => {})
    }).finally(() => definirProgresso(null))

  const recomecar = () => {
    descartar(foto)
    definirFoto(null)
    definirPdf(null)
    definirPersonalizacao(PERSONALIZACAO_INICIAL)
    definirConsentiu(false)
    guardarPedido(projectSlug, null)
    definirPedido(null)
    aCriar.current = false
    definirCartaoActivo(0)
    definirPasso(categorias && categorias.length > 1 ? 'categoria' : 'editor')
    if (categorias && categorias.length > 1) definirCategoria(null)
  }

  const dinheiro = (cent: number, moeda = 'BRL') =>
    (cent / 100).toLocaleString('pt-BR', { style: 'currency', currency: moeda })

  // ── Passo 0: para quem são os cartões ───────────────────────────

  if (passo === 'categoria' && (!categoria || retomando)) {
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} />
        <section className="cartoes-passo">
          {categoriasFalharam && categorias === null ? (
            <>
              <p className="cartoes-ajuda">
                Não foi possível carregar os cartões agora. Verifique a internet e tente de novo.
              </p>
              <button
                type="button"
                className="cartoes-accao"
                onClick={() => definirTentativaDeCategorias((n) => n + 1)}
              >
                Tentar de novo
              </button>
            </>
          ) : categorias === null || retomando ? (
            <p className="cartoes-ajuda">Carregando…</p>
          ) : categorias.length === 0 ? (
            <p className="cartoes-ajuda">Os cartões ainda estão sendo preparados. Volte em breve.</p>
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
                        definirPasso('editor')
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
                        {dinheiro(c.preco.precoUnitarioCent, c.preco.moeda)} por conjunto
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {erro && <p className="cartoes-erro">{erro}</p>}
        </section>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} />
        <section className="cartoes-passo">
          {erro ? <p className="cartoes-erro">{erro}</p> : <p className="cartoes-ajuda">Preparando o seu cartão…</p>}
        </section>
      </div>
    )
  }

  // ── O cartão: foto e nome ────────────────────────────────────────

  if (passo === 'editor') {
    const jaPago = pago(pedido)
    return (
      <div className="editor-cartoes editor-cartoes-uma-tela">
        <Cabecalho
          projectSlug={projectSlug}
          enxuto
          aoVoltar={jaPago ? () => definirPasso('gerar') : undefined}
        />
        {erro && <p className="cartoes-erro">{erro}</p>}
        <CartaoComoEditor
          foto={foto}
          personalizacao={personalizacao}
          aoMudar={mudar}
          aoEscolherFoto={escolherFoto}
          aoRemoverFoto={() => {
            descartar(foto)
            definirFoto(null)
          }}
          aAbrirFoto={aAbrirFoto}
          modelos={modelos}
          indice={cartaoActivo}
          aoMudarIndice={definirCartaoActivo}
          aSalvar={false}
          aoErrar={definirErro}
          rotuloDeSalvar={jaPago ? 'Continuar para gerar o PDF' : 'Continuar'}
          // "Editou finalizou ai vem o pagamento" — 24/09. Já pago, vai gerar.
          aoSalvar={() => {
            definirErro(null)
            definirPasso(jaPago ? 'gerar' : 'pagamento')
          }}
        />
      </div>
    )
  }

  // ── O pagamento ──────────────────────────────────────────────────

  if (passo === 'pagamento') {
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} aoVoltar={() => definirPasso('editor')} />
        <section className="cartoes-passo">
          <h2>Pagamento</h2>
          <Resumo pedido={pedido} />

          {/*
            QUEM PROCESSA O PAGAMENTO, DITO PELO NOME — "Deixa bem claro que
            estamos usado mercado pago para mostrar credibilidade" (24/09).
          */}
          <p className="cartoes-processador">
            <span aria-hidden="true">🔒</span>
            <span>
              Pagamento processado pelo <strong>Mercado&nbsp;Pago</strong>. O número do cartão é digitado
              na página deles — nós nunca o vemos nem o guardamos.
            </span>
          </p>

          {!pedido.meio && (
            <div className="cartoes-meios">
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
                onClick={() => definirAConfirmar('PIX')}
              >
                Pagar com Pix
              </button>
              <button
                type="button"
                className="cartoes-accao-secundaria"
                disabled={ocupado !== null || !emailValido(email)}
                onClick={() => definirAConfirmar('CARTAO')}
              >
                Pagar com cartão
              </button>
              {/*
                O CARTÃO SAI DESTA PÁGINA, e a foto não vai junto.

                O Mercado Pago cobra o cartão na página dele e devolve a pessoa
                aqui. A foto vivia na memória desta página — que é recarregada —
                por isso, na volta, pede-se a foto outra vez. Dizê-lo antes evita
                o susto.
              */}
              <p className="cartoes-ajuda">
                No cartão, o pagamento abre na página do Mercado Pago. Ao voltar, você escolhe a foto de
                novo para gerar os cartões (ela não fica guardada em lugar nenhum). No Pix, você continua
                nesta tela.
              </p>
            </div>
          )}

          {aConfirmar && (
            <ConfirmarPersonalizacao
              aPagar={ocupado !== null}
              aoFechar={() => definirAConfirmar(null)}
              aoRevisar={() => {
                definirAConfirmar(null)
                definirPasso('editor')
              }}
              aoConfirmar={() => {
                const meio = aConfirmar
                definirConsentiu(true)
                void comErro(meio === 'PIX' ? 'pix' : 'cartao', async () => {
                  const resposta = await cartoes.pagar(projectSlug, pedido.id, meio, email.trim(), true, true)
                  definirPedido(resposta)
                  if (meio === 'CARTAO' && resposta.urlDeRedireccionamento) {
                    window.location.assign(resposta.urlDeRedireccionamento)
                  }
                }).then(() => definirAConfirmar(null))
              }}
            />
          )}

          {pedido.pixQrSvg && (
            <div className="cartoes-pix">
              <div
                className="cartoes-pix-qr"
                // O SVG vem do nosso próprio servidor, gerado pela biblioteca de
                // QR a partir de um texto que nós escrevemos.
                dangerouslySetInnerHTML={{ __html: pedido.pixQrSvg }}
              />
              {/* O "copia e cola" é o que se usa no telemóvel: ninguém aponta a
                  câmara ao próprio ecrã. */}
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
                    Abra o aplicativo do seu banco, escolha Pix copia e cola e cole o código. Depois volte para
                    esta tela: os cartões são gerados aqui, assim que o pagamento for confirmado.
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
            </div>
          )}

          {pedido.meio && <p className="cartoes-estado-espera">Aguardando confirmação do pagamento…</p>}
          {erro && <p className="cartoes-erro">{erro}</p>}

          {pedido.meio && (
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
          )}
        </section>
      </div>
    )
  }

  // ── Gerar o PDF, neste aparelho ──────────────────────────────────

  if (passo === 'gerar' || (passo === 'pronto' && !pdf)) {
    const prazo = new Date(pedido.expiraEm).toLocaleDateString('pt-BR')
    const prontoParaGerar = Boolean(foto && personalizacao.nome.trim())
    return (
      <div className="editor-cartoes">
        <Cabecalho projectSlug={projectSlug} />
        <section className="cartoes-passo">
          <p className="cartoes-estado-pago">✓ Pagamento confirmado.</p>

          {codigo && (
            <div className="cartoes-codigo">
              <span>Seu código de liberação</span>
              <strong>{codigo}</strong>
              <button
                type="button"
                className="cartoes-ligacao"
                onClick={() =>
                  void navigator.clipboard?.writeText(codigo).then(() => {
                    definirCodigoCopiado(true)
                    window.setTimeout(() => definirCodigoCopiado(false), 3000)
                  })
                }
              >
                {codigoCopiado ? '✓ Copiado' : 'Copiar'}
              </button>
              <small>
                Com ele você gera os cartões até {prazo}, neste ou em outro aparelho. Ele também foi enviado
                para o seu e-mail.
              </small>
            </div>
          )}

          {!prontoParaGerar ? (
            <>
              <h2>Escolha a foto para gerar os cartões</h2>
              <p className="cartoes-ajuda">
                A foto não fica guardada em lugar nenhum — nem no nosso servidor, nem no seu aparelho —, por
                isso ela precisa ser escolhida nesta tela para o PDF ser gerado.
              </p>
              <button type="button" className="cartoes-accao" onClick={() => definirPasso('editor')}>
                {foto ? 'Escrever o nome' : 'Escolher a foto'}
              </button>
            </>
          ) : (
            <>
              <h2>Gerar os cartões em PDF</h2>
              <p className="cartoes-ajuda">
                O PDF é montado aqui, no seu aparelho: a foto não sai dele. São {modelos.length} cartões A4,
                prontos para imprimir.
              </p>
              {!consentiu && <CaixaDoResponsavel marcada={consentiu} aoMudar={definirConsentiu} />}
              <AvisoDaFoto />
              <button
                type="button"
                className="cartoes-accao"
                disabled={!consentiu || ocupado !== null || !codigo}
                onClick={() => void gerar()}
              >
                {progresso
                  ? progresso.feitos < progresso.total
                    ? `Montando o cartão ${progresso.feitos + 1} de ${progresso.total}…`
                    : 'Finalizando o PDF…'
                  : ocupado === 'gerar'
                    ? 'Preparando…'
                    : 'Gerar meus cartões'}
              </button>
              <button type="button" className="cartoes-ligacao" onClick={() => definirPasso('editor')}>
                Rever a foto e o nome
              </button>
            </>
          )}
          {erro && <p className="cartoes-erro">{erro}</p>}
        </section>
      </div>
    )
  }

  // ── Pronto: o PDF neste aparelho ─────────────────────────────────

  return (
    <div className="editor-cartoes">
      <Cabecalho projectSlug={projectSlug} />
      <section className="cartoes-passo">
        <h2>Seus cartões estão prontos</h2>
        {pdf && (
          <EntregaDosCartoes
            pdf={pdf.blob}
            nomeDoArquivo={pdf.nome}
            codigo={codigo}
            expiraEm={pedido.expiraEm}
          />
        )}
        <button type="button" className="cartoes-accao-secundaria" onClick={recomecar}>
          Fazer outro pedido
        </button>
      </section>
    </div>
  )
}

/**
 * O cabeçalho, e o que dele sobra no ecrã do cartão.
 *
 * "Quando o usuário abrir a personalização, o cartão já aparece grande" —
 * 25/09. `enxuto` deixa só o Voltar; os outros passos continuam com o título.
 */
function Cabecalho({
  projectSlug,
  enxuto,
  aoVoltar,
}: {
  projectSlug: string
  enxuto?: boolean
  /**
   * O passo anterior DENTRO do editor, quando existe um — "O botão Voltar deve
   * respeitar a etapa imediatamente anterior do fluxo" (25/09).
   */
  aoVoltar?: () => void
}) {
  return (
    <>
      <div className="cabecalho">
        {aoVoltar ? <Voltar aoClicar={aoVoltar}>Voltar</Voltar> : <Voltar href={`/${projectSlug}`}>Voltar</Voltar>}
      </div>
      {!enxuto && (
        <header className="cartoes-cabecalho">
          <h1>Crie seu cartão personalizado</h1>
          <p>Personalize com o nome e a foto e receba seus cartões prontos para imprimir.</p>
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
        <dd>
          {/* O riscado ao lado do total: lê-se pelo que é, o que custava antes. */}
          {pedido.preco.deTabelaCent && (
            <s className="cartoes-preco-antigo">{dinheiro(pedido.preco.deTabelaCent)}</s>
          )}
          {dinheiro(pedido.preco.totalCent)}
        </dd>
      </div>
    </dl>
  )
}
