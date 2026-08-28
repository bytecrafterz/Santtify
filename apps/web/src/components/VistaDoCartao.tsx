'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

/**
 * A folha A4 na tela, e as quatro coisas que se fazem com ela.
 *
 * IMPRIMIR ABRE O PDF, e não manda imprimir esta página. É a mesma decisão de
 * 26/08 e pela mesma razão: o navegador imprime o que está no ecrã, e o que
 * está no ecrã tem botões. O PDF só tem o cartão, e sai numa folha certa em
 * qualquer impressora.
 *
 * COMPARTILHAR usa a partilha do próprio telemóvel quando existe, que é a que
 * já tem o WhatsApp dele lá dentro. Onde não existe, copia o endereço, porque
 * um botão que não faz nada é pior do que um botão que faz o mínimo.
 */
export function VistaDoCartao({
  projectSlug,
  contentSlug,
  letra,
  titulo,
  folha,
}: {
  projectSlug: string
  contentSlug: string
  letra: string
  titulo: string
  folha: string
}) {
  const router = useRouter()
  const [aviso, definirAviso] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aTrabalhar, definirATrabalhar] = useState(false)
  const nome = letra ? `Letra ${letra}` : titulo
  const pdfParaBaixar = api.cartaoPdfUrl(projectSlug, contentSlug, true)
  const nomeDoFicheiro = `cartao-${letra ? `letra-${letra.toLowerCase()}` : contentSlug}.pdf`

  /**
   * O PDF É BUSCADO ANTES DE ALGUÉM TOCAR EM ALGUMA COISA.
   *
   * Esta é a correcção do defeito que ele descreveu três vezes e que eu não
   * tinha encontrado: "não estou conseguindo fazer corretamente essas ações".
   *
   * `navigator.share()` no iOS só abre se for chamado enquanto ainda vale o
   * toque da pessoa. O código buscava o PDF primeiro e partilhava a seguir, e
   * numa ligação de dados móveis essa busca demora o suficiente para o iPhone
   * dar o toque por terminado. A partilha era recusada, a alternativa seguinte
   * era recusada pela mesma razão, e o `catch` engolia tudo: o botão respondia
   * e não acontecia absolutamente nada.
   *
   * Não era o Safari contra a aplicação instalada, que foi onde procurei
   * primeiro. Falhava nos dois, e é por isso que a correcção de 27/08 não lhe
   * mudou nada.
   *
   * Buscado aqui, o ficheiro já está em memória quando ela toca, e a partilha
   * acontece dentro do toque.
   */
  const ficheiro = useRef<File | null>(null)
  const [pronto, definirPronto] = useState(false)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const resposta = await fetch(pdfParaBaixar)
        if (!resposta.ok) throw new Error('sem ficheiro')
        const blob = await resposta.blob()
        if (!vivo) return
        ficheiro.current = new File([blob], nomeDoFicheiro, { type: 'application/pdf' })
        definirPronto(true)
      } catch {
        // Sem rede: BAIXAR PDF continua a funcionar, que é um endereço directo
        // e não depende disto. O botão de partilhar dirá o que se passa.
      }
    })()
    return () => {
      vivo = false
    }
  }, [pdfParaBaixar, nomeDoFicheiro])

  /**
   * DENTRO DA APLICAÇÃO INSTALADA NO IPHONE NÃO EXISTE IMPRESSÃO.
   *
   * `window.print()` é ignorado em silêncio num web app em ecrã inteiro no iOS:
   * não há barra do navegador, e por isso não há para onde abrir a caixa de
   * impressão. O botão respondia e não acontecia nada, que é exactamente o que
   * ele descreveu em 27/08: "não consigo concluir a impressão".
   *
   * No iOS o sítio onde vive o Imprimir é a folha de partilha do sistema. Por
   * isso, aí, imprimir e enviar são o mesmo gesto: entrega-se o PDF ao telemóvel
   * e ele oferece Imprimir, WhatsApp, Ficheiros e o resto.
   */
  const dentroDaAppNoIphone =
    typeof navigator !== 'undefined' &&
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  /**
   * Entrega o FICHEIRO, e não o endereço.
   *
   * Ele foi explícito em 28/08: "quero compartilhar o cartão/PDF em si, e não
   * simplesmente o endereço da página". Quem recebia um link tinha de abrir o
   * site, encontrar o cartão e imprimir.
   *
   * NADA AQUI FALHA EM SILÊNCIO. Cada caminho que não dá certo escreve no ecrã
   * o que aconteceu e para onde ir a seguir. Um botão que responde e não faz
   * nada é o pior dos dois mundos: a pessoa não sabe se esperou pouco, se
   * carregou mal, ou se o site está partido. Foi o que lhe aconteceu.
   */
  async function entregarFicheiro(): Promise<boolean> {
    definirErro(null)
    definirAviso(null)

    // Cancelar a folha de partilha do sistema não é um erro, é uma decisão.
    const cancelou = (e: unknown) => e instanceof Error && e.name === 'AbortError'

    const f = ficheiro.current
    if (f && navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: `Cartão da ${nome}` })
        return true
      } catch (e) {
        if (cancelou(e)) return true
        // Cai para o endereço em baixo, mas sem fingir que correu bem.
      }
    }

    const endereco = typeof window === 'undefined' ? '' : window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: `Cartão da ${nome}`, url: endereco })
        definirAviso('Enviei o endereço do cartão. Para enviar o ficheiro, use BAIXAR PDF.')
        return true
      } catch (e) {
        if (cancelou(e)) return true
      }
    }

    try {
      await navigator.clipboard.writeText(endereco)
      definirAviso('Endereço copiado. É só colar onde quiser enviar.')
      return true
    } catch {
      definirErro('Este telemóvel não deixou partilhar daqui. Use BAIXAR PDF e envie o ficheiro.')
      return false
    }
  }

  async function partilhar() {
    if (!pronto) {
      definirErro('O cartão ainda está a carregar. Tente outra vez daqui a um instante.')
      return
    }
    definirATrabalhar(true)
    try {
      await entregarFicheiro()
    } finally {
      definirATrabalhar(false)
    }
  }

  async function imprimir() {
    if (!dentroDaAppNoIphone) {
      window.print()
      return
    }
    /*
      Na aplicação instalada no iPhone não há caixa de impressão: sem barra de
      navegador não há para onde ela abrir, e `window.print()` é ignorado sem
      dizer nada. No iOS o Imprimir vive dentro da folha de partilha, por isso
      aqui imprimir e enviar são o mesmo gesto.
    */
    if (!pronto) {
      definirErro('O cartão ainda está a carregar. Tente outra vez daqui a um instante.')
      return
    }
    definirATrabalhar(true)
    definirAviso('Escolha Imprimir na lista que vai abrir.')
    try {
      const correu = await entregarFicheiro()
      if (!correu) definirAviso(null)
    } finally {
      definirATrabalhar(false)
    }
  }

  return (
    <main className="vista-cartao">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="folha-do-cartao" src={folha} alt={`Cartão da ${nome} em folha A4`} />

      {/*
        A MESMA FOLHA, EM RESOLUÇÃO DE PAPEL, só para a impressora.

        A de cima tem 1200px, que é o certo para o telemóvel e sairia a cerca de
        cem linhas por polegada numa A4. Esta tem 2480px, que é A4 a 300, e o
        navegador só a vai buscar quando alguém manda imprimir: `loading="lazy"`
        com `display: none` fora da impressão evita gastar os dados de quem só
        quer ver.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="folha-para-papel"
        src={api.cartaoImagemUrl(projectSlug, contentSlug)}
        alt=""
        aria-hidden
        loading="lazy"
      />

      {/* O que aconteceu, dito onde ela está a olhar. Antes destas duas linhas,
          um caminho que falhasse não escrevia nada em lado nenhum. */}
      {aviso && <p className="nota-ok">{aviso}</p>}
      {erro && <p className="erro">{erro}</p>}

      <div className="acoes-do-cartao">
        <button
          type="button"
          className="acao-do-cartao"
          onClick={() => {
            // `back()` respeita de onde a pessoa veio. Quem chegou por um
            // endereço directo não tem para onde voltar, e por isso há destino.
            if (window.history.length > 1) router.back()
            else router.push(`/${projectSlug}`)
          }}
        >
          <span aria-hidden>←</span>
          VOLTAR
        </button>

        <a
          className="acao-do-cartao"
          href={pdfParaBaixar}
          download={`cartao-${letra ? `letra-${letra.toLowerCase()}` : contentSlug}.pdf`}
        >
          <span aria-hidden>⬇</span>
          BAIXAR PDF
        </a>

        {/*
          IMPRIMIR NÃO SAI DESTA PÁGINA.

          Abria o PDF noutro separador. No navegador dá para fechar; dentro da
          aplicação instalada NÃO HÁ SEPARADOR NEM BOTÃO DE VOLTAR, e ele ficou
          presto num visualizador sem saída. Escreveu em 27/08: "abre uma página
          de envio, mas depois fico preso nela". O que ele estava a ver era o
          leitor de PDF do sistema, não uma página nossa, e por isso não tinha
          como cancelar.

          Agora manda imprimir ESTA página. A folha de impressão do telemóvel
          abre por cima, e cancelar devolve a pessoa aqui, com o VOLTAR ao lado.
          O estilo de impressão esconde tudo menos a folha, e usa a cópia em
          resolução de papel, não a que se vê no ecrã.
        */}
        <button
          type="button"
          className="acao-do-cartao"
          disabled={aTrabalhar}
          onClick={() => void imprimir()}
        >
          <span aria-hidden>🖨</span>
          IMPRIMIR
        </button>

        <button
          type="button"
          className="acao-do-cartao"
          disabled={aTrabalhar}
          onClick={() => void partilhar()}
        >
          <span aria-hidden>↗</span>
          {aTrabalhar ? 'A PREPARAR...' : 'COMPARTILHAR'}
        </button>
      </div>
    </main>
  )
}
