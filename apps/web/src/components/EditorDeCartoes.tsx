'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  A4_MM,
  ajusteNeutro,
  avaliarFoto,
  corpoDoNome,
  enquadrar,
  type Ajuste,
} from '@pv/cartoes'
import {
  cartoes,
  type CriancaDoPedido,
  type ModeloDeCartao,
  type Pedido,
} from '@/lib/cartoes'
import { ErroDeApi } from '@/lib/auth'
import { EntregaDosCartoes } from './EntregaDosCartoes'

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

type Passo = 'quantidade' | 'fotos' | 'selecao' | 'pagamento' | 'editor' | 'pronto'

/** Quanto tempo se espera antes de mandar um ajuste ao servidor. */
const ESPERA_ANTES_DE_GRAVAR = 400

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

export function EditorDeCartoes({ projectSlug }: { projectSlug: string }) {
  const [modelos, definirModelos] = useState<ModeloDeCartao[]>([])
  const [pedido, definirPedido] = useState<Pedido | null>(null)
  const [passo, definirPasso] = useState<Passo>('quantidade')
  const [quantidade, definirQuantidade] = useState(1)
  const [activa, definirActiva] = useState<string | null>(null)
  const [modeloActivo, definirModeloActivo] = useState(0)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [ampliado, definirAmpliado] = useState(false)

  useEffect(() => {
    cartoes.modelos(projectSlug).then(definirModelos).catch(() => definirModelos([]))
  }, [projectSlug])

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
        const porConfirmar = p.criancas.find((c) => c.selecionada && !c.confirmada)
        if (p.estado === 'RASCUNHO') {
          definirPasso(p.criancas.some((c) => c.aprovada) ? 'selecao' : 'fotos')
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

  const crianca = useMemo(
    () => pedido?.criancas.find((c) => c.id === activa) ?? null,
    [pedido, activa],
  )

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

  // ── Passo 1: quantas crianças ────────────────────────────────────

  if (passo === 'quantidade') {
    return (
      <div className="editor-cartoes">
        <Cabecalho />
        <section className="cartoes-passo">
          <h2>Quantas crianças você quer cadastrar?</h2>
          <p className="cartoes-ajuda">
            Você envia uma foto para cada criança. Depois escolhe quais quer
            produzir — não precisa comprar todas.
          </p>
          <div className="cartoes-contador">
            <button
              type="button"
              onClick={() => definirQuantidade((q) => Math.max(1, q - 1))}
              aria-label="Menos uma criança"
            >
              −
            </button>
            <strong aria-live="polite">{quantidade}</strong>
            <button
              type="button"
              onClick={() => definirQuantidade((q) => Math.min(10, q + 1))}
              aria-label="Mais uma criança"
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
                const novo = await cartoes.criarPedido(projectSlug, quantidade)
                definirPedido(novo)
                guardarPedido(projectSlug, novo.id)
                definirPasso('fotos')
              })
            }
          >
            {ocupado === 'criar' ? 'A preparar…' : 'Continuar'}
          </button>
        </section>
      </div>
    )
  }

  if (!pedido) return <div className="editor-cartoes">A carregar…</div>

  // ── Passo 2: as fotos, uma por criança ───────────────────────────

  if (passo === 'fotos') {
    return (
      <div className="editor-cartoes">
        <Cabecalho />
        <section className="cartoes-passo">
          <h2>Envie a foto de cada criança</h2>
          <p className="cartoes-ajuda">
            Assim que a foto chega, verificamos se ela tem qualidade para
            impressão em A4. Uma foto recusada não impede as outras.
          </p>

          <ul className="cartoes-lista-de-criancas">
            {pedido.criancas.map((c) => (
              <CaixaDaCrianca
                key={c.id}
                crianca={c}
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
        <Cabecalho />
        <section className="cartoes-passo">
          <h2>Quais você quer produzir agora?</h2>
          <p className="cartoes-ajuda">
            Cada conjunto tem os {modelos.length || 7} cartões da criança.
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
                  <span>Criança {c.ordem}</span>
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
        <Cabecalho />
        <section className="cartoes-passo">
          <h2>Pagamento</h2>
          <Resumo pedido={pedido} />

          {!pedido.meio && (
            <div className="cartoes-meios">
              <button
                type="button"
                className="cartoes-accao"
                disabled={ocupado !== null}
                onClick={() =>
                  comErro('pix', async () => {
                    definirPedido(await cartoes.pagar(projectSlug, pedido.id, 'PIX'))
                  })
                }
              >
                Pagar com Pix
              </button>
              <button
                type="button"
                className="cartoes-accao-secundaria"
                disabled={ocupado !== null}
                onClick={() =>
                  comErro('cartao', async () => {
                    definirPedido(await cartoes.pagar(projectSlug, pedido.id, 'CARTAO'))
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
      <div className="editor-cartoes">
        <Cabecalho />
        <Editor
          projectSlug={projectSlug}
          pedido={pedido}
          crianca={crianca}
          modelos={modelos}
          modeloActivo={modeloActivo}
          ampliado={ampliado}
          erro={erro}
          ocupado={ocupado}
          aoMudarModelo={definirModeloActivo}
          aoAmpliar={definirAmpliado}
          aoMudarPedido={definirPedido}
          aoErrar={definirErro}
          aoOcupar={definirOcupado}
          aoTerminar={() => {
            const restantes = pedido.criancas.filter(
              (c) => c.selecionada && !c.confirmada && c.id !== crianca.id,
            )
            if (restantes.length > 0) {
              definirActiva(restantes[0].id)
              definirModeloActivo(0)
            } else {
              definirPasso('pronto')
            }
          }}
        />
      </div>
    )
  }

  // ── Passo 6: os ficheiros ────────────────────────────────────────

  return (
    <div className="editor-cartoes">
      <Cabecalho />
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
      </section>
    </div>
  )
}

function Cabecalho() {
  return (
    <header className="cartoes-cabecalho">
      <h1>Crie seu cartão personalizado</h1>
      <p>
        Escolha um modelo, personalize com o nome e a foto da criança e tenha seu
        cartão exclusivo.
      </p>
    </header>
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
  projectSlug,
  pedidoId,
  modelos,
  ocupado,
  aoMudar,
  aoOcupar,
  aoErrar,
}: {
  crianca: CriancaDoPedido
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
      <span className="cartoes-crianca-titulo">Criança {crianca.ordem}</span>

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

/**
 * O editor propriamente dito: um nome, um enquadramento, sete cartões.
 *
 * Cada mexida altera o estado local de imediato e só depois vai ao servidor,
 * com uma espera. Sem a espera, arrastar a fotografia mandaria um pedido por
 * cada pixel percorrido.
 */
function Editor({
  projectSlug,
  pedido,
  crianca,
  modelos,
  modeloActivo,
  ampliado,
  erro,
  ocupado,
  aoMudarModelo,
  aoAmpliar,
  aoMudarPedido,
  aoErrar,
  aoOcupar,
  aoTerminar,
}: {
  projectSlug: string
  pedido: Pedido
  crianca: CriancaDoPedido
  modelos: ModeloDeCartao[]
  modeloActivo: number
  ampliado: boolean
  erro: string | null
  ocupado: string | null
  aoMudarModelo: (i: number) => void
  aoAmpliar: (v: boolean) => void
  aoMudarPedido: (p: Pedido) => void
  aoErrar: (v: string | null) => void
  aoOcupar: (v: string | null) => void
  aoTerminar: () => void
}) {
  const [nome, definirNome] = useState(crianca.nome)
  const [ajuste, definirAjuste] = useState<Ajuste>(crianca.ajuste)
  const [tamanhoDoNome, definirTamanhoDoNome] = useState(crianca.tamanhoDoNome)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trocar de criança recarrega o estado local a partir dela.
  useEffect(() => {
    definirNome(crianca.nome)
    definirAjuste(crianca.ajuste)
    definirTamanhoDoNome(crianca.tamanhoDoNome)
  }, [crianca.id, crianca.nome, crianca.ajuste, crianca.tamanhoDoNome])

  const gravar = useCallback(
    (dados: Parameters<typeof cartoes.actualizar>[3]) => {
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(async () => {
        try {
          aoMudarPedido(await cartoes.actualizar(projectSlug, pedido.id, crianca.id, dados))
        } catch (e) {
          aoErrar(e instanceof ErroDeApi ? e.message : 'Não foi possível guardar.')
        }
      }, ESPERA_ANTES_DE_GRAVAR)
    },
    [projectSlug, pedido.id, crianca.id, aoMudarPedido, aoErrar],
  )

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  const modelo = modelos[modeloActivo]

  /**
   * O veredicto recalculado a cada ajuste, aqui no navegador.
   *
   * É a peneira fina que o cliente pediu: sobre o recorte, depois do zoom. A
   * conta é a mesma que o servidor corre — vem de `@pv/cartoes` — por isso o
   * que o ecrã diz agora é o que a folha vai ser.
   */
  const qualidade = useMemo(() => {
    if (!modelo || !crianca.fotoLargura || !crianca.fotoAltura) return null
    return avaliarFoto(
      { largura: modelo.moldura.largura, altura: modelo.moldura.altura },
      { largura: crianca.fotoLargura, altura: crianca.fotoAltura },
      ajuste,
    )
  }, [modelo, crianca.fotoLargura, crianca.fotoAltura, ajuste])

  function mexer(mudanca: Partial<Ajuste>) {
    const novo = { ...ajuste, ...mudanca }
    novo.escala = Math.min(6, Math.max(1, novo.escala))
    novo.deslocX = Math.min(1, Math.max(-1, novo.deslocX))
    novo.deslocY = Math.min(1, Math.max(-1, novo.deslocY))
    definirAjuste(novo)
    gravar(novo)
  }

  if (!modelo) return <p className="cartoes-ajuda">A carregar os modelos…</p>

  return (
    <>
      <section className="cartoes-passo">
        <h2>1. Escolha um modelo</h2>
        <ul className="cartoes-modelos">
          {modelos.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                className={i === modeloActivo ? 'cartoes-modelo activo' : 'cartoes-modelo'}
                onClick={() => aoMudarModelo(i)}
                aria-pressed={i === modeloActivo}
              >
                <span className="cartoes-modelo-dia">Dia {m.dia}</span>
                <span className="cartoes-modelo-nome">{m.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="cartoes-editor-grelha">
        <section className="cartoes-passo">
          <h2>2. Personalize</h2>

          <label className="cartoes-campo">
            <span>Nome da criança</span>
            <input
              type="text"
              value={nome}
              maxLength={40}
              onChange={(ev) => {
                definirNome(ev.target.value)
                gravar({ nome: ev.target.value })
              }}
            />
          </label>

          <label className="cartoes-campo">
            <span>Tamanho do nome</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={tamanhoDoNome}
              onChange={(ev) => {
                const v = Number(ev.target.value)
                definirTamanhoDoNome(v)
                gravar({ tamanhoDoNome: v })
              }}
            />
          </label>

          <div className="cartoes-campo">
            <span>Posição da foto</span>
            <div className="cartoes-setas">
              <button type="button" onClick={() => mexer({ deslocY: ajuste.deslocY - 0.04 })} aria-label="Subir">↑</button>
              <button type="button" onClick={() => mexer({ deslocX: ajuste.deslocX - 0.04 })} aria-label="Esquerda">←</button>
              <button type="button" onClick={() => definirAjusteNeutro()} aria-label="Centralizar">◎</button>
              <button type="button" onClick={() => mexer({ deslocX: ajuste.deslocX + 0.04 })} aria-label="Direita">→</button>
              <button type="button" onClick={() => mexer({ deslocY: ajuste.deslocY + 0.04 })} aria-label="Descer">↓</button>
            </div>
            <div className="cartoes-zoom">
              <button type="button" onClick={() => mexer({ escala: ajuste.escala - 0.1 })} aria-label="Diminuir zoom">−</button>
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={ajuste.escala}
                onChange={(ev) => mexer({ escala: Number(ev.target.value) })}
                aria-label="Zoom"
              />
              <button type="button" onClick={() => mexer({ escala: ajuste.escala + 0.1 })} aria-label="Aumentar zoom">＋</button>
            </div>
          </div>

          {qualidade && (
            <p
              className={
                qualidade.nivel === 'BOA'
                  ? 'cartoes-veredicto cartoes-veredicto-boa'
                  : qualidade.nivel === 'ACEITAVEL'
                    ? 'cartoes-veredicto cartoes-veredicto-media'
                    : 'cartoes-veredicto cartoes-veredicto-ma'
              }
            >
              {qualidade.nivel === 'BOA' && `✓ ${qualidade.dpi} dpi — ótimo para impressão A4.`}
              {qualidade.nivel === 'ACEITAVEL' &&
                `⚠ ${qualidade.dpi} dpi. Imprime, mas sem a nitidez ideal.`}
              {qualidade.nivel === 'INSUFICIENTE' &&
                `✕ ${qualidade.dpi} dpi. Diminua o zoom até ${qualidade.zoomMaximo}× ou envie outra foto.`}
            </p>
          )}
        </section>

        <section className="cartoes-passo">
          <h2>3. Editar cartão</h2>
          <PreVisualizacao
            projectSlug={projectSlug}
            pedidoId={pedido.id}
            crianca={crianca}
            modelo={modelo}
            ajuste={ajuste}
            nome={nome}
            tamanhoDoNome={tamanhoDoNome}
            aoArrastar={mexer}
            grande={ampliado}
          />
          <button type="button" className="cartoes-ligacao" onClick={() => aoAmpliar(!ampliado)}>
            {ampliado ? 'Reduzir' : 'Ver em tamanho grande'}
          </button>
        </section>
      </div>

      <section className="cartoes-passo">
        <h2>4. Seus cartões ({modelos.length})</h2>
        <p className="cartoes-ajuda">
          O nome e o enquadramento são os mesmos nos {modelos.length}. Mexer num
          mexe em todos.
        </p>
        <ul className="cartoes-miniaturas">
          {modelos.map((m, i) => (
            <li key={m.id}>
              <button type="button" onClick={() => aoMudarModelo(i)} className="cartoes-miniatura">
                <PreVisualizacao
                  projectSlug={projectSlug}
                  pedidoId={pedido.id}
                  crianca={crianca}
                  modelo={m}
                  ajuste={ajuste}
                  nome={nome}
                  tamanhoDoNome={tamanhoDoNome}
                  miniatura
                />
                <span>Dia {m.dia}</span>
              </button>
            </li>
          ))}
        </ul>

        {erro && <p className="cartoes-erro">{erro}</p>}

        <button
          type="button"
          className="cartoes-accao"
          disabled={!nome.trim() || ocupado !== null || qualidade?.nivel === 'INSUFICIENTE'}
          onClick={async () => {
            aoOcupar('confirmar')
            try {
              if (temporizador.current) clearTimeout(temporizador.current)
              aoMudarPedido(
                await cartoes.actualizar(projectSlug, pedido.id, crianca.id, {
                  nome,
                  ...ajuste,
                  tamanhoDoNome,
                  confirmada: true,
                }),
              )
              aoTerminar()
            } catch (e) {
              aoErrar(e instanceof ErroDeApi ? e.message : 'Não foi possível aprovar.')
            } finally {
              aoOcupar(null)
            }
          }}
        >
          {ocupado === 'confirmar' ? 'A guardar…' : 'Aprovar esta criança'}
        </button>
      </section>
    </>
  )

  function definirAjusteNeutro() {
    const neutro = ajusteNeutro()
    definirAjuste(neutro)
    gravar(neutro)
  }
}

/**
 * A prévia. É aqui que a promessa se cumpre ou se quebra.
 *
 * A moldura e a fotografia são posicionadas com `enquadrar` — a MESMA função
 * que o servidor chama para compor a folha a 300 dpi, importada do mesmo
 * ficheiro. A única diferença entre este desenho e o que sai na gráfica é a
 * régua: aqui a folha tem uns 300 pixéis de largura, lá tem 2480.
 *
 * As posições vão em `style` porque são números calculados a cada ajuste. Não
 * há forma de as pôr numa folha de estilos — e o resto do aspecto está todo em
 * classes, como no resto do projeto.
 */
/**
 * Mede o texto na fonte que o ecrã vai mesmo usar.
 *
 * Arial-Bold é metricamente compatível com a Helvetica-Bold do PDF, por isso
 * este número e o do `widthOfTextAtSize` do servidor são o mesmo. Medido a
 * corpo 100 e dividido, porque a corpo 1 o arredondamento do canvas estraga a
 * precisão.
 *
 * O canvas é criado uma vez e reaproveitado: criar um por cada letra que ela
 * escreve daria um objecto novo por tecla.
 */
let telaDeMedir: CanvasRenderingContext2D | null = null

function medirEmArialBold(texto: string): number {
  if (typeof document === 'undefined') return Math.max(1, texto.trim().length) * 0.62
  if (!telaDeMedir) {
    const tela = document.createElement('canvas')
    telaDeMedir = tela.getContext('2d')
    if (telaDeMedir) telaDeMedir.font = 'bold 100px Arial, Helvetica, sans-serif'
  }
  if (!telaDeMedir) return Math.max(1, texto.trim().length) * 0.62
  return telaDeMedir.measureText(texto).width / 100
}

function PreVisualizacao({
  projectSlug,
  pedidoId,
  crianca,
  modelo,
  ajuste,
  nome,
  tamanhoDoNome,
  aoArrastar,
  grande,
  miniatura,
}: {
  projectSlug: string
  pedidoId: string
  crianca: CriancaDoPedido
  modelo: ModeloDeCartao
  ajuste: Ajuste
  nome: string
  tamanhoDoNome: number
  aoArrastar?: (m: Partial<Ajuste>) => void
  grande?: boolean
  miniatura?: boolean
}) {
  const folha = useRef<HTMLDivElement | null>(null)
  const arrasto = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)
  const [largura, definirLargura] = useState(320)

  useEffect(() => {
    const elemento = folha.current
    if (!elemento) return
    const observador = new ResizeObserver(([entrada]) => {
      definirLargura(entrada.contentRect.width)
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  const altura = (largura * A4_MM.altura) / A4_MM.largura
  const emPx = (mm: number) => (mm / A4_MM.largura) * largura

  const molduraLargura = emPx(modelo.moldura.largura)
  const molduraAltura = emPx(modelo.moldura.altura)

  const rect =
    crianca.fotoLargura && crianca.fotoAltura
      ? enquadrar(
          { largura: molduraLargura, altura: molduraAltura },
          { largura: crianca.fotoLargura, altura: crianca.fotoAltura },
          ajuste,
        )
      : null

  const corpo = corpoDoNome(
    {
      largura: modelo.nomeCaixa.largura,
      altura: modelo.nomeCaixa.altura,
      corpoMinimo: modelo.nomeCaixa.corpoMinimo,
      corpoMaximo: modelo.nomeCaixa.corpoMaximo,
    },
    nome,
    tamanhoDoNome,
    medirEmArialBold,
  )

  const texto = modelo.nomeCaixa.maiusculas ? nome.toLocaleUpperCase('pt-BR') : nome

  return (
    <div
      ref={folha}
      className={
        miniatura
          ? 'cartoes-folha cartoes-folha-miniatura'
          : grande
            ? 'cartoes-folha cartoes-folha-grande'
            : 'cartoes-folha'
      }
      style={{ height: `${altura}px` }}
      onPointerDown={(ev) => {
        if (!aoArrastar) return
        arrasto.current = {
          x: ev.clientX,
          y: ev.clientY,
          dx: ajuste.deslocX,
          dy: ajuste.deslocY,
        }
        ev.currentTarget.setPointerCapture(ev.pointerId)
      }}
      onPointerMove={(ev) => {
        if (!aoArrastar || !arrasto.current) return
        const inicio = arrasto.current
        aoArrastar({
          deslocX: inicio.dx + (ev.clientX - inicio.x) / molduraLargura,
          deslocY: inicio.dy + (ev.clientY - inicio.y) / molduraAltura,
        })
      }}
      onPointerUp={() => {
        arrasto.current = null
      }}
    >
      {modelo.arteUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={modelo.arteUrl} alt="" className="cartoes-folha-arte" />
      ) : (
        <span className="cartoes-folha-sem-arte">
          Arte do {modelo.nome} ainda não carregada
        </span>
      )}

      <div
        className={
          modelo.moldura.formato === 'RETANGULO'
            ? 'cartoes-moldura cartoes-moldura-recta'
            : 'cartoes-moldura'
        }
        style={{
          left: `${emPx(modelo.moldura.x)}px`,
          top: `${emPx(modelo.moldura.y)}px`,
          width: `${molduraLargura}px`,
          height: `${molduraAltura}px`,
        }}
      >
        {rect && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cartoes.urlDaFoto(projectSlug, pedidoId, crianca.id)}
            alt=""
            draggable={false}
            style={{
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.largura}px`,
              height: `${rect.altura}px`,
            }}
          />
        )}
      </div>

      {texto && (
        <span
          className="cartoes-folha-nome"
          style={{
            left: `${emPx(modelo.nomeCaixa.x)}px`,
            top: `${emPx(modelo.nomeCaixa.y)}px`,
            width: `${emPx(modelo.nomeCaixa.largura)}px`,
            height: `${emPx(modelo.nomeCaixa.altura)}px`,
            fontSize: `${emPx(corpo)}px`,
            color: modelo.nomeCaixa.corHex,
          }}
        >
          {texto}
        </span>
      )}
    </div>
  )
}
