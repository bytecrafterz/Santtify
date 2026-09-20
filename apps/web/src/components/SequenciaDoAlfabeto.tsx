'use client'

import { useCallback, useEffect, useState } from 'react'
import { admin, type CartaoAdmin, type VagaoAdmin } from '@/lib/admin'
import { CabecalhoFixo } from './CabecalhoFixo'
import { useAuth } from './ProvedorDeAuth'
import { EditorDeCartao } from './EditorDeCartao'
import { EditorDoCartaoDeImpressao } from './EditorDoCartaoDeImpressao'
import { QrDaLetra } from './QrDaLetra'

/**
 * O painel do alfabeto, nas três telas que ele desenhou em 23/08.
 *
 * A comparação é dele e é boa: a composição de um comboio. A Letra A é o
 * primeiro vagão, a B o segundo, e a linha que os liga não se interrompe até à
 * Z. Cada vagão leva quatro cartões que são dele e de mais ninguém.
 *
 * AS TRÊS TELAS VIVEM NA MESMA PÁGINA, e isso é a pedido dele: "ao salvar,
 * volta automaticamente aos quatro quadrados e marca aquele como concluído".
 * Se fossem três endereços, guardar um cartão obrigaria a uma volta ao
 * servidor e a pessoa perdia o sítio onde estava a meio de preencher 26 letras.
 */
type Onde =
  /**
   * A sequência lembra-se de onde ele estava.
   *
   * "Estou trabalhando na letra R, entro para editar e depois volto. O sistema
   * me joga novamente para a letra A." Ele tem razão e isto não é conforto: são
   * 26 letras, quatro cartões cada, e voltar ao topo a cada gravação é descer a
   * lista dezenas de vezes num dia de trabalho.
   */
  | { tela: 'sequencia'; casa?: string }
  | { tela: 'quadrados'; casa: string }
  | { tela: 'cartao'; casa: string; cartaoId: string }

/** As quatro casas nascem sempre, mesmo quando a letra ainda está vazia. */
const CASAS = ['Explicação', 'Música', 'Repetição do versículo', 'Oração']

/** Uma cor por casa, para se reconhecer o quadrado sem ler. */
const CORES = ['#2563eb', '#7c3aed', '#ea580c', '#7c3aed']

export function SequenciaDoAlfabeto({ projectSlug }: { projectSlug: string }) {
  const [vagoes, definirVagoes] = useState<VagaoAdmin[]>([])
  const [onde, definirOnde] = useState<Onde>({ tela: 'sequencia' })
  const [carregando, definirCarregando] = useState(true)
  const [erro, definirErro] = useState<string | null>(null)
  const [menuAberto, definirMenuAberto] = useState<string | null>(null)
  /**
   * Duplicar demorava sem dizer nada.
   *
   * Ele escreveu em 31/08 que a função "simplesmente não está funcionando".
   * Fui ver e ela funciona: o servidor responde 201 e a cópia fica criada. O
   * que não havia era sinal nenhum. Carrega-se, o menu fecha, e durante alguns
   * segundos o ecrã fica igual enquanto a cópia é criada e a lista recarrega.
   * Com oito cartões na letra, a cópia nasce no meio da lista e passa
   * despercebida.
   *
   * É a mesma queixa que ele já me tinha feito do botão PUBLICAR em 29/08, e eu
   * corrigi só naquele botão em vez de perceber que era um padrão meu.
   */
  const [aDuplicar, definirADuplicar] = useState<string | null>(null)
  const [copiaNova, definirCopiaNova] = useState<string | null>(null)
  const [aCriarImpressao, definirACriarImpressao] = useState(false)
  const { usuario, carregando: aRestaurarSessao } = useAuth()

  /**
   * Voltar de uma letra devolve a lista NAQUELA letra, e não no princípio.
   *
   * `block: 'center'` e não 'start': encostar a letra ao topo esconde-a por
   * baixo do cabeçalho fixo, e ele ficava a olhar para a letra seguinte
   * convencido de que o sítio se tinha perdido na mesma.
   *
   * Sem animação de propósito. Ver a lista a correr sozinha do A até ao R faz
   * parecer que a página se enganou e se corrigiu; aparecer já no sítio certo é
   * o que se espera de voltar.
   */
  useEffect(() => {
    if (onde.tela !== 'sequencia' || !onde.casa) return
    document.getElementById(`vagao-${onde.casa}`)?.scrollIntoView({ block: 'center' })
  }, [onde])
  /** A ordem enquanto ele mexe, antes de gravar. Nula = a do servidor. */
  const [ordem, definirOrdem] = useState<string[] | null>(null)
  const [aGravarOrdem, definirAGravarOrdem] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const r = await admin.alfabeto(projectSlug)
      definirVagoes(r.vagoes)
      definirErro(null)
    } catch {
      definirErro('Não foi possível carregar o alfabeto.')
    } finally {
      definirCarregando(false)
    }
  }, [projectSlug])

  /**
   * Espera pela sessão antes de perguntar.
   *
   * O access token só vive em memória: ao abrir a página ele ainda não existe,
   * e é preciso trocar o refresh guardado por um novo. Sem esta espera, o
   * painel perguntava ao servidor sem credencial nenhuma, levava um 401 e
   * mostrava "não foi possível carregar o alfabeto" a um administrador com a
   * sessão perfeitamente válida. É a terceira vez esta semana que esta corrida
   * me apanha, sempre com outra cara.
   */
  useEffect(() => {
    if (aRestaurarSessao) return
    void recarregar()
  }, [recarregar, aRestaurarSessao, usuario?.id])

  const vagao = 'casa' in onde ? vagoes.find((v) => v.casa === onde.casa) : undefined

  // ── Tela 3: o cartão ──────────────────────────────────────────────
  if (onde.tela === 'cartao' && vagao) {
    const cartao = vagao.cartoes.find((c) => c.id === onde.cartaoId)
    if (cartao?.papel === 'IMPRESSAO') {
      // Outro editor, porque tem outros campos e outra régua: arte de
      // apresentação e folha A4, sem áudio nem descrição.
      return (
        <>
          <CabecalhoFixo
            projectSlug={projectSlug}
            onde={vagao.rotulo}
            voltarPara={`/${projectSlug}/admin`}
          />
          <EditorDoCartaoDeImpressao
            key={cartao.id}
            cartao={cartao}
            letra={vagao.letra ?? String(vagao.numero ?? '')}
            projectSlug={projectSlug}
            contentSlug={vagao.slug}
            aoApagar={async () => {
              await recarregar()
              definirOnde({ tela: 'quadrados', casa: vagao.casa })
            }}
            aoGuardar={async () => {
              await recarregar()
              definirOnde({ tela: 'quadrados', casa: vagao.casa })
            }}
            aoCancelar={() => definirOnde({ tela: 'quadrados', casa: vagao.casa })}
          />
        </>
      )
    }
    if (cartao) {
      return (
        <>
          <CabecalhoFixo
            projectSlug={projectSlug}
            onde={vagao.rotulo}
            voltarPara={`/${projectSlug}/admin`}
          />
          <EditorDeCartao
            key={cartao.id}
            cartao={cartao}
            projectSlug={projectSlug}
            aoGuardar={async () => {
              await recarregar()
              // Volta aos quatro quadrados, como ele pediu: guardar um cartão
              // não é sair do trabalho, é passar ao seguinte.
              definirOnde({ tela: 'quadrados', casa: vagao.casa })
            }}
            aoMudar={recarregar}
            aoCancelar={() => definirOnde({ tela: 'quadrados', casa: vagao.casa })}
          />
        </>
      )
    }
  }

  // ── Tela 2: os quatro quadrados ───────────────────────────────────
  if (onde.tela === 'quadrados' && vagao) {
    const impressao = vagao.cartoes.find((c) => c.papel === 'IMPRESSAO')
    const doVagao = vagao.cartoes.filter((c) => c.papel === 'CARTAO')
    // A ordem em que ele os está a arrumar agora, se já mexeu; senão a do
    // servidor, que já vem pelas casas e depois pelas cópias.
    const lista = ordem
      ? (ordem.map((id) => doVagao.find((c) => c.id === id)).filter(Boolean) as typeof doVagao)
      : doVagao

    function mover(i: number, direccao: -1 | 1) {
      const j = i + direccao
      if (j < 0 || j >= lista.length) return
      const nova = lista.map((c) => c.id)
      ;[nova[i], nova[j]] = [nova[j], nova[i]]
      definirOrdem(nova)
    }

    return (
      <>
        <CabecalhoFixo
          projectSlug={projectSlug}
          onde={vagao.rotulo}
          voltarPara={`/${projectSlug}/admin`}
        />
        <div className="painel-quadrados">
          <button
            type="button"
            className="voltar-sequencia"
            onClick={() => definirOnde({ tela: 'sequencia', casa: vagao.casa })}
          >
            ← Alfabeto
          </button>
          <h1>Conteúdos: {vagao.rotulo}</h1>
          <p className="nota">Toque para editar • Toque nos três pontos para ver opções</p>

          <div className="grade-quadrados">
            {lista.map((c, i) => (
              <Quadrado
                key={c.id}
                cartao={c}
                numero={i + 1}
                cor={CORES[(c.slot ?? i + 1) - 1] ?? CORES[0]}
                menuAberto={menuAberto === c.id}
                aoAbrirMenu={() => definirMenuAberto(menuAberto === c.id ? null : c.id)}
                aoEditar={() => {
                  definirMenuAberto(null)
                  definirOnde({ tela: 'cartao', casa: vagao.casa, cartaoId: c.id })
                }}
                aDuplicar={aDuplicar === c.id}
                acabadaDeCriar={copiaNova === c.id}
                aoDuplicar={async () => {
                  /*
                    O MENU FICA ABERTO ENQUANTO DUPLICA.

                    Fechava-o na primeira linha, e com ele desaparecia o botão
                    que devia dizer "A duplicar...". Ou seja: pus o aviso e
                    tirei-o do ecrã no mesmo gesto. Medido — o rótulo nunca
                    chegou a ser visto uma única vez.

                    Fecha no fim, quando já há uma cópia acesa para onde olhar.
                  */
                  definirADuplicar(c.id)
                  definirErro(null)
                  try {
                    const copia = await admin.duplicarCartao(c.id)
                    await recarregar()
                    definirCopiaNova(copia.id)
                    // Levar a pessoa até à cópia e acendê-la por um instante:
                    // saber que foi criada não chega, é preciso ver ONDE.
                    requestAnimationFrame(() => {
                      document
                        .getElementById(`quadrado-${copia.id}`)
                        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                    })
                    definirMenuAberto(null)
                    setTimeout(() => definirCopiaNova(null), 4000)
                  } catch (e) {
                    definirMenuAberto(null)
                    definirErro(
                      e instanceof Error ? e.message : 'Não foi possível duplicar este cartão.',
                    )
                  } finally {
                    definirADuplicar(null)
                  }
                }}
                aoApagar={async () => {
                  definirMenuAberto(null)
                  const nome = c.titulo || c.nomeInterno || 'este cartão'
                  const aviso =
                    c.slot === null
                      ? `Remover a cópia "${nome}"? Ela desaparece.`
                      : `Esvaziar "${nome}"? O quadrado fica, só o conteúdo sai.`
                  if (!confirm(aviso)) return
                  await admin.apagarCartaoDeVez(c.id)
                  await recarregar()
                }}
                /* Só o quarto quadrado cria o cartão de impressão, e só uma vez. */
                aoTirarDoAr={async () => {
                  definirMenuAberto(null)
                  await admin.tirarCartaoDoAr(c.id)
                  await recarregar()
                }}
                aoPorNoAr={async () => {
                  definirMenuAberto(null)
                  try {
                    await admin.porCartaoNoAr(c.id)
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Não foi possível pôr no ar.')
                  }
                  await recarregar()
                }}
                aoSubir={i > 0 ? () => mover(i, -1) : undefined}
                aoDescer={i < lista.length - 1 ? () => mover(i, 1) : undefined}
                aoCriarImpressao={
                  c.slot === 4 && !impressao && vagao.contentId
                    ? async () => {
                        definirMenuAberto(null)
                        await admin.criarCartaoDeImpressao(vagao.contentId!)
                        await recarregar()
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {/* O QR fica aqui, na letra, e não dentro do cartão de impressão:
              as letras sem cartão criado também precisam do seu. */}
          <QrDaLetra projectSlug={projectSlug} contentSlug={vagao.slug} letra={vagao.letra ?? String(vagao.numero ?? '')} />

          {/* SALVAR ORDEM só aparece depois de ele mexer em alguma coisa.
              Um botão de gravar sempre à vista, sem nada por gravar, ensina a
              pessoa a ignorá-lo — e no dia em que houver mesmo alterações por
              gravar, ela ignora-o também. */}
          {ordem && (
            <button
              type="button"
              className="botao-acao largo salvar-ordem"
              disabled={aGravarOrdem || !vagao.contentId}
              onClick={async () => {
                if (!vagao.contentId) return
                definirAGravarOrdem(true)
                try {
                  await admin.ordenarCartoes(vagao.contentId, ordem)
                  definirOrdem(null)
                  await recarregar()
                } finally {
                  definirAGravarOrdem(false)
                }
              }}
            >
              {aGravarOrdem ? 'A guardar...' : 'SALVAR ORDEM'}
            </button>
          )}

          {impressao ? (
            <button
              type="button"
              className="quadrado-impressao pronto"
              onClick={() =>
                definirOnde({ tela: 'cartao', casa: vagao.casa, cartaoId: impressao.id })
              }
            >
              <span className="icone" aria-hidden>
                🖨
              </span>
              <span className="nome">CARTÃO PARA IMPRESSÃO</span>
              <span className="estado">
                {impressao.estado === 'PUBLICADO' ? 'pronto' : 'rascunho'}
              </span>
            </button>
          ) : (
            /*
              UM BOTÃO, E NÃO UM AVISO A DIZER ONDE FICA O BOTÃO.

              Isto era um texto morto: "Criado a partir do quarto quadrado". O
              caminho existia mesmo, dentro do menu de três pontinhos do quarto
              quadrado, e ninguém o encontrava. Ele foi à Letra C em 26/08 e
              escreveu que não havia "um caminho claro para colocar o cartão de
              impressão e gerar o PDF". Tinha razão: havia um letreiro a apontar
              para uma porta escondida.
            */
            <button
              type="button"
              className="quadrado-impressao criar"
              disabled={!vagao.contentId || aCriarImpressao}
              onClick={async () => {
                if (!vagao.contentId) return
                definirACriarImpressao(true)
                try {
                  const novo = await admin.criarCartaoDeImpressao(vagao.contentId)
                  await recarregar()
                  // Abre já o editor: criar e ficar no mesmo sítio seria pedir-lhe
                  // que descobrisse o passo seguinte sozinho outra vez.
                  definirOnde({ tela: 'cartao', casa: vagao.casa, cartaoId: novo.id })
                } finally {
                  definirACriarImpressao(false)
                }
              }}
            >
              <span className="icone" aria-hidden>
                🖨
              </span>
              <span className="nome">CRIAR CARTÃO PARA IMPRESSÃO</span>
              <span className="estado">
                {!vagao.contentId
                  ? 'A letra precisa de ter conteúdo primeiro'
                  : aCriarImpressao
                    ? 'A criar...'
                    : 'Arte, folha A4 e PDF para a gráfica'}
              </span>
            </button>
          )}
        </div>
      </>
    )
  }

  // ── Tela 1: a composição ──────────────────────────────────────────
  return (
    <>
      <CabecalhoFixo
        projectSlug={projectSlug}
        onde="Gerenciar conteúdo"
        voltarPara={`/${projectSlug}/admin`}
      />
      <div className="painel-sequencia">
        <h1>Alfabeto — sequência infinita</h1>
        <p className="nota">Deslize para baixo para ver todas as letras</p>

        {erro && !aRestaurarSessao && <p className="erro">{erro}</p>}
        {(carregando || aRestaurarSessao) && <p className="nota">A carregar...</p>}

        {/* A LINHA NÃO SE INTERROMPE. É o desenho dele, e diz uma coisa
            verdadeira sobre a estrutura: as letras não são 26 páginas soltas,
            são uma composição só. Está desenhada com uma borda contínua e não
            com um traço por letra — assim não há como aparecer uma falha entre
            dois vagões quando um deles ainda está vazio. */}
        <ol className="composicao">
          {vagoes.map((v) => (
            <li key={v.casa} id={`vagao-${v.casa}`} className="vagao">
              <button
                type="button"
                className="cabeca-vagao"
                onClick={() => definirOnde({ tela: 'quadrados', casa: v.casa })}
              >
                <span className="bola-letra" style={{ background: corDaCasa(v.casa) }}>
                  {v.casa}
                </span>
                <span className="dados-vagao">
                  <strong>{v.rotulo.toUpperCase()}</strong>
                  {/* AS CASAS E O QUE ELE CRIOU SÃO DUAS CONTAS, E DIZEM-SE AS
                      DUAS. Dizer só "1 de 4" numa letra onde ele acabou de
                      publicar é, do lado dele, dizer que o trabalho sumiu. */}
                  <small>
                    {v.prontos} de 4 preenchidos
                    {v.extras > 0 && (
                      <>
                        {' · '}
                        <b>
                          +{v.extras} {v.extras === 1 ? 'publicação sua' : 'publicações suas'}
                        </b>
                      </>
                    )}
                  </small>
                </span>
              </button>

              <div className="quadradinhos">
                {CASAS.map((nome, i) => {
                  const c = v.cartoes.find((x) => x.slot === i + 1)
                  return <Quadradinho key={nome} cartao={c} etiqueta={String(i + 1)} nome={nome} />
                })}
                {/* AS PUBLICAÇÕES DELE ENTRAM NO ÍNDICE A SEGUIR ÀS CASAS.
                    Sem isto, tudo o que ele cria existe na letra, existe na
                    página pública, e não existe no ecrã onde ele confere. */}
                {v.cartoes
                  .filter((c) => c.slot === null && c.papel !== 'IMPRESSAO')
                  .map((c) => (
                    <Quadradinho
                      key={c.id}
                      cartao={c}
                      etiqueta="+"
                      nome={c.titulo || c.nomeInterno || 'Publicação'}
                    />
                  ))}
              </div>
            </li>
          ))}
        </ol>

        <p className="fim-composicao">CONTINUA ATÉ A LETRA Z</p>
      </div>
    </>
  )
}

/**
 * Um quadradinho do índice.
 *
 * TRÊS ESTADOS E NÃO DOIS. Dizia PRONTO ou VAZIO, e por isso um cartão com
 * foto, áudio e título a que faltasse a descrição aparecia como VAZIO. Em
 * 31/08 ele viu isso na Letra E e escreveu "como se os outros conteúdos
 * tivessem desaparecido" — e tinha razão, porque era o que estava escrito.
 * VAZIO é agora só quando não há lá nada mesmo.
 */
function Quadradinho({
  cartao,
  etiqueta,
  nome,
}: {
  cartao?: { estado?: string; imagem?: string | null; titulo?: string | null; text?: string | null }
  etiqueta: string
  nome: string
}) {
  const noAr = cartao?.estado === 'PUBLICADO'
  const temAlgo = Boolean(cartao && (cartao.imagem || cartao.titulo?.trim() || noAr))
  return (
    <span
      className={noAr ? 'quadradinho cheio' : temAlgo ? 'quadradinho meio' : 'quadradinho'}
      title={nome}
    >
      <em>{etiqueta}</em>
      {cartao?.imagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cartao.imagem} alt="" aria-hidden />
      ) : (
        <span className="marca" aria-hidden>
          ▤
        </span>
      )}
      <small>{noAr ? 'PRONTO' : temAlgo ? 'RASCUNHO' : 'VAZIO'}</small>
    </span>
  )
}

/** Uma cor por letra, estável: a mesma letra tem sempre a mesma cor. */
/**
 * A cor da bola de cada casa. Seis cores que se repetem, para a composição não
 * ficar uma coluna monocromática.
 *
 * Serve letras ("A") e números ("12"): o que conta é a ordem da casa, e por
 * isso um número com dois dígitos escolhe cor pelo número inteiro e não pelo
 * primeiro algarismo.
 */
function corDaCasa(casa: string) {
  const cores = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#0891b2', '#db2777']
  const numero = Number(casa)
  const posicao = Number.isFinite(numero) && casa.trim() !== '' ? numero - 1 : casa.charCodeAt(0) - 65
  return cores[((posicao % cores.length) + cores.length) % cores.length]
}

function Quadrado({
  cartao,
  numero,
  cor,
  menuAberto,
  aoAbrirMenu,
  aoEditar,
  aDuplicar,
  acabadaDeCriar,
  aoDuplicar,
  aoApagar,
  aoTirarDoAr,
  aoPorNoAr,
  aoSubir,
  aoDescer,
  aoCriarImpressao,
}: {
  cartao: CartaoAdmin
  numero: number
  cor: string
  menuAberto: boolean
  aoAbrirMenu: () => void
  aoEditar: () => void
  aoDuplicar: () => Promise<void>
  /** Este cartão está a ser duplicado agora. */
  aDuplicar: boolean
  /** É a cópia acabada de criar: acende por um instante para se ver onde ficou. */
  acabadaDeCriar: boolean
  aoApagar: () => Promise<void>
  aoTirarDoAr: () => Promise<void>
  aoPorNoAr: () => Promise<void>
  aoSubir?: () => void
  aoDescer?: () => void
  aoCriarImpressao?: () => Promise<void>
}) {
  return (
    <div
      id={`quadrado-${cartao.id}`}
      className={
        (cartao.estado === 'PUBLICADO' ? 'quadrado pronto' : 'quadrado') +
        (acabadaDeCriar ? ' acabada-de-criar' : '')
      }
    >
      <span className="numero" style={{ background: cor }}>
        {numero}
      </span>
      <button type="button" className="tres-pontos" aria-label="Opções" onClick={aoAbrirMenu}>
        ⋯
      </button>

      <button type="button" className="corpo-quadrado" onClick={aoEditar}>
        {cartao.imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cartao.imagem} alt="" aria-hidden />
        ) : (
          <span className="pilha" aria-hidden style={{ color: cor }}>
            ▤
          </span>
        )}
        <span className="nome-quadrado">
          {(cartao.nomeInterno ?? 'Cartão').toUpperCase()}
          {cartao.slot === null && <em> (cópia)</em>}
        </span>
        <span className="estado-quadrado">
          {cartao.estado === 'PUBLICADO' ? 'PRONTO' : 'RASCUNHO'}
        </span>
      </button>

      {/* Setas, e não arrastar. O painel é usado no telemóvel, e arrastar uma
          grelha é justamente o gesto que briga com a rolagem da página — a
          pessoa tenta descer e leva um cartão com ela. */}
      <div className="setas-quadrado">
        <button type="button" aria-label="Mover para trás" onClick={aoSubir} disabled={!aoSubir}>
          ‹
        </button>
        <button
          type="button"
          aria-label="Mover para a frente"
          onClick={aoDescer}
          disabled={!aoDescer}
        >
          ›
        </button>
      </div>

      {menuAberto && (
        <div className="menu-quadrado" role="menu">
          <button type="button" onClick={aoEditar}>
            ✎ Editar
          </button>
          <button type="button" disabled={aDuplicar} onClick={() => void aoDuplicar()}>
            {aDuplicar ? '⧉ A duplicar...' : '⧉ Duplicar'}
          </button>
          {/* TIRAR DO AR e EXCLUIR são duas acções, e não uma com aviso.
              Tirar do ar é reversível e usa-se com pressa — publicou-se o que
              não devia. Excluir é definitivo e usa-se com calma. Num só botão,
              a pressa da primeira acabaria por levar a segunda pela frente. */}
          {cartao.estado === 'PUBLICADO' ? (
            <button type="button" onClick={() => void aoTirarDoAr()}>
              🚫 Tirar do ar
            </button>
          ) : (
            <button type="button" onClick={() => void aoPorNoAr()}>
              ⬆ Pôr no ar
            </button>
          )}
          <button type="button" className="perigo" onClick={() => void aoApagar()}>
            🗑 {cartao.slot === null ? 'Excluir' : 'Esvaziar'}
          </button>
          {aoCriarImpressao && (
            <button type="button" onClick={() => void aoCriarImpressao()}>
              🖨 Criar cartão
            </button>
          )}
        </div>
      )}
    </div>
  )
}
