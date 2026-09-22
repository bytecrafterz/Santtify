'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { karaoke, type FaixaAOuvir } from '@/lib/karaoke'

/**
 * UM BOTÃO, UM CLIQUE, E O KARAOKÊ PREPARA-SE SOZINHO.
 *
 * Ele pediu isto em 22/09, e a queixa é justa:
 *
 *   "Depois que eu publico uma música com a foto e clico em 'Cantar no Modo
 *    Karaokê', preciso fazer vários cliques e passar por outras telas. (...)
 *    Quero transformar isso em uma única ação. (...) Não tem problema se o
 *    processamento demorar."
 *
 * O que ele encontrava: o 🎤 do editor levava-o direito ao SINCRONIZADOR — a
 * ferramenta de marcar a letra à mão, que toca a música e pede que ele carregue
 * em "Marcar" no início de cada frase, uma a uma. Para uma música de seis
 * minutos são dezenas de toques.
 *
 * E o computador já sabia fazer isso sozinho desde 20/09. Só que o botão que o
 * mandava fazer vivia noutro ecrã — painel, Modo Karaokê, procurar a faixa na
 * lista — e ele nunca lá chegava por este caminho.
 *
 * Nada disto é novo por baixo: a fila, o ouvinte e a publicação automática da
 * letra já existiam. O que faltava era a porta estar onde ele está quando
 * acaba de publicar a música.
 *
 * ── PORQUE É UM BOTÃO E NÃO AUTOMÁTICO AO ENVIAR O ÁUDIO ─────────────
 *
 * Ouvir uma música ocupa o servidor durante mais ou menos o tempo da própria
 * música, num servidor de 4 GB onde o ouvinte já leva 1 GB. Começar sozinho a
 * cada áudio enviado faria uma troca de ficheiro a meio de uma correcção pôr o
 * servidor a trabalhar sem ninguém ter pedido. Ele pediu "um clique", e um
 * clique é o que fica.
 *
 * ── E A MÃO CONTINUA A PODER ENTRAR ──────────────────────────────────
 *
 * Com a letra no ar, o 🎤 volta a levar ao sincronizador: é lá que se corrige
 * uma palavra que o computador ouviu mal. O que deixa de acontecer é ele ser
 * mandado para lá quando não há letra nenhuma para corrigir.
 */

/** De quanto em quanto tempo se pergunta como vai a música. */
const INTERVALO_MS = 5000

export function PrepararKaraoke({
  blocoId,
  projectSlug,
}: {
  blocoId: string
  projectSlug: string
}) {
  const [faixa, definirFaixa] = useState<FaixaAOuvir | null>(null)
  const [aPedir, definirAPedir] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)
  /** Evita escrever estado depois de o ecrã ter mudado. */
  const vivo = useRef(true)

  const perguntar = useCallback(async () => {
    try {
      const r = await karaoke.andamento(projectSlug)
      if (!vivo.current) return
      definirFaixa(r.faixas.find((f) => f.id === blocoId) ?? null)
    } catch {
      /* Silêncio de propósito: isto é um extra ao lado do editor, e um aviso
         vermelho por o andamento não ter respondido uma vez assusta sem
         motivo. O botão continua lá. */
    }
  }, [projectSlug, blocoId])

  useEffect(() => {
    vivo.current = true
    void perguntar()
    return () => {
      vivo.current = false
    }
  }, [perguntar])

  /* Enquanto está na fila ou a ser ouvida, pergunta-se de novo. Quando acaba, o
     temporizador morre — não se fica a bater à porta do servidor para sempre. */
  const aTrabalhar = faixa?.estado === 'PENDENTE' || faixa?.estado === 'A_OUVIR'
  useEffect(() => {
    if (!aTrabalhar) return
    const t = setInterval(() => void perguntar(), INTERVALO_MS)
    return () => clearInterval(t)
  }, [aTrabalhar, perguntar])

  async function preparar() {
    definirAPedir(true)
    definirErro(null)
    definirAviso(null)
    try {
      const r = await karaoke.ouvirUma(blocoId)
      /* O servidor recusa educadamente quando já há letra escrita à mão, ou
         quando a música já foi ouvida. Isso não é um erro — é uma resposta, e
         ele tem de a ler. */
      if (r.ignorado) definirAviso(r.motivo ?? 'Esta música já tem letra.')
      await perguntar()
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível começar agora.')
    } finally {
      definirAPedir(false)
    }
  }

  // ── A letra está no ar: o 🎤 leva ao sítio de a corrigir ────────────
  if (faixa?.temLetra) {
    return (
      <div className="karaoke-a-preparar">
        <Link className="atalho-karaoke" href={`/${projectSlug}/admin/karaoke/${blocoId}`}>
          🎤 Karaokê no ar — tocar para acertar
        </Link>
      </div>
    )
  }

  // ── Está a ser preparada ────────────────────────────────────────────
  if (aTrabalhar) {
    const porcento = Math.max(0, Math.min(100, Math.round(faixa?.progresso ?? 0)))
    return (
      <div className="karaoke-a-preparar" role="status" aria-live="polite">
        <span className="karaoke-a-preparar-texto">
          🎤 Preparando seu Karaokê…
          {faixa?.estado === 'PENDENTE' ? ' (na fila)' : ` ${porcento}%`}
        </span>
        <span className="karaoke-a-preparar-trilha" aria-hidden>
          <span style={{ width: `${faixa?.estado === 'PENDENTE' ? 0 : porcento}%` }} />
        </span>
        <small>
          Pode sair desta página e voltar depois. O computador continua ouvindo a música.
        </small>
      </div>
    )
  }

  // ── Correu mal: diz o quê e deixa tentar de novo ────────────────────
  if (faixa?.estado === 'FALHOU') {
    return (
      <div className="karaoke-a-preparar">
        <span className="cartoes-erro">🎤 Não deu para escrever a letra: {faixa.erro}</span>
        <button type="button" className="atalho-karaoke" disabled={aPedir} onClick={() => void preparar()}>
          {aPedir ? 'Começando…' : 'Tentar outra vez'}
        </button>
      </div>
    )
  }

  // ── Ainda não há letra: o único botão que ele tem de tocar ──────────
  return (
    <div className="karaoke-a-preparar">
      <button type="button" className="atalho-karaoke" disabled={aPedir} onClick={() => void preparar()}>
        {aPedir ? '🎤 Começando…' : '🎤 Preparar o Modo Karaokê'}
      </button>
      {aviso && <small>{aviso}</small>}
      {erro && <span className="cartoes-erro">{erro}</span>}
      {!aviso && !erro && <small>O computador ouve a música e escreve a letra sozinho.</small>}
    </div>
  )
}
