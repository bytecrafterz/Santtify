'use client'

import { useEffect, useMemo, useState } from 'react'
import { AvisoDaFoto } from './ConfirmarPersonalizacao'

/**
 * A ENTREGA, DESDE 03/10: O PDF ESTÁ NESTE APARELHO, E SÓ NELE.
 *
 * Antes eram ligações para o PDF guardado no servidor — baixar, WhatsApp com
 * uma ligação assinada, e-mail com a mesma ligação. Com o PDF montado no
 * telemóvel e nada guardado no servidor, não há ligação para mandar: manda-se
 * o próprio ficheiro. Por isso:
 *
 *   - BAIXAR guarda o PDF no aparelho (no iPhone, em Arquivos);
 *   - ENVIAR abre a folha de partilha do telemóvel com o ficheiro — WhatsApp,
 *     e-mail, AirDrop, a impressora, o que a pessoa tiver;
 *   - ABRIR mostra-o no visor do aparelho, de onde se imprime.
 *
 * E diz-se, com as palavras dele, que o ficheiro tem de ser guardado: fechar
 * esta página sem o guardar é perdê-lo, e voltar a gerá-lo pede a foto outra vez.
 */
export function EntregaDosCartoes({
  pdf,
  nomeDoArquivo,
  codigo,
  expiraEm,
}: {
  pdf: Blob
  nomeDoArquivo: string
  codigo: string | null
  expiraEm: string | null
}) {
  // O endereço nasce e morre no mesmo efeito. Criado num useMemo e largado na
  // limpeza do efeito, o React em desenvolvimento (que monta duas vezes)
  // largava-o logo à nascença, e o Baixar abria um endereço morto.
  const [url, definirUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(pdf)
    definirUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [pdf])

  const ficheiro = useMemo(() => new File([pdf], nomeDoArquivo, { type: 'application/pdf' }), [pdf, nomeDoArquivo])
  const [podePartilhar, definirPodePartilhar] = useState(false)
  useEffect(() => {
    definirPodePartilhar(
      typeof navigator !== 'undefined' && Boolean(navigator.canShare?.({ files: [ficheiro] })),
    )
  }, [ficheiro])
  const [aviso, definirAviso] = useState<string | null>(null)

  const megas = (pdf.size / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const prazo = expiraEm ? new Date(expiraEm).toLocaleDateString('pt-BR') : null

  return (
    <div className="entrega-dos-cartoes">
      <AvisoDaFoto />
      <p className="cartoes-ajuda">
        O arquivo ({megas} MB) existe só neste aparelho. Baixe ou envie agora para não perder.
      </p>

      <div className="entrega-accoes">
        <a className="cartoes-accao" href={url ?? undefined} download={nomeDoArquivo}>
          ⬇ Baixar o PDF
        </a>
        {podePartilhar && (
          <button
            type="button"
            className="cartoes-accao-secundaria"
            onClick={async () => {
              definirAviso(null)
              try {
                await navigator.share({ files: [ficheiro], title: 'Cartões personalizados' })
              } catch (e) {
                // Desistir de partilhar não é um erro a mostrar.
                if (e instanceof Error && e.name !== 'AbortError') {
                  definirAviso('Não foi possível abrir o envio. Baixe o PDF e envie pelo aplicativo.')
                }
              }
            }}
          >
            ↗ Enviar (WhatsApp, e-mail…)
          </button>
        )}
        <a className="cartoes-ligacao" href={url ?? undefined} target="_blank" rel="noreferrer">
          Abrir para imprimir
        </a>
      </div>
      {aviso && <p className="cartoes-erro">{aviso}</p>}

      {codigo && (
        <p className="cartoes-ajuda entrega-codigo">
          Perdeu o arquivo? Com o código de liberação <strong>{codigo}</strong> você gera de novo
          {prazo ? ` até ${prazo}` : ''}, neste ou em outro aparelho — é só escolher a foto outra vez.
        </p>
      )}
    </div>
  )
}
