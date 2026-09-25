'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  A4_MM,
  ajusteNeutro,
  corpoDoNome,
  enquadrar,
  limitesDoDesloc,
  type Ajuste,
} from '@pv/cartoes'
import {
  cartoes,
  type AlinhamentoDoNome,
  type CriancaDoPedido,
  type ModeloDeCartao,
} from '@/lib/cartoes'
import { LupaDoCartao } from './LupaDoCartao'

/**
 * O CARTÃO É O EDITOR.
 *
 * Ele escreveu isto em 25/09, depois de se perder no editor anterior:
 *
 *   "Eu mesmo demorei para encontrar onde editar a foto, o nome e o
 *    enquadramento. Imagine um usuário comum. (…) A personalização precisa
 *    acontecer diretamente no próprio cartão, sem a pessoa precisar procurar
 *    funções em outras partes da página, rolar a tela ou entrar em outras
 *    etapas. (…) clicou na área da foto → edita a foto ali mesmo."
 *
 * E tinha razão. O que havia era um formulário ao lado de uma prévia: campo de
 * nome numa secção, cursor do tamanho noutra, botões de zoom noutra, e a
 * fotografia num passo anterior. Quem desenhou aquilo — eu — sabia onde estava
 * tudo. Mais ninguém.
 *
 * A REGRA, em quatro frases dele:
 *   tocou na foto  → edita a foto
 *   tocou no nome  → edita o nome
 *   arrastou ao lado → troca de cartão
 *   terminou → Salvar
 *
 * As ferramentas nascem COLADAS ao que editam e só quando esse pedaço está
 * escolhido. Nenhuma fica no ecrã à espera de ser descoberta.
 */

/** Um passo de zoom por toque. Dez toques levam de 1 a 6, que é o limite. */
const PASSO_DE_ZOOM = 0.25
/** Quanto uma seta do "Mover" empurra a foto, em fracção da moldura. */
const PASSO_DE_EMPURRAO = 0.04
/** Meio segundo parado antes de gravar. Arrastar dispara dezenas de mudanças. */
const ESPERA_ANTES_DE_GRAVAR = 500
/** Arrasto horizontal, em pixéis, a partir do qual se troca de cartão. */
const ARRASTO_QUE_TROCA = 50
/** Abaixo disto, um dedo que pousou e saiu foi um toque, e não um arrasto. */
const TOQUE_MAXIMO = 8
/** Dois toques dentro deste tempo são um toque duplo. */
const TOQUE_DUPLO_MS = 320

/**
 * As cores que a família pode escolher para o nome.
 *
 * Poucas e escuras de propósito. A placa do nome na arte dele é clara, e uma
 * paleta livre acabava em nomes amarelos sobre branco — ilegíveis no ecrã e
 * piores no papel, onde já não há como desfazer.
 */
const CORES_DO_NOME = [
  { hex: null, nome: 'Do cartão' },
  { hex: '#12356B', nome: 'Azul' },
  { hex: '#8A1538', nome: 'Vinho' },
  { hex: '#1B5E20', nome: 'Verde' },
  { hex: '#4A148C', nome: 'Roxo' },
  { hex: '#111111', nome: 'Preto' },
] as const

/** O que o navegador mede, para o nome ter no ecrã o corpo que terá no papel. */
function medirEmArialBold(texto: string): number {
  if (typeof document === 'undefined') return texto.length * 0.6
  const tela = document.createElement('canvas')
  const ctx = tela.getContext('2d')
  if (!ctx) return texto.length * 0.6
  ctx.font = 'bold 100px Arial, Helvetica, sans-serif'
  return ctx.measureText(texto).width / 100
}

type Escolhido = 'foto' | 'nome' | null

export function CartaoComoEditor({
  projectSlug,
  pedidoId,
  crianca,
  modelos,
  indice,
  aoMudarIndice,
  aoMudarCrianca,
  aoErrar,
  aoSalvar,
  aSalvar,
}: {
  projectSlug: string
  pedidoId: string
  crianca: CriancaDoPedido
  modelos: ModeloDeCartao[]
  /**
   * Em que cartão ela está — e o estado vive FORA deste componente.
   *
   * Ele apanhou-o em 25/09: "estou no Dia 2 de 7, coloquei a foto, escrevi o
   * nome (…) apertei Voltar. Tenho que retornar ao Dia 2 de 7". Enquanto o
   * número vivesse aqui dentro, ir ao pagamento desmontava o componente e a
   * volta caía sempre no Dia 1.
   */
  indice: number
  aoMudarIndice: (i: number) => void
  aoMudarCrianca: (c: CriancaDoPedido) => void
  aoErrar: (m: string | null) => void
  aoSalvar: () => void
  aSalvar: boolean
}) {
  const definirIndice = aoMudarIndice
  const [lupaAberta, definirLupaAberta] = useState(false)
  const [escolhido, definirEscolhido] = useState<Escolhido>(null)
  const [paletaAberta, definirPaletaAberta] = useState(false)
  const [setasAbertas, definirSetasAbertas] = useState(false)
  const [aEnviar, definirAEnviar] = useState(false)

  // O estado local manda enquanto o dedo está em cima; o servidor confirma
  // depois. Esperar pela resposta a cada arrasto dava um cartão a tremer.
  const [nome, definirNome] = useState(crianca.nome)
  const [ajuste, definirAjuste] = useState<Ajuste>(crianca.ajuste)
  const [tamanho, definirTamanho] = useState(crianca.tamanhoDoNome)
  const [alinhamento, definirAlinhamento] = useState<AlinhamentoDoNome>(crianca.nomeAlinhamento)
  const [cor, definirCor] = useState<string | null>(crianca.nomeCorHex)

  const ficheiro = useRef<HTMLInputElement | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    definirNome(crianca.nome)
    definirAjuste(crianca.ajuste)
    definirTamanho(crianca.tamanhoDoNome)
    definirAlinhamento(crianca.nomeAlinhamento)
    definirCor(crianca.nomeCorHex)
  }, [crianca.id, crianca.nome, crianca.ajuste, crianca.tamanhoDoNome, crianca.nomeAlinhamento, crianca.nomeCorHex])

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  const gravar = useCallback(
    (dados: Parameters<typeof cartoes.actualizar>[3]) => {
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(async () => {
        try {
          const p = await cartoes.actualizar(projectSlug, pedidoId, crianca.id, dados)
          const nova = p.criancas.find((c) => c.id === crianca.id)
          if (nova) aoMudarCrianca(nova)
          aoErrar(null)
        } catch {
          aoErrar('Não foi possível guardar. Verifique a ligação.')
        }
      }, ESPERA_ANTES_DE_GRAVAR)
    },
    [projectSlug, pedidoId, crianca.id, aoMudarCrianca, aoErrar],
  )

  const modeloActual = modelos[indice]

  /*
    O DESLOCAMENTO FICA DENTRO DO QUE A FOTO TEM PARA DAR.

    Ia até ±1 fosse qual fosse o zoom. Aproximar, arrastar para um canto e
    voltar a 1× deixava o valor lá longe: a foto ficava presa na borda e o dedo
    tinha de desfazer o excesso inteiro antes de ela voltar a mexer. Era o
    "arrastar não funciona depois de aproximar e voltar".

    Trava-se contra a moldura do cartão que está à vista, e volta a travar-se a
    cada mudança de zoom, porque diminuir encolhe o que sobra para os lados.
  */
  const mexer = useCallback(
    (mudanca: Partial<Ajuste>) => {
      const escala = Math.min(6, Math.max(1, mudanca.escala ?? ajuste.escala))
      const lim =
        modeloActual && crianca.fotoLargura && crianca.fotoAltura
          ? limitesDoDesloc(
              { largura: modeloActual.moldura.largura, altura: modeloActual.moldura.altura },
              { largura: crianca.fotoLargura, altura: crianca.fotoAltura },
              escala,
            )
          : { x: 1, y: 1 }
      const novo = {
        escala,
        deslocX: Math.min(lim.x, Math.max(-lim.x, mudanca.deslocX ?? ajuste.deslocX)),
        deslocY: Math.min(lim.y, Math.max(-lim.y, mudanca.deslocY ?? ajuste.deslocY)),
      }
      definirAjuste(novo)
      gravar(novo)
    },
    [ajuste, gravar, modeloActual, crianca.fotoLargura, crianca.fotoAltura],
  )

  async function enviarFoto(f: File) {
    definirAEnviar(true)
    aoErrar(null)
    try {
      await cartoes.enviarFoto(projectSlug, pedidoId, crianca.id, f)
      const p = await cartoes.verPedido(projectSlug, pedidoId)
      const nova = p.criancas.find((c) => c.id === crianca.id)
      if (nova) aoMudarCrianca(nova)
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : 'Não foi possível enviar a foto.')
    } finally {
      definirAEnviar(false)
    }
  }

  const modelo = modelos[indice]
  const total = modelos.length
  const temFoto = crianca.temFoto && crianca.fotoLargura && crianca.fotoAltura

  if (!modelo) return <p className="cartoes-ajuda">A carregar os cartões…</p>

  return (
    <div className="ce" onPointerDown={() => definirEscolhido(null)}>
      <input
        ref={ficheiro}
        type="file"
        accept="image/*"
        className="apenas-leitor-de-ecra"
        onChange={(ev) => {
          const f = ev.target.files?.[0]
          if (f) void enviarFoto(f)
          ev.target.value = ''
        }}
      />

      {/*
        A FAIXA DOS SETE.

        "Deixe uma pequena parte do próximo cartão aparecendo na lateral" — os
        cartões vizinhos ficam de fora das margens e meio transparentes. É o que
        diz, sem uma palavra escrita, que há mais para o lado.
      */}
      <Faixa
        indice={indice}
        total={total}
        // Com a foto escolhida, arrastar em cima dela move a foto — e esse
        // gesto nunca chega aqui, porque a moldura fica com o dedo. Tudo o
        // resto, incluindo a foto ainda por escolher, troca de cartão.
        aoTrocar={(i) => {
          definirEscolhido(null)
          definirSetasAbertas(false)
          definirPaletaAberta(false)
          definirIndice(i)
        }}
      >
        {modelos.map((m, i) => (
          <div
            className={i === indice ? 'ce-casa activa' : 'ce-casa'}
            key={m.id}
            aria-hidden={i !== indice}
            // O vizinho à espreita é um atalho: tocar nele leva lá.
            onClick={i !== indice ? () => definirIndice(i) : undefined}
          >
            {i !== indice && (
              <span className="ce-vizinho-rotulo" aria-hidden="true">
                {m.dia}
              </span>
            )}
            <CartaoDesenhado
              projectSlug={projectSlug}
              pedidoId={pedidoId}
              crianca={crianca}
              modelo={m}
              ajuste={ajuste}
              nome={nome}
              tamanho={tamanho}
              alinhamento={alinhamento}
              cor={cor}
              editavel={i === indice}
              aoAmpliar={() => definirLupaAberta(true)}
              escolhido={i === indice ? escolhido : null}
              aEnviar={aEnviar}
              aoEscolher={definirEscolhido}
              aoMexer={mexer}
              aoEscrever={(t) => {
                definirNome(t)
                gravar({ nome: t })
              }}
              barraDaFoto={
                setasAbertas && temFoto ? (
                  /*
                    O "MOVER" TROCA A BARRA POR UMA FILA DE SETAS.

                    As setas eram uma cruz de três andares por cima da barra, e
                    a barra já sobe acima da moldura: no telemóvel a cruz saía
                    pelo topo do cartão e ficava cortada. Numa fila só, ocupa a
                    altura da própria barra e não há onde se esconder.

                    Arrastar continua a ser o gesto principal. As setas são para
                    quem quer acertar um milímetro, ou não consegue arrastar.
                  */
                  <Ferramentas>
                    <Botao rotulo="Esquerda" simbolo="←" aoTocar={() => mexer({ deslocX: ajuste.deslocX - PASSO_DE_EMPURRAO })} />
                    <Botao rotulo="Cima" simbolo="↑" aoTocar={() => mexer({ deslocY: ajuste.deslocY - PASSO_DE_EMPURRAO })} />
                    <Botao rotulo="Baixo" simbolo="↓" aoTocar={() => mexer({ deslocY: ajuste.deslocY + PASSO_DE_EMPURRAO })} />
                    <Botao rotulo="Direita" simbolo="→" aoTocar={() => mexer({ deslocX: ajuste.deslocX + PASSO_DE_EMPURRAO })} />
                    <Botao rotulo="Pronto" simbolo="✓" activo aoTocar={() => definirSetasAbertas(false)} />
                  </Ferramentas>
                ) : (
                <Ferramentas>
                  <Botao rotulo="Trocar" simbolo="🖼" aoTocar={() => ficheiro.current?.click()} />
                  <Botao
                    rotulo="Aumentar"
                    simbolo="＋"
                    desactivado={!temFoto || ajuste.escala >= 6}
                    aoTocar={() => mexer({ escala: ajuste.escala + PASSO_DE_ZOOM })}
                  />
                  <Botao
                    rotulo="Diminuir"
                    simbolo="－"
                    desactivado={!temFoto || ajuste.escala <= 1}
                    aoTocar={() => mexer({ escala: ajuste.escala - PASSO_DE_ZOOM })}
                  />
                  <Botao
                    rotulo="Mover"
                    simbolo="✥"
                    activo={setasAbertas}
                    desactivado={!temFoto}
                    aoTocar={() => definirSetasAbertas(!setasAbertas)}
                  />
                  <Botao
                    rotulo="Centralizar"
                    simbolo="◎"
                    desactivado={!temFoto}
                    aoTocar={() => mexer(ajusteNeutro())}
                  />
                </Ferramentas>
                )
              }
              barraDoNome={
                <Ferramentas>
                  <Botao
                    rotulo="Menor"
                    simbolo="A-"
                    desactivado={tamanho <= 0}
                    aoTocar={() => {
                      const v = Math.max(0, Number((tamanho - 0.1).toFixed(2)))
                      definirTamanho(v)
                      gravar({ tamanhoDoNome: v })
                    }}
                  />
                  <Botao
                    rotulo="Maior"
                    simbolo="A+"
                    desactivado={tamanho >= 1}
                    aoTocar={() => {
                      const v = Math.min(1, Number((tamanho + 0.1).toFixed(2)))
                      definirTamanho(v)
                      gravar({ tamanhoDoNome: v })
                    }}
                  />
                  {(['ESQUERDA', 'CENTRO', 'DIREITA'] as const).map((a) => (
                    <Botao
                      key={a}
                      rotulo={a === 'ESQUERDA' ? 'Esquerda' : a === 'CENTRO' ? 'Centro' : 'Direita'}
                      simbolo={a === 'ESQUERDA' ? '⬱' : a === 'CENTRO' ? '⬍' : '⬲'}
                      activo={alinhamento === a}
                      aoTocar={() => {
                        definirAlinhamento(a)
                        gravar({ nomeAlinhamento: a })
                      }}
                    />
                  ))}
                  <Botao
                    rotulo="Cor"
                    simbolo="◑"
                    activo={paletaAberta}
                    aoTocar={() => definirPaletaAberta(!paletaAberta)}
                  />
                </Ferramentas>
              }
              paleta={
                paletaAberta ? (
                  <div className="ce-paleta" onPointerDown={(e) => e.stopPropagation()}>
                    {CORES_DO_NOME.map((c) => (
                      <button
                        key={c.nome}
                        type="button"
                        className={cor === c.hex ? 'activa' : undefined}
                        aria-label={c.nome}
                        title={c.nome}
                        style={{ background: c.hex ?? modelo.nomeCaixa.corHex }}
                        onClick={() => {
                          definirCor(c.hex)
                          definirPaletaAberta(false)
                          gravar({ nomeCorHex: c.hex })
                        }}
                      />
                    ))}
                  </div>
                ) : null
              }
            />
          </div>
        ))}
      </Faixa>

      {/*
        A LUPA, com o mesmo desenho que está na página.

        "preciso conseguir verificar essa qualidade antes de comprar" — 25/09.
        Recebe o cartão tal como ele está, e não outra imagem: mostrar aqui coisa
        diferente seria mostrar-lhe uma qualidade que não é a que vai receber.
      */}
      {lupaAberta && (
        <LupaDoCartao
          titulo={`Dia ${modelo.dia} — ${modelo.nome}`}
          aoFechar={() => definirLupaAberta(false)}
        >
          <CartaoDesenhado
            projectSlug={projectSlug}
            pedidoId={pedidoId}
            crianca={crianca}
            modelo={modelo}
            ajuste={ajuste}
            nome={nome}
            tamanho={tamanho}
            alinhamento={alinhamento}
            cor={cor}
            editavel={false}
            altaResolucao
            escolhido={null}
            aEnviar={false}
            aoEscolher={() => {}}
            aoMexer={() => {}}
            aoEscrever={() => {}}
            barraDaFoto={null}
            barraDoNome={null}
            paleta={null}
          />
        </LupaDoCartao>
      )}

      {/*
        "‹ ● ○ ○ ○ ○ ○ ○ ›  1 de 7" — desenhado como ele o escreveu.

        As bolinhas são botões: num ecrã largo não há para onde arrastar, e
        quem usa teclado precisa de chegar ao Dia 5 sem gesto nenhum.
      */}
      <nav className="ce-passos" aria-label="Escolher o cartão">
        <button
          type="button"
          className="ce-seta"
          aria-label="Cartão anterior"
          disabled={indice === 0}
          onClick={() => definirIndice(indice - 1)}
        >
          ‹
        </button>
        <span className="ce-bolinhas">
          {modelos.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={i === indice ? 'activa' : undefined}
              aria-label={`Dia ${m.dia}`}
              aria-current={i === indice}
              onClick={() => definirIndice(i)}
            />
          ))}
        </span>
        <button
          type="button"
          className="ce-seta"
          aria-label="Cartão seguinte"
          disabled={indice === total - 1}
          onClick={() => definirIndice(indice + 1)}
        >
          ›
        </button>
        <strong className="ce-conta">
          {indice + 1} de {total}
        </strong>
      </nav>

      {/*
        A LUPA TAMBÉM TEM BOTÃO.

        Tocar no cartão abre-a — mas tocar no cartão é também o gesto de editar a
        foto e o nome, e ninguém adivinha que o resto do cartão faz outra coisa.
        Um botão com o nome escrito resolve-o para quem não experimentar.
      */}
      <button
        type="button"
        className="cartoes-ligacao ce-ver-grande"
        onClick={() => definirLupaAberta(true)}
      >
        🔍 Ver em tamanho grande
      </button>

      {/*
        SALVAR É O ÚNICO BOTÃO FORA DO CARTÃO, e fica cá em baixo no telemóvel,
        onde o polegar chega. No mockup dele está no canto do cartão; ali, a
        meio de um ecrã de 630px de altura, ficava fora de alcance e por cima da
        arte que ele quer que se veja.

        O que ele pediu foi que Salvar exista e encerre — "Terminou → Salvar" —
        e não uma coordenada.
      */}
      <button
        type="button"
        className="cartoes-accao ce-salvar"
        disabled={aSalvar || !temFoto || !nome.trim()}
        onClick={aoSalvar}
      >
        {aSalvar ? 'A guardar…' : 'Salvar'}
      </button>
      {(!temFoto || !nome.trim()) && (
        <p className="cartoes-ajuda ce-falta">
          {!temFoto && !nome.trim()
            ? 'Toque na foto para enviar uma, e no nome para o escrever.'
            : !temFoto
              ? 'Toque na área da foto para enviar a fotografia.'
              : 'Toque em “Seu nome aqui” para escrever o nome.'}
        </p>
      )}
    </div>
  )
}

/* ── A faixa deslizante ──────────────────────────────────────────────── */

function Faixa({
  indice,
  total,
  aoTrocar,
  children,
}: {
  indice: number
  total: number
  aoTrocar: (i: number) => void
  children: React.ReactNode
}) {
  const inicio = useRef<{ x: number; y: number; id: number } | null>(null)
  const arrastou = useRef(false)
  const [puxao, definirPuxao] = useState(0)

  /*
    ARRASTAR AO LADO TROCA DE DIA, VENHA O DEDO DE ONDE VIER.

    Não trocava quase nunca, por dois motivos que se somavam. Pousar o dedo no
    cartão abria a lupa logo ali — antes de haver arrasto nenhum —, e pousá-lo
    na moldura da foto, que ocupa metade do cartão, ficava com o gesto para
    mover a foto mesmo sem foto nenhuma. Sobrava uma tira fina à volta.

    Agora o dedo só é da foto quando ela já foi escolhida; o resto é da faixa.
    E a faixa só agarra o ponteiro depois de ele andar: agarrá-lo ao pousar
    roubava o clique aos alvos, e um toque na foto deixava de a escolher.
  */
  return (
    <div
      className="ce-faixa"
      onPointerDown={(ev) => {
        arrastou.current = false
        inicio.current = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }
      }}
      onPointerMove={(ev) => {
        const i = inicio.current
        if (!i || i.id !== ev.pointerId) return
        const dx = ev.clientX - i.x
        const dy = ev.clientY - i.y
        if (!arrastou.current) {
          if (Math.hypot(dx, dy) < TOQUE_MAXIMO) return
          // Um gesto que desce mais do que anda ao lado é a página a rolar, e
          // roubá-lo prendia a pessoa no carrossel.
          if (Math.abs(dy) > Math.abs(dx)) {
            inicio.current = null
            return
          }
          arrastou.current = true
          ev.currentTarget.setPointerCapture(ev.pointerId)
        }
        // Nas pontas o cartão resiste, em vez de mostrar um vazio ao lado.
        const naPonta = (indice === 0 && dx > 0) || (indice === total - 1 && dx < 0)
        definirPuxao(naPonta ? dx / 3 : dx)
      }}
      onPointerUp={() => {
        const dx = puxao
        inicio.current = null
        definirPuxao(0)
        if (!arrastou.current) return
        if (dx <= -ARRASTO_QUE_TROCA && indice < total - 1) aoTrocar(indice + 1)
        if (dx >= ARRASTO_QUE_TROCA && indice > 0) aoTrocar(indice - 1)
      }}
      onPointerCancel={() => {
        inicio.current = null
        arrastou.current = false
        definirPuxao(0)
      }}
      // O arrasto acaba num clique; sem isto, largar o dedo em cima do vizinho
      // ou da moldura contava como toque neles.
      onClickCapture={(ev) => {
        if (!arrastou.current) return
        arrastou.current = false
        ev.stopPropagation()
        ev.preventDefault()
      }}
    >
      <div
        className="ce-trilho"
        style={
          {
            '--indice': indice,
            '--puxao': `${puxao}px`,
            transition: puxao ? 'none' : undefined,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  )
}

/* ── O cartão, desenhado e editável ──────────────────────────────────── */

function CartaoDesenhado({
  projectSlug,
  pedidoId,
  crianca,
  modelo,
  ajuste,
  nome,
  tamanho,
  alinhamento,
  cor,
  editavel,
  altaResolucao,
  escolhido,
  aEnviar,
  aoEscolher,
  aoMexer,
  aoEscrever,
  aoAmpliar,
  barraDaFoto,
  barraDoNome,
  paleta,
}: {
  projectSlug: string
  pedidoId: string
  crianca: CriancaDoPedido
  modelo: ModeloDeCartao
  ajuste: Ajuste
  nome: string
  tamanho: number
  alinhamento: AlinhamentoDoNome
  cor: string | null
  editavel: boolean
  /** Na lupa: por cima da arte leve, a de 300 dpi, que chega quando chegar. */
  altaResolucao?: boolean
  escolhido: Escolhido
  aEnviar: boolean
  aoEscolher: (e: Escolhido) => void
  aoMexer: (m: Partial<Ajuste>) => void
  aoEscrever: (t: string) => void
  /** Ausente dentro da própria lupa: ali não há nada para ampliar outra vez. */
  aoAmpliar?: () => void
  barraDaFoto: React.ReactNode
  barraDoNome: React.ReactNode
  paleta: React.ReactNode
}) {
  const folha = useRef<HTMLDivElement | null>(null)
  const pousou = useRef<{ x: number; y: number } | null>(null)
  const ultimoToque = useRef(0)

  /*
    OS DEDOS EM CIMA DA FOTO: UM ARRASTA, DOIS APROXIMAM E ARRASTAM.

    "Quando aumentei o zoom da foto, ela travou" — 25/09. Aproximar com dois
    dedos é o gesto de qualquer telemóvel, e aqui não fazia nada: o segundo
    dedo roubava o arrasto ao primeiro, e ao levantar um deles o outro ficava
    sem gesto nenhum. A foto parecia presa.

    Agora a pinça aproxima e arrasta ao mesmo tempo, e quando um dedo sai o que
    fica recomeça o arrasto a partir de onde está — nunca a partir de onde a
    pinça começou, que dava um salto.
  */
  const alvoDaFoto = useRef<HTMLDivElement | null>(null)
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  const gesto = useRef<
    | { tipo: 'um'; x: number; y: number; dx: number; dy: number }
    | { tipo: 'dois'; dist: number; cx: number; cy: number; escala: number; dx: number; dy: number }
    | null
  >(null)
  // O ajuste de AGORA, para recomeçar um gesto entre dois desenhos.
  const ajusteAgora = useRef(ajuste)
  ajusteAgora.current = ajuste
  const fotoEscolhida = useRef(false)
  fotoEscolhida.current = editavel && escolhido === 'foto'

  function comecarGesto() {
    const lista = [...dedos.current.values()]
    const a = ajusteAgora.current
    if (lista.length >= 2) {
      const [p, q] = lista
      gesto.current = {
        tipo: 'dois',
        dist: Math.hypot(p.x - q.x, p.y - q.y) || 1,
        cx: (p.x + q.x) / 2,
        cy: (p.y + q.y) / 2,
        escala: a.escala,
        dx: a.deslocX,
        dy: a.deslocY,
      }
    } else if (lista.length === 1) {
      gesto.current = { tipo: 'um', x: lista[0].x, y: lista[0].y, dx: a.deslocX, dy: a.deslocY }
    } else {
      gesto.current = null
    }
  }

  /*
    O IPHONE NÃO PODE ROLAR A PÁGINA POR BAIXO DA FOTO ESCOLHIDA.

    O `touch-action: none` do CSS devia bastar, mas o Safari nem sempre o
    respeita a meio de uma página que rola. Um `touchmove` que não é passivo e
    cancela o gesto é a garantia — e só actua na foto escolhida, para o resto
    do cartão continuar a deixar rolar e deslizar de dia.
  */
  useEffect(() => {
    const el = alvoDaFoto.current
    if (!el) return
    const segura = (e: TouchEvent) => {
      if (fotoEscolhida.current) e.preventDefault()
    }
    el.addEventListener('touchmove', segura, { passive: false })
    return () => el.removeEventListener('touchmove', segura)
  }, [])
  const [largura, definirLargura] = useState(320)

  useEffect(() => {
    const el = folha.current
    if (!el) return
    const observador = new ResizeObserver(([e]) => definirLargura(e.contentRect.width))
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  const altura = (largura * A4_MM.altura) / A4_MM.largura
  const emPx = (mm: number) => (mm / A4_MM.largura) * largura

  const molduraLargura = emPx(modelo.moldura.largura)
  const molduraAltura = emPx(modelo.moldura.altura)

  const rect =
    crianca.temFoto && crianca.fotoLargura && crianca.fotoAltura
      ? enquadrar(
          { largura: molduraLargura, altura: molduraAltura },
          { largura: crianca.fotoLargura, altura: crianca.fotoAltura },
          ajuste,
        )
      : null

  const texto = modelo.nomeCaixa.maiusculas ? nome.toLocaleUpperCase('pt-BR') : nome

  /*
    MEDE-SE O QUE SE DESENHA, E NÃO O QUE SE RECEBEU.

    O corpo era calculado sobre `nome` e o ecrã desenhava `nome` em maiúsculas.
    "Guilherme" mede menos que "GUILHERME" em Arial Bold — cerca de 12% menos —
    e o resultado era um nome escolhido para caber a sair pela caixa fora. Via-se
    no lugar vazio, onde "Seu nome aqui" saía cortado em "EU NOME AQU".

    O servidor sempre fez o certo: `escreverNome` põe em maiúsculas na primeira
    linha e só depois mede. Eram o ecrã e o papel a discordar, num ficheiro que
    promete por escrito que concordam.
  */
  const corpo = useMemo(
    () =>
      corpoDoNome(
        {
          largura: modelo.nomeCaixa.largura,
          altura: modelo.nomeCaixa.altura,
          corpoMinimo: modelo.nomeCaixa.corpoMinimo,
          corpoMaximo: modelo.nomeCaixa.corpoMaximo,
        },
        texto || (modelo.nomeCaixa.maiusculas ? 'SEU NOME AQUI' : 'Seu nome aqui'),
        tamanho,
        medirEmArialBold,
      ),
    [modelo.nomeCaixa, texto, tamanho],
  )

  return (
    <div
      ref={folha}
      className="ce-folha"
      style={{ height: `${altura}px` }}
      /*
        DOIS TOQUES NO CARTÃO ABREM-NO EM GRANDE; UM TOQUE EDITA.

        Abria com um toque só, ao pousar o dedo — e pousar o dedo é também como
        começa um arrasto para o dia seguinte. Quem tentava deslizar acabava com
        a lupa aberta. O toque duplo é o gesto que qualquer galeria de fotos já
        ensinou, e não disputa nada: um toque escolhe a foto ou o nome, dois
        ampliam, arrastar troca de dia.

        Conta-se à mão, e não com `onDoubleClick`, porque o Safari do iPhone
        não o dispara de forma fiável num toque duplo.
      */
      onPointerDownCapture={(ev) => {
        pousou.current = { x: ev.clientX, y: ev.clientY }
      }}
      onClick={(ev) => {
        if (!editavel || !aoAmpliar) return
        const alvo = ev.target as HTMLElement
        if (alvo.closest('.ce-barra, input')) return
        const p = pousou.current
        if (p && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > TOQUE_MAXIMO) return
        const agora = Date.now()
        if (agora - ultimoToque.current < TOQUE_DUPLO_MS) {
          ultimoToque.current = 0
          aoAmpliar()
        } else {
          ultimoToque.current = agora
        }
      }}
    >
      {modelo.arteUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={modelo.arteUrl}
          alt={`Dia ${modelo.dia} — ${modelo.nome}`}
          className="ce-arte"
          // Sem isto o computador arrasta a imagem em vez de deslizar o cartão.
          draggable={false}
        />
      ) : null}
      {modelo.arteUrl && altaResolucao && modelo.arteLupaUrl ? (
        /*
          A LUPA MOSTRA A ARTE A 300 DPI.

          Fica por cima da leve, que já está em cache: a lupa abre logo, e o
          texto ganha nitidez assim que a pesada termina de chegar.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={modelo.arteLupaUrl} alt="" aria-hidden="true" className="ce-arte" draggable={false} />
      ) : null}
      {modelo.arteUrl ? null : (
        <span className="ce-sem-arte">Arte do {modelo.nome} ainda não carregada</span>
      )}

      {/* ── A FOTO ─────────────────────────────────────────────────── */}
      <div
        className={[
          'ce-alvo',
          'ce-alvo-foto',
          modelo.moldura.formato === 'RETANGULO' ? 'recta' : 'redonda',
          escolhido === 'foto' ? 'escolhido' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          left: `${emPx(modelo.moldura.x)}px`,
          top: `${emPx(modelo.moldura.y)}px`,
          width: `${molduraLargura}px`,
          height: `${molduraAltura}px`,
        }}
        role={editavel ? 'button' : undefined}
        tabIndex={editavel ? 0 : -1}
        aria-label="Editar a fotografia"
        /*
          UM TOQUE ESCOLHE; SÓ DEPOIS DE ESCOLHIDA É QUE ARRASTAR MOVE A FOTO.

          Antes, pousar o dedo aqui escolhia e agarrava ao mesmo tempo — e a
          moldura é metade do cartão, por isso quase todo o arrasto para o dia
          seguinte acabava a empurrar a foto. Agora o primeiro gesto é da faixa.
        */
        ref={alvoDaFoto}
        onPointerDown={(ev) => {
          if (!editavel || escolhido !== 'foto' || !rect) return
          ev.stopPropagation()
          ev.currentTarget.setPointerCapture(ev.pointerId)
          /*
            O PRIMEIRO DEDO DE UM TOQUE NOVO LIMPA A LISTA.

            Se o telemóvel perdesse o aviso de um dedo a sair — o iPhone perde-o
            às vezes a meio de uma pinça —, esse dedo fantasma ficava na lista
            para sempre, cada toque seguinte contava como pinça com ele, e a
            foto não voltava a andar. Era o "travou" de 25/09.
          */
          if (ev.isPrimary) dedos.current.clear()
          dedos.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
          comecarGesto()
        }}
        onClick={() => {
          if (editavel && escolhido !== 'foto') aoEscolher('foto')
        }}
        onPointerMove={(ev) => {
          if (!dedos.current.has(ev.pointerId) || !gesto.current) return
          dedos.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
          const g = gesto.current
          if (g.tipo === 'dois' && dedos.current.size >= 2) {
            const [p, q] = [...dedos.current.values()]
            const cx = (p.x + q.x) / 2
            const cy = (p.y + q.y) / 2
            aoMexer({
              escala: (g.escala * Math.hypot(p.x - q.x, p.y - q.y)) / g.dist,
              deslocX: g.dx + (cx - g.cx) / molduraLargura,
              deslocY: g.dy + (cy - g.cy) / molduraAltura,
            })
            return
          }
          if (g.tipo === 'um') {
            aoMexer({
              deslocX: g.dx + (ev.clientX - g.x) / molduraLargura,
              deslocY: g.dy + (ev.clientY - g.y) / molduraAltura,
            })
          }
        }}
        onPointerUp={(ev) => {
          dedos.current.delete(ev.pointerId)
          comecarGesto()
        }}
        onPointerCancel={(ev) => {
          dedos.current.delete(ev.pointerId)
          comecarGesto()
        }}
        onLostPointerCapture={(ev) => {
          if (!dedos.current.delete(ev.pointerId)) return
          comecarGesto()
        }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            aoEscolher('foto')
          }
        }}
      >
        {rect ? (
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
        ) : (
          /*
            "Deixa a foto e o nome em branco" — 25/09.

            O lugar vazio diz o que fazer com ele. Sem isto, a moldura vazia
            parece parte da arte e ninguém lhe toca.
          */
          <span className="ce-vazio" style={{ fontSize: `${Math.max(9, molduraLargura * 0.085)}px` }}>
            <span className="ce-vazio-icone" aria-hidden="true">
              {aEnviar ? '⏳' : '📷'}
            </span>
            {aEnviar ? 'A enviar…' : 'Sua foto aqui'}
          </span>
        )}
      </div>

      {editavel && escolhido === 'foto' && (
        <div
          className="ce-barra ce-barra-foto"
          // A barra sobe acima da moldura; com a moldura rente ao topo do cartão,
          // ela sairia pela beira e ficava cortada. 64px é a altura dela e folga.
          style={{ top: `${Math.max(emPx(modelo.moldura.y), 64)}px`, left: '50%' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {barraDaFoto}
        </div>
      )}

      {/* ── O NOME ─────────────────────────────────────────────────── */}
      <div
        className={['ce-alvo', 'ce-alvo-nome', escolhido === 'nome' ? 'escolhido' : '']
          .filter(Boolean)
          .join(' ')}
        style={{
          left: `${emPx(modelo.nomeCaixa.x)}px`,
          top: `${emPx(modelo.nomeCaixa.y)}px`,
          width: `${emPx(modelo.nomeCaixa.largura)}px`,
          height: `${emPx(modelo.nomeCaixa.altura)}px`,
        }}
        onPointerDown={(ev) => {
          // Escolhido, o nome é um campo de texto: o dedo é dele, para pôr o
          // cursor, e não da faixa nem de quem desfaz a escolha.
          if (editavel && escolhido === 'nome') ev.stopPropagation()
        }}
        onClick={() => {
          if (editavel && escolhido !== 'nome') aoEscolher('nome')
        }}
      >
        {editavel && escolhido === 'nome' ? (
          /*
            O CAMPO É O PRÓPRIO NOME NO CARTÃO.

            Transparente, sem moldura, com o corpo e a cor que a folha vai ter.
            Escrever aqui é ver o cartão a mudar, e não um campo noutro sítio a
            prometer que muda.
          */
          // eslint-disable-next-line jsx-a11y/no-autofocus
          <input
            autoFocus
            type="text"
            className="ce-campo-nome"
            value={nome}
            maxLength={40}
            placeholder="Seu nome aqui"
            aria-label="Nome que vai no cartão"
            style={{
              fontSize: `${emPx(corpo)}px`,
              color: cor ?? modelo.nomeCaixa.corHex,
              textAlign:
                alinhamento === 'ESQUERDA' ? 'left' : alinhamento === 'DIREITA' ? 'right' : 'center',
              textTransform: modelo.nomeCaixa.maiusculas ? 'uppercase' : 'none',
            }}
            onChange={(ev) => aoEscrever(ev.target.value)}
          />
        ) : (
          <span
            className={texto ? 'ce-nome' : 'ce-nome ce-nome-vazio'}
            /*
              O "Seu nome aqui" mede-se como um nome de verdade.

              Estava a um corpo fixo e saía cortado — "EU NOME AQ" — numa caixa
              de 90mm. Passa pela mesma `corpoDoNome` que o nome real, com o
              tamanho no máximo: o que a pessoa vê é o espaço que tem.
            */
            style={{
              fontSize: `${emPx(corpo)}px`,
              color: texto ? (cor ?? modelo.nomeCaixa.corHex) : undefined,
              justifyContent:
                alinhamento === 'ESQUERDA'
                  ? 'flex-start'
                  : alinhamento === 'DIREITA'
                    ? 'flex-end'
                    : 'center',
            }}
          >
            {texto || 'Seu nome aqui'}
          </span>
        )}
      </div>

      {editavel && escolhido === 'nome' && (
        <div
          className="ce-barra ce-barra-nome"
          style={{
            top: `${emPx(modelo.nomeCaixa.y + modelo.nomeCaixa.altura) + 8}px`,
            left: '50%',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {barraDoNome}
          {paleta}
        </div>
      )}
    </div>
  )
}

/* ── Peças pequenas ──────────────────────────────────────────────────── */

function Ferramentas({ children }: { children: React.ReactNode }) {
  return <div className="ce-ferramentas">{children}</div>
}

function Botao({
  rotulo,
  simbolo,
  aoTocar,
  activo,
  desactivado,
}: {
  rotulo: string
  simbolo: string
  aoTocar: () => void
  activo?: boolean
  desactivado?: boolean
}) {
  return (
    <button
      type="button"
      className={activo ? 'ce-ferramenta activa' : 'ce-ferramenta'}
      disabled={desactivado}
      onClick={aoTocar}
    >
      <span className="ce-simbolo" aria-hidden="true">
        {simbolo}
      </span>
      <span>{rotulo}</span>
    </button>
  )
}
