'use client'

import { useCallback, useEffect, useState } from 'react'
import { admin, type CartaoAdmin, type VagaoAdmin } from '@/lib/admin'
import { CabecalhoFixo } from './CabecalhoFixo'
import { useAuth } from './ProvedorDeAuth'
import { EditorDeCartao } from './EditorDeCartao'
import { EditorDoCartaoDeImpressao } from './EditorDoCartaoDeImpressao'

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
  | { tela: 'sequencia' }
  | { tela: 'quadrados'; letra: string }
  | { tela: 'cartao'; letra: string; cartaoId: string }

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
  const { usuario, carregando: aRestaurarSessao } = useAuth()
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

  const vagao = 'letra' in onde ? vagoes.find((v) => v.letra === onde.letra) : undefined

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
            onde={`Letra ${vagao.letra}`}
            voltarPara={`/${projectSlug}/admin`}
          />
          <EditorDoCartaoDeImpressao
            key={cartao.id}
            cartao={cartao}
            letra={vagao.letra}
            aoGuardar={async () => {
              await recarregar()
              definirOnde({ tela: 'quadrados', letra: vagao.letra })
            }}
            aoCancelar={() => definirOnde({ tela: 'quadrados', letra: vagao.letra })}
          />
        </>
      )
    }
    if (cartao) {
      return (
        <>
          <CabecalhoFixo
            projectSlug={projectSlug}
            onde={`Letra ${vagao.letra}`}
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
              definirOnde({ tela: 'quadrados', letra: vagao.letra })
            }}
            aoCancelar={() => definirOnde({ tela: 'quadrados', letra: vagao.letra })}
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
          onde={`Letra ${vagao.letra}`}
          voltarPara={`/${projectSlug}/admin`}
        />
        <div className="painel-quadrados">
          <button
            type="button"
            className="voltar-sequencia"
            onClick={() => definirOnde({ tela: 'sequencia' })}
          >
            ← Alfabeto
          </button>
          <h1>Conteúdos da Letra {vagao.letra}</h1>
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
                  definirOnde({ tela: 'cartao', letra: vagao.letra, cartaoId: c.id })
                }}
                aoDuplicar={async () => {
                  definirMenuAberto(null)
                  await admin.duplicarCartao(c.id)
                  await recarregar()
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
                definirOnde({ tela: 'cartao', letra: vagao.letra, cartaoId: impressao.id })
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
            <div className="quadrado-impressao vazio">
              <span className="icone" aria-hidden>
                🖨
              </span>
              <span className="nome">CARTÃO PARA IMPRESSÃO</span>
              <span className="estado">Criado a partir do quarto quadrado</span>
            </div>
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
            <li key={v.letra} className="vagao">
              <button
                type="button"
                className="cabeca-vagao"
                onClick={() => definirOnde({ tela: 'quadrados', letra: v.letra })}
              >
                <span className="bola-letra" style={{ background: corDaLetra(v.letra) }}>
                  {v.letra}
                </span>
                <span className="dados-vagao">
                  <strong>LETRA {v.letra}</strong>
                  <small>{v.prontos} de 4 preenchidos</small>
                </span>
              </button>

              <div className="quadradinhos">
                {CASAS.map((nome, i) => {
                  const c = v.cartoes.find((x) => x.slot === i + 1)
                  return (
                    <span
                      key={nome}
                      className={c?.estado === 'PUBLICADO' ? 'quadradinho cheio' : 'quadradinho'}
                      title={nome}
                    >
                      <em>{i + 1}</em>
                      {c?.imagem ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imagem} alt="" aria-hidden />
                      ) : (
                        <span className="marca" aria-hidden>
                          ▤
                        </span>
                      )}
                      <small>{c?.estado === 'PUBLICADO' ? 'PRONTO' : 'VAZIO'}</small>
                    </span>
                  )
                })}
              </div>
            </li>
          ))}
        </ol>

        <p className="fim-composicao">CONTINUA ATÉ A LETRA Z</p>
      </div>
    </>
  )
}

/** Uma cor por letra, estável: a mesma letra tem sempre a mesma cor. */
function corDaLetra(letra: string) {
  const cores = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#0891b2', '#db2777']
  return cores[(letra.charCodeAt(0) - 65) % cores.length]
}

function Quadrado({
  cartao,
  numero,
  cor,
  menuAberto,
  aoAbrirMenu,
  aoEditar,
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
  aoApagar: () => Promise<void>
  aoTirarDoAr: () => Promise<void>
  aoPorNoAr: () => Promise<void>
  aoSubir?: () => void
  aoDescer?: () => void
  aoCriarImpressao?: () => Promise<void>
}) {
  return (
    <div className={cartao.estado === 'PUBLICADO' ? 'quadrado pronto' : 'quadrado'}>
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
          <button type="button" onClick={() => void aoDuplicar()}>
            ⧉ Duplicar
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
