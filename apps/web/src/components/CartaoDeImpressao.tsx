'use client'

import { useState } from 'react'
import { rastrear } from '@/lib/track'
import { IndicadoresDaPublicacao } from './IndicadoresDaPublicacao'

/**
 * O cartão de impressão da letra — uma peça inteira, como as outras.
 *
 * A versão anterior desenhava aqui a capa da letra outra vez, e era essa a
 * "fotografia sozinha mais abaixo" de que ele se queixou em 23/08: uma imagem
 * sem áudio, sem título e sem texto, no meio de uma página feita só de peças
 * inteiras. Tinha razão — o defeito não era o espaçamento, era eu continuar a
 * montar coisas a partir de pedaços soltos.
 *
 * Agora não existe até ele o criar no painel, e só aparece quando tem arte
 * própria. A ordem é a dele: arte promocional na largura do cartão, a folha A4,
 * o botão de imprimir, os indicadores, e só depois a letra seguinte.
 *
 * O CONTADOR SÓ SOBE COM ACÇÃO CONCLUÍDA — regra dele desde 20/08, quando tocou
 * várias vezes no botão e viu o número subir sem ter impresso nada.
 */
export function CartaoDeImpressao({
  projectId,
  contentId,
  blockId,
  projectSlug,
  titulo,
  letra,
  ficheiro,
  nomeDoFicheiro,
  arte,
  folhaA4,
  linkUpgrade,
}: {
  projectId: string
  contentId: string
  blockId: string
  projectSlug: string
  titulo: string
  letra: string
  ficheiro: string | null
  nomeDoFicheiro: string | null
  arte: string
  folhaA4: string | null
  linkUpgrade: string | null
}) {
  const [aviso, definirAviso] = useState<string | null>(null)
  const nome = letra ? `Letra ${letra}` : titulo

  async function contar(via: string) {
    try {
      await rastrear({ projectId, contentId, type: 'CUSTOM', props: { acao: 'imprimir', via } })
    } catch {
      // Falhar a contar não pode impedir a acção que a pessoa pediu.
    }
  }

  function imprimirAgora() {
    // `afterprint` dispara quando a caixa do sistema se fecha. Não garante que
    // saiu papel — nada garante — mas garante que a pessoa chegou ao fim.
    const aoTerminar = () => {
      window.removeEventListener('afterprint', aoTerminar)
      void contar('impressora')
      definirAviso('Obrigado por imprimir.')
    }
    window.addEventListener('afterprint', aoTerminar)
    window.print()
  }

  return (
    <article className="publicacao cartao-impressao" id={`impressao-${blockId}`}>
      <div className="peca-visual">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="foto-publicacao" src={arte} alt={`Cartão da ${nome}`} />
        {folhaA4 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-publicacao folha-a4" src={folhaA4} alt={`Folha A4 da ${nome}`} />
        )}
        <div className="faixa-imprimir">
          {ficheiro ? (
            <a
              className="botao-imprimir"
              href={ficheiro}
              download={nomeDoFicheiro ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void contar('download')}
            >
              🖨 IMPRIMIR GRÁTIS
            </a>
          ) : (
            <button type="button" className="botao-imprimir" onClick={imprimirAgora}>
              🖨 IMPRIMIR GRÁTIS
            </button>
          )}
        </div>
      </div>

      <IndicadoresDaPublicacao
        alvo={{ tipo: 'faixa', blockId }}
        projectId={projectId}
        projectSlug={projectSlug}
        titulo={`Cartão da ${nome}`}
        ligacao={`/${projectSlug}#impressao-${blockId}`}
      />

      {aviso && <p className="nota-ok">{aviso}</p>}

      {linkUpgrade && (
        <a
          className="botao-upgrade"
          href={linkUpgrade}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            void rastrear({ projectId, contentId, type: 'CUSTOM', props: { acao: 'upgrade' } })
          }
        >
          👑 FAZER UPGRADE
        </a>
      )}
    </article>
  )
}
