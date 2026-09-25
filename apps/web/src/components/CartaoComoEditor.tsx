'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { A4_MM, ajusteNeutro, corpoDoNome, enquadrar, type Ajuste } from '@pv/cartoes'
import {
  cartoes,
  type AlinhamentoDoNome,
  type CriancaDoPedido,
  type ModeloDeCartao,
} from '@/lib/cartoes'

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
  aoMudarCrianca,
  aoErrar,
  aoSalvar,
  aSalvar,
}: {
  projectSlug: string
  pedidoId: string
  crianca: CriancaDoPedido
  modelos: ModeloDeCartao[]
  aoMudarCrianca: (c: CriancaDoPedido) => void
  aoErrar: (m: string | null) => void
  aoSalvar: () => void
  aSalvar: boolean
}) {
  const [indice, definirIndice] = useState(0)
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

  const mexer = useCallback(
    (mudanca: Partial<Ajuste>) => {
      const novo = {
        escala: Math.min(6, Math.max(1, mudanca.escala ?? ajuste.escala)),
        deslocX: Math.min(1, Math.max(-1, mudanca.deslocX ?? ajuste.deslocX)),
        deslocY: Math.min(1, Math.max(-1, mudanca.deslocY ?? ajuste.deslocY)),
      }
      definirAjuste(novo)
      gravar(novo)
    },
    [ajuste, gravar],
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
        // Arrastar ao lado só troca de cartão quando NADA está escolhido. Com a
        // foto escolhida, o mesmo gesto move a foto — e os dois não podem
        // disputar o dedo.
        activo={escolhido === null}
        aoTrocar={definirIndice}
      >
        {modelos.map((m, i) => (
          <div className="ce-casa" key={m.id} aria-hidden={i !== indice}>
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
              escolhido={i === indice ? escolhido : null}
              aEnviar={aEnviar}
              aoEscolher={definirEscolhido}
              aoMexer={mexer}
              aoEscrever={(t) => {
                definirNome(t)
                gravar({ nome: t })
              }}
              barraDaFoto={
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
              }
              setas={
                setasAbertas && temFoto ? (
                  /*
                    O "Mover" abre setas em vez de só dizer "arraste".

                    Arrastar já funciona — é o gesto principal. Mas num cartão
                    onde a moldura tem 4 cm, acertar um milímetro com o polegar
                    é uma luta, e há quem não consiga arrastar de todo. As setas
                    dão o mesmo resultado em passos iguais.
                  */
                  <div className="ce-setas" onPointerDown={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Mover para cima" onClick={() => mexer({ deslocY: ajuste.deslocY - PASSO_DE_EMPURRAO })}>↑</button>
                    <button type="button" aria-label="Mover para a esquerda" onClick={() => mexer({ deslocX: ajuste.deslocX - PASSO_DE_EMPURRAO })}>←</button>
                    <button type="button" aria-label="Mover para a direita" onClick={() => mexer({ deslocX: ajuste.deslocX + PASSO_DE_EMPURRAO })}>→</button>
                    <button type="button" aria-label="Mover para baixo" onClick={() => mexer({ deslocY: ajuste.deslocY + PASSO_DE_EMPURRAO })}>↓</button>
                  </div>
                ) : null
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
  activo,
  aoTrocar,
  children,
}: {
  indice: number
  total: number
  activo: boolean
  aoTrocar: (i: number) => void
  children: React.ReactNode
}) {
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const [puxao, definirPuxao] = useState(0)

  return (
    <div
      className="ce-faixa"
      onPointerDown={(ev) => {
        if (!activo) return
        inicio.current = { x: ev.clientX, y: ev.clientY }
      }}
      onPointerMove={(ev) => {
        if (!inicio.current) return
        const dx = ev.clientX - inicio.current.x
        // Um gesto que desce mais do que anda ao lado é a página a rolar, e
        // roubá-lo prendia a pessoa no carrossel.
        if (Math.abs(ev.clientY - inicio.current.y) > Math.abs(dx)) {
          inicio.current = null
          definirPuxao(0)
          return
        }
        definirPuxao(dx)
      }}
      onPointerUp={() => {
        const dx = puxao
        inicio.current = null
        definirPuxao(0)
        if (dx <= -ARRASTO_QUE_TROCA && indice < total - 1) aoTrocar(indice + 1)
        if (dx >= ARRASTO_QUE_TROCA && indice > 0) aoTrocar(indice - 1)
      }}
      onPointerCancel={() => {
        inicio.current = null
        definirPuxao(0)
      }}
    >
      <div
        className="ce-trilho"
        style={{
          transform: `translateX(calc(${-indice * 100}% + ${puxao}px))`,
          transition: puxao ? 'none' : 'transform 0.28s ease',
        }}
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
  escolhido,
  aEnviar,
  aoEscolher,
  aoMexer,
  aoEscrever,
  barraDaFoto,
  barraDoNome,
  setas,
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
  escolhido: Escolhido
  aEnviar: boolean
  aoEscolher: (e: Escolhido) => void
  aoMexer: (m: Partial<Ajuste>) => void
  aoEscrever: (t: string) => void
  barraDaFoto: React.ReactNode
  barraDoNome: React.ReactNode
  setas: React.ReactNode
  paleta: React.ReactNode
}) {
  const folha = useRef<HTMLDivElement | null>(null)
  const arrasto = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)
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

  const corpo = useMemo(
    () =>
      corpoDoNome(
        {
          largura: modelo.nomeCaixa.largura,
          altura: modelo.nomeCaixa.altura,
          corpoMinimo: modelo.nomeCaixa.corpoMinimo,
          corpoMaximo: modelo.nomeCaixa.corpoMaximo,
        },
        nome || 'Seu nome aqui',
        tamanho,
        medirEmArialBold,
      ),
    [modelo.nomeCaixa, nome, tamanho],
  )

  const texto = modelo.nomeCaixa.maiusculas ? nome.toLocaleUpperCase('pt-BR') : nome

  return (
    <div ref={folha} className="ce-folha" style={{ height: `${altura}px` }}>
      {modelo.arteUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={modelo.arteUrl} alt={`Dia ${modelo.dia} — ${modelo.nome}`} className="ce-arte" />
      ) : (
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
        onPointerDown={(ev) => {
          if (!editavel) return
          ev.stopPropagation()
          aoEscolher('foto')
          if (!rect) return
          arrasto.current = { x: ev.clientX, y: ev.clientY, dx: ajuste.deslocX, dy: ajuste.deslocY }
          ev.currentTarget.setPointerCapture(ev.pointerId)
        }}
        onPointerMove={(ev) => {
          if (!arrasto.current) return
          const i = arrasto.current
          aoMexer({
            deslocX: i.dx + (ev.clientX - i.x) / molduraLargura,
            deslocY: i.dy + (ev.clientY - i.y) / molduraAltura,
          })
        }}
        onPointerUp={() => {
          arrasto.current = null
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
          style={{ top: `${emPx(modelo.moldura.y)}px`, left: '50%' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {barraDaFoto}
          {setas}
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
          if (!editavel) return
          ev.stopPropagation()
          aoEscolher('nome')
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

              Estava a um corpo fixo e saa cortado — "EU NOME AQ" — numa caixa
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
