'use client'

import { useState } from 'react'
import Link from 'next/link'
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
 *
 * IMPRIMIR NÃO MANDA IMPRIMIR ESTA PÁGINA. Mandava, e o que saiu do papel dele
 * em 26/08 foi o site todo com o cartão cortado ao meio. O navegador imprime o
 * que está no ecrã, e o que está no ecrã é uma página com cabeçalho, botões e
 * comentários. Agora abre-se um PDF feito no servidor que só tem o cartão, numa
 * folha A4 — um cartão, uma página, um ficheiro. Imprime igual em qualquer
 * telemóvel, e é o mesmo ficheiro que se guarda para enviar à gráfica.
 */
export function CartaoDeImpressao({
  projectId,
  contentId,
  blockId,
  projectSlug,
  contentSlug,
  titulo,
  letra,
  arte,
  folhaA4,
  linkUpgrade,
}: {
  projectId: string
  contentId: string
  blockId: string
  projectSlug: string
  contentSlug: string
  titulo: string
  letra: string
  arte: string
  folhaA4: string | null
  linkUpgrade: string | null
}) {
  const [aviso] = useState<string | null>(null)
  const nome = letra ? `Letra ${letra}` : titulo

  async function contar(via: string) {
    try {
      await rastrear({ projectId, contentId, type: 'CUSTOM', props: { acao: 'imprimir', via } })
    } catch {
      // Falhar a contar não pode impedir a acção que a pessoa pediu.
    }
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
        {/*
          Leva à página do cartão, e não ao PDF em bruto.

          O PDF continua a ser o ficheiro certo para imprimir e para a gráfica,
          mas abri-lo directamente no telemóvel é um beco: não há como voltar
          sem fechar o separador nem como partilhar sem descarregar antes. Ele
          pediu em 27/08 as quatro opções juntas, e é isso que essa página tem.
        */}
        <div className="faixa-imprimir">
          <Link
            className="botao-imprimir"
            href={`/${projectSlug}/${contentSlug}/cartao`}
            onClick={() => void contar('impressora')}
          >
            🖨 IMPRIMIR GRÁTIS
          </Link>
          {/*
            OS DOIS BOTÕES LEVAM AO MESMO SÍTIO, E É DE PROPÓSITO.

            Este apontava direto ao ficheiro PDF. Quem carregava nele caía num
            leitor de PDF em ecrã inteiro, sem voltar, sem partilhar e sem nada:
            "abre uma tela e fico praticamente preso nela", em 26/08. Eu tinha
            mudado o de imprimir e esquecido este, que é o que ele usou.

            A página do cartão é que tem as quatro saídas. Baixar é uma delas, e
            está lá dentro.
          */}
          <Link
            className="botao-imprimir secundario"
            href={`/${projectSlug}/${contentSlug}/cartao`}
            onClick={() => void contar('download')}
          >
            ⬇ BAIXAR EM PDF
          </Link>
        </div>
      </div>

      <IndicadoresDaPublicacao
        alvo={{ tipo: 'faixa', blockId }}
        projectId={projectId}
        projectSlug={projectSlug}
        titulo={`Cartão da ${nome}`}
        /*
          O CARTÃO PARTILHA A PÁGINA DO CARTÃO.

          Apontava para uma âncora na página inicial, e uma âncora não chega ao
          servidor: o cartão da mensagem saía com a capa do projeto. A página
          própria do cartão já traz o `cartao.jpg` no cartão da mensagem desde
          02/09, e é para lá que se manda quem recebe — que também é onde estão
          os botões de baixar e imprimir.
        */
        ligacao={`/${projectSlug}/${contentSlug}/cartao`}
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
