'use client'

import { useState } from 'react'
import { rastrear } from '@/lib/track'
import { abreviar } from '@/lib/numeros'

/**
 * "Imprimir", com o contador público ao lado.
 *
 * O CONTADOR SÓ SOBE COM ACÇÃO CONCLUÍDA. A primeira versão contava o toque no
 * botão, e o cliente descobriu-o da pior maneira em 20/08: tocou várias vezes e
 * viu o número subir sem ter impresso nada. Um número que qualquer pessoa
 * consegue inflacionar tocando repetidamente não é uma métrica, é ruído — e
 * este é justamente o número que ele quer mostrar publicamente como prova de
 * que o material circula.
 *
 * Não existe forma honesta de saber se o papel saiu da impressora: o navegador
 * não conta isso a ninguém. O que dá para saber é se a pessoa levou a acção até
 * ao fim — fechou a caixa de impressão, concluiu a partilha, descarregou o
 * ficheiro. É isso que se conta, e é por isso que o rótulo fala de material
 * exportado e não de folhas impressas.
 */
export function BotaoImprimir({
  projectId,
  impressoes,
  ficheiro,
  nomeDoFicheiro,
}: {
  projectId: string
  impressoes: number
  /** Material pronto a descarregar, quando o cliente já o carregou. */
  ficheiro?: string | null
  nomeDoFicheiro?: string | null
}) {
  const [total, definirTotal] = useState(impressoes)
  const [aberto, definirAberto] = useState(false)
  const [aviso, definirAviso] = useState<string | null>(null)

  /** Um registo por acção concluída. Abrir o painel não conta. */
  async function contar(acao: string) {
    try {
      await rastrear({ projectId, type: 'CUSTOM', props: { acao: 'imprimir', via: acao } })
      definirTotal((n) => n + 1)
    } catch {
      // Falhar a contar não pode impedir a acção que a pessoa pediu.
    }
  }

  function imprimirAgora() {
    // `afterprint` dispara quando a caixa do sistema se fecha. Não garante que
    // saiu papel — nada garante — mas garante que a pessoa chegou ao fim do
    // caminho, que é o mais honesto que dá para medir daqui.
    const aoTerminar = () => {
      window.removeEventListener('afterprint', aoTerminar)
      void contar('impressora')
    }
    window.addEventListener('afterprint', aoTerminar)
    definirAberto(false)
    window.print()
  }

  async function partilhar() {
    const url = window.location.href
    try {
      if (navigator.share) {
        // Só conta se a partilha for mesmo concluída: cancelar rejeita a
        // promessa, e cancelar não é partilhar.
        await navigator.share({ url })
        await contar('partilha')
        definirAviso('Partilhado.')
      } else {
        await navigator.clipboard?.writeText(url)
        await contar('link')
        definirAviso('Link copiado.')
      }
      definirAberto(false)
    } catch {
      definirAviso(null)
    }
  }

  async function baixar() {
    if (!ficheiro) return
    await contar('download')
    definirAberto(false)
  }

  return (
    <div className="linha-acoes sem-margem">
      <button type="button" className="botao-acao" onClick={() => definirAberto(true)}>
        🖨 Imprimir
      </button>
      <span className="pilula-contador" title="Material exportado">
        🖨 {abreviar(total)}
      </span>
      {aviso && <span className="nota-ok">{aviso}</span>}

      {aberto && (
        <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Imprimir e exportar">
          <button
            type="button"
            className="fundo-clicavel"
            aria-label="Fechar"
            onClick={() => definirAberto(false)}
          />
          <div className="folha-denuncia">
            <header>
              <div>
                <h2>Imprimir e exportar</h2>
                <p className="nota">O contador só sobe quando a acção termina.</p>
              </div>
              <button
                type="button"
                className="fechar-x"
                aria-label="Fechar"
                onClick={() => definirAberto(false)}
              >
                ✕
              </button>
            </header>

            <ul className="motivos">
              {ficheiro && (
                <li>
                  <a
                    className="motivo"
                    href={ficheiro}
                    download={nomeDoFicheiro ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={baixar}
                  >
                    <span aria-hidden>⬇</span>
                    <span className="rotulo">Baixar o material em PDF</span>
                    <span aria-hidden>›</span>
                  </a>
                </li>
              )}
              <li>
                <button type="button" className="motivo" onClick={imprimirAgora}>
                  <span aria-hidden>🖨</span>
                  <span className="rotulo">Imprimir ou guardar como PDF</span>
                  <span aria-hidden>›</span>
                </button>
              </li>
              <li>
                <button type="button" className="motivo" onClick={partilhar}>
                  <span aria-hidden>↗</span>
                  <span className="rotulo">Partilhar no WhatsApp ou noutra aplicação</span>
                  <span aria-hidden>›</span>
                </button>
              </li>
            </ul>

            <p className="nota">
              Para enviar a uma gráfica, baixe o PDF e anexe-o no pedido. Assim que o cliente
              indicar uma gráfica parceira, ligamos aqui o envio directo.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
