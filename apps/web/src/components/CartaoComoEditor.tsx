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
import type { AlinhamentoDoNome, ModeloDeCartao } from '@/lib/cartoes'
import { escalaMaxima, veredito, type FotoNoAparelho } from '@/lib/foto-no-aparelho'
import { medidorDoNome, nomeImprimivel, type Personalizacao } from '@/lib/pdf-no-aparelho'
import { LupaDoCartao, type FocoDaLupa } from './LupaDoCartao'
import { ArteEmPdf } from './ArteEmPdf'
import { ArteEmMosaico } from './ArteEmMosaico'

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
 * A REGRA, em quatro frases dele:
 *   tocou na foto  → edita a foto
 *   tocou no nome  → edita o nome
 *   arrastou ao lado → troca de cartão
 *   terminou → Continuar
 *
 * As ferramentas nascem COLADAS ao que editam e só quando esse pedaço está
 * escolhido. Nenhuma fica no ecrã à espera de ser descoberta.
 *
 * DESDE 03/10, NADA DAQUI VAI AO SERVIDOR. A foto é a que está na memória do
 * telemóvel (`FotoNoAparelho`), e o nome, o enquadramento, o tamanho, o
 * alinhamento e a cor vivem no ecrã de quem está a editar — o componente
 * recebe-os e devolve as mudanças, e mais nada. Gravar a cada mexida, como se
 * fazia, era mandar o nome da criança para o servidor a cada letra.
 */

/** Um passo de zoom por toque. */
const PASSO_DE_ZOOM = 0.25
/** Quanto uma seta do "Mover" empurra a foto, em fracção da moldura. */
const PASSO_DE_EMPURRAO = 0.04
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

/** A medida de reserva, enquanto a régua do PDF não chega (é carregada à parte). */
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
  foto,
  personalizacao,
  aoMudar,
  aoEscolherFoto,
  aoRemoverFoto,
  aAbrirFoto,
  modelos,
  indice,
  aoMudarIndice,
  aoErrar,
  aoSalvar,
  aSalvar,
  rotuloDeSalvar = 'Continuar',
}: {
  /** A foto em memória, ou nada enquanto não foi escolhida. */
  foto: FotoNoAparelho | null
  personalizacao: Personalizacao
  aoMudar: (mudanca: Partial<Personalizacao>) => void
  aoEscolherFoto: (ficheiro: File) => void
  aoRemoverFoto: () => void
  /** A foto está a ser aberta e medida — leva um instante numa foto grande. */
  aAbrirFoto: boolean
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
  aoErrar: (m: string | null) => void
  aoSalvar: () => void
  aSalvar: boolean
  rotuloDeSalvar?: string
}) {
  const definirIndice = aoMudarIndice
  const [lupaAberta, definirLupaAberta] = useState(false)
  /** Onde a lupa abre já ampliada: o ponto do toque duplo no cartão. */
  const [focoDaLupa, definirFocoDaLupa] = useState<FocoDaLupa | null>(null)
  /*
    A JPEG DE 300 DPI DO CARTÃO DA VEZ, JÁ EM CACHE QUANDO A LUPA ABRIR.

    É ela que se vê na lupa enquanto o PDF desenha a parte ampliada. Pedida
    só ao abrir a lupa, chegava tarde; pedida aqui, com um pouco de atraso
    para não disputar a rede com o PDF do próprio cartão, já lá está.
  */
  useEffect(() => {
    const url = modelos[indice]?.arteLupaUrl
    if (!url) return
    const t = window.setTimeout(() => {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }, 1200)
    return () => window.clearTimeout(t)
  }, [modelos, indice])
  const [escolhido, definirEscolhido] = useState<Escolhido>(null)
  const [paletaAberta, definirPaletaAberta] = useState(false)
  const [setasAbertas, definirSetasAbertas] = useState(false)

  const { nome, ajuste, tamanhoDoNome: tamanho, nomeAlinhamento: alinhamento, nomeCorHex: cor } = personalizacao

  /*
    A RÉGUA DO NOME É A DO PDF.

    O ecrã media em Arial e o papel escreve em Helvetica Bold: quase iguais, e
    "quase" era o nome que cabia no ecrã e saía mais pequeno no papel. A régua
    do PDF carrega-se à parte (é a mesma biblioteca que monta o PDF no fim) e,
    até chegar, mede-se em Arial como antes.
  */
  const [medir, definirMedir] = useState<(texto: string) => number>(() => medirEmArialBold)
  useEffect(() => {
    let vivo = true
    medidorDoNome()
      .then((m) => vivo && definirMedir(() => m))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  const ficheiro = useRef<HTMLInputElement | null>(null)
  const modeloActual = modelos[indice]

  /*
    O ZOOM PÁRA ONDE A FOTO AINDA DÁ 200 DPI EM TODOS OS CARTÕES.

    "Medir os pixels depois do corte (…) mínimo 200 dpi. Abaixo disso,
    recusar." Aproximar usa menos pixéis da foto. Em vez de a deixar aproximar
    e recusar depois, o zoom não passa do ponto em que o recorte ainda chega
    aos 200 dpi no cartão que pede mais.
  */
  const zoomMaximo = useMemo(() => (foto ? escalaMaxima(modelos, foto) : 6), [foto, modelos])
  const vereditoAgora = useMemo(() => (foto ? veredito(modelos, foto, ajuste) : null), [foto, modelos, ajuste])

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
      const escala = Math.min(zoomMaximo, Math.max(1, mudanca.escala ?? ajuste.escala))
      const lim =
        modeloActual && foto
          ? limitesDoDesloc(
              { largura: modeloActual.moldura.largura, altura: modeloActual.moldura.altura },
              { largura: foto.largura, altura: foto.altura },
              escala,
            )
          : { x: 1, y: 1 }
      aoMudar({
        ajuste: {
          escala,
          deslocX: Math.min(lim.x, Math.max(-lim.x, mudanca.deslocX ?? ajuste.deslocX)),
          deslocY: Math.min(lim.y, Math.max(-lim.y, mudanca.deslocY ?? ajuste.deslocY)),
        },
      })
    },
    [ajuste, aoMudar, modeloActual, foto, zoomMaximo],
  )

  /**
   * TIRAR A FOTO — "Não existe botão de deletar a foto", 29/09.
   *
   * A foto é da criança, e não de um cartão: sai de todos de uma vez. Por isso
   * pergunta antes. Depois fica o lugar vazio, pronto para outra.
   */
  function removerFoto() {
    if (!confirm('Remover a foto? Ela sai de todos os cartões, e depois pode escolher outra.')) return
    aoRemoverFoto()
    definirSetasAbertas(false)
    definirEscolhido(null)
  }

  /** O nome só com letras que o PDF sabe escrever; avisa quando tira alguma. */
  function escrever(texto: string) {
    const limpo = nomeImprimivel(texto)
    aoErrar(limpo !== texto ? 'Emojis e símbolos especiais não podem ser impressos no cartão.' : null)
    aoMudar({ nome: limpo })
  }

  const modelo = modelos[indice]
  const total = modelos.length
  const temFoto = Boolean(foto)

  if (!modelo) return <p className="cartoes-ajuda">Carregando os cartões…</p>

  return (
    <div className="ce" onPointerDown={() => definirEscolhido(null)}>
      {/*
        A FOTO ABRE-SE AQUI E FICA AQUI.

        Este campo entrega o ficheiro ao `aoEscolherFoto`, que o abre em memória
        (ver `abrirFoto`). Não há envio: ver a rede enquanto se escolhe a foto
        mostra zero pedidos.
      */}
      <input
        ref={ficheiro}
        type="file"
        accept="image/*"
        className="apenas-leitor-de-ecra"
        onChange={(ev) => {
          const f = ev.target.files?.[0]
          if (f) aoEscolherFoto(f)
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
              foto={foto}
              modelo={m}
              ajuste={ajuste}
              nome={nome}
              tamanho={tamanho}
              alinhamento={alinhamento}
              cor={cor}
              medir={medir}
              editavel={i === indice}
              aoAmpliar={(foco) => {
                definirFocoDaLupa(foco)
                definirLupaAberta(true)
              }}
              escolhido={i === indice ? escolhido : null}
              aEnviar={aAbrirFoto}
              aoEscolher={definirEscolhido}
              aoMexer={mexer}
              aoEscrever={escrever}
              barraDaFoto={
                setasAbertas && temFoto ? (
                  /*
                    O "MOVER" TROCA A BARRA POR UMA FILA DE SETAS.

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
                    desactivado={!temFoto || ajuste.escala >= zoomMaximo - 0.001}
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
                    aoTocar={() => aoMudar({ tamanhoDoNome: Math.max(0, Number((tamanho - 0.1).toFixed(2))) })}
                  />
                  <Botao
                    rotulo="Maior"
                    simbolo="A+"
                    desactivado={tamanho >= 1}
                    aoTocar={() => aoMudar({ tamanhoDoNome: Math.min(1, Number((tamanho + 0.1).toFixed(2))) })}
                  />
                  {(['ESQUERDA', 'CENTRO', 'DIREITA'] as const).map((a) => (
                    <Botao
                      key={a}
                      rotulo={a === 'ESQUERDA' ? 'Esquerda' : a === 'CENTRO' ? 'Centro' : 'Direita'}
                      simbolo={a === 'ESQUERDA' ? '⬱' : a === 'CENTRO' ? '⬍' : '⬲'}
                      activo={alinhamento === a}
                      aoTocar={() => aoMudar({ nomeAlinhamento: a })}
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
                          definirPaletaAberta(false)
                          aoMudar({ nomeCorHex: c.hex })
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
          foco={focoDaLupa}
        >
          <CartaoDesenhado
            foto={foto}
            modelo={modelo}
            ajuste={ajuste}
            nome={nome}
            tamanho={tamanho}
            alinhamento={alinhamento}
            cor={cor}
            medir={medir}
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
        A QUALIDADE DE IMPRESSÃO, DEPOIS DO CORTE (03/10).

        "Qualidade para A4: medir os pixels depois do corte. Ideal 300 dpi (…),
        mínimo 200 dpi." Medida a cada mexida, no cartão que pede mais.

        05/10: UM VEREDITO SÓ, com a nitidez junto. Eram duas linhas — "boa
        (200 dpi)" e, por baixo, "parece desfocada" — e ele achou-as
        contraditórias. Sem números à vista: "o sistema analisa tudo e
        simplesmente informa se a foto está aprovada". Ver `veredito`.
      */}
      {foto && vereditoAgora && (
        <p
          className={`ce-qualidade ${vereditoAgora.nivel.toLowerCase()}`}
          title={`${vereditoAgora.dpi} dpi no cartão que pede mais`}
        >
          <span className="ce-qualidade-icone" aria-hidden="true">
            {vereditoAgora.nivel === 'APROVADA' ? '✅' : vereditoAgora.nivel === 'ACEITAVEL' ? '⚠️' : '❌'}
          </span>
          <span className="ce-qualidade-texto">{vereditoAgora.texto}</span>
          {ajuste.escala >= zoomMaximo - 0.001 && zoomMaximo < 6 && (
            <span className="ce-qualidade-nota">
              Este é o zoom máximo para a foto continuar nítida no papel.
            </span>
          )}
        </p>
      )}

      <div className="ce-accoes-da-folha">
        <button
          type="button"
          className="ce-botao-accao ce-ver-grande"
          aria-label="Ver o cartão em tamanho grande"
          onClick={() => {
            definirFocoDaLupa(null)
            definirLupaAberta(true)
          }}
        >
          <span className="ce-botao-medalha" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M20 20l-4.6-4.6" />
              <path d="M10.5 7.8v5.4M7.8 10.5h5.4" />
            </svg>
          </span>
          Ampliar
        </button>
        {temFoto ? (
          <button
            type="button"
            className="ce-botao-accao perigo ce-remover-foto"
            aria-label="Remover a foto"
            disabled={aAbrirFoto}
            onClick={removerFoto}
          >
            <span className="ce-botao-medalha" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 7h15" />
                <path d="M9.5 7V4.8h5V7" />
                <path d="M6.6 7l.9 12.2h9l.9-12.2" />
                <path d="M10.2 10.8v5M13.8 10.8v5" />
              </svg>
            </span>
            Remover foto
          </button>
        ) : null}
      </div>

      {/*
        A PROMESSA, À VISTA ENQUANTO SE ESCOLHE A FOTO (03/10).

        É a frase que ele pediu, e é verdade a partir deste ecrã: a foto abre-se
        neste aparelho e não sai dele.
      */}
      <p className="ce-privacidade">
        <span aria-hidden="true">🔒</span> A foto não é enviada nem guardada: fica só neste aparelho
        enquanto você personaliza.
      </p>

      <button
        type="button"
        className="cartoes-accao ce-salvar"
        disabled={aSalvar || !temFoto || !nome.trim()}
        onClick={aoSalvar}
      >
        {aSalvar ? 'Aguarde…' : rotuloDeSalvar}
      </button>
      {(!temFoto || !nome.trim()) && (
        <p className="cartoes-ajuda ce-falta">
          {!temFoto && !nome.trim()
            ? 'Toque na foto para escolher uma, e no nome para o escrever.'
            : !temFoto
              ? 'Toque na área da foto para escolher a fotografia.'
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
  foto,
  modelo,
  ajuste,
  nome,
  tamanho,
  alinhamento,
  cor,
  medir,
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
  foto: FotoNoAparelho | null
  modelo: ModeloDeCartao
  ajuste: Ajuste
  nome: string
  tamanho: number
  alinhamento: AlinhamentoDoNome
  cor: string | null
  /** A régua do nome: a do PDF, ou a de reserva enquanto ela não chega. */
  medir: (texto: string) => number
  editavel: boolean
  /** Na lupa: por cima da arte leve, a de 300 dpi, que chega quando chegar. */
  altaResolucao?: boolean
  escolhido: Escolhido
  aEnviar: boolean
  aoEscolher: (e: Escolhido) => void
  aoMexer: (m: Partial<Ajuste>) => void
  aoEscrever: (t: string) => void
  /**
   * Ausente dentro da própria lupa: ali não há nada para ampliar outra vez.
   * Recebe o ponto tocado, para a lupa abrir já nessa caixa.
   */
  aoAmpliar?: (foco: FocoDaLupa) => void
  barraDaFoto: React.ReactNode
  barraDoNome: React.ReactNode
  paleta: React.ReactNode
}) {
  const folha = useRef<HTMLDivElement | null>(null)
  const pousou = useRef<{ x: number; y: number } | null>(null)
  const ultimoToque = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 })

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

  const rect = foto
    ? enquadrar({ largura: molduraLargura, altura: molduraAltura }, { largura: foto.largura, altura: foto.altura }, ajuste)
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
        medir,
      ),
    [modelo.nomeCaixa, texto, tamanho, medir],
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
        // Um toque duplo é no MESMO sítio: tocar no nome e logo a seguir na foto
        // são dois toques, e abriam a lupa por engano.
        const anterior = ultimoToque.current
        const perto = Math.hypot(ev.clientX - anterior.x, ev.clientY - anterior.y) < 40
        if (agora - anterior.t < TOQUE_DUPLO_MS && perto) {
          ultimoToque.current = { t: 0, x: 0, y: 0 }
          // "Quando eu clico na caixa 1 para ampliar, ela precisa abrir
          // centralizada exatamente na caixa 1" — 28/09. Vai o sítio do toque.
          const r = ev.currentTarget.getBoundingClientRect()
          aoAmpliar({ fx: (ev.clientX - r.left) / r.width, fy: (ev.clientY - r.top) / r.height })
        } else {
          ultimoToque.current = { t: agora, x: ev.clientX, y: ev.clientY }
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
      {/*
        O PDF DO DESIGNER, DE PERTO.

        "a qualidade das artes precisa ser exatamente a qualidade original
        enviada pelo designer" — 28/09. Na lupa, os ladrilhos que o servidor
        desenhou do PDF (ver `ArteEmMosaico`), por cima da JPEG de 300 dpi: a
        1000 dpi, e em fracções de segundo mesmo no iPhone.

        No editor a folha é pequena, e a imagem leve (1200 pixéis) já tem mais
        do que o ecrã mostra. O PDF desenhado no navegador (`ArteEmPdf`) fica
        só para os minutos em que uma arte acabada de carregar ainda não tem
        ladrilhos — e fora do iPhone, onde desenhá-lo demora 10 segundos.
      */}
      {modelo.arteMosaico && altaResolucao ? (
        <ArteEmMosaico mosaico={modelo.arteMosaico} larguraDaBase={modelo.arteLupaUrl ? 2480 : 1200} />
      ) : !modelo.arteMosaico && modelo.artePdfUrl && (editavel || altaResolucao) ? (
        <ArteEmPdf url={modelo.artePdfUrl} />
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
            // A cópia leve no cartão; na lupa, a inteira (é lá que se confere a nitidez).
            src={altaResolucao ? foto?.url : foto?.urlDaPrevia}
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
            {aEnviar ? 'Abrindo…' : 'Sua foto aqui'}
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
            /*
              O IPHONE AMPLIA A PÁGINA INTEIRA ao escrever num campo com letra
              abaixo de 16px, e não a volta a afastar. Com a página ampliada, a
              lupa abria maior do que o ecrã: o lado direito do cartão e o ✕
              ficavam fora (29/09). A letra do campo passa a ter pelo menos
              16px, e o campo encolhe por escala até ao tamanho do nome no
              cartão: o mesmo desenho, sem o zoom do Safari.
            */
            style={{
              fontSize: `${Math.max(16, emPx(corpo))}px`,
              ...(emPx(corpo) < 16
                ? {
                    flex: 'none',
                    width: `${(100 * 16) / emPx(corpo)}%`,
                    transform: `scale(${emPx(corpo) / 16})`,
                    transformOrigin: 'left center',
                  }
                : null),
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
