'use client'

import Link from 'next/link'

/**
 * O convite para criar conta, quando um visitante toca no que exige conta.
 *
 * Antes, tocar em curtir sem sessão mostrava uma linha cinzenta a dizer que
 * era preciso entrar. O cliente leu isso como um botão avariado — e tinha
 * razão: um aviso discreto ao lado de um botão que não fez nada parece
 * defeito, não convite.
 *
 * O texto é o dele, palavra por palavra. E diz GRÁTIS de propósito: ouvir e
 * ver não custa nada, e a conta serve para guardar e interagir. Um visitante
 * que confunda o pedido de conta com um pedido de dinheiro fecha a página e
 * não volta.
 */
export function ConviteDeCadastro({
  projectSlug,
  motivo,
  aoFechar,
}: {
  projectSlug: string
  /** O que a pessoa tentou fazer, para o convite falar disso. */
  motivo?: string
  aoFechar: () => void
}) {
  return (
    <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Criar conta grátis">
      <button type="button" className="fundo-clicavel" aria-label="Fechar" onClick={aoFechar} />

      <div className="folha-denuncia convite-cadastro">
        <h2>{motivo ?? 'Gostou desta música?'}</h2>
        <p className="nota">
          Crie sua conta grátis para curtir, comentar, guardar seu progresso e ter acesso completo
          ao Santtify.
        </p>
        <p className="nota reforco">Ouvir e ver é grátis, e continua a ser.</p>

        <Link className="botao-acao largo" href={`/${projectSlug}/cadastrar`}>
          CRIAR CONTA GRÁTIS
        </Link>

        <Link className="botao-previsualizar centrado" href={`/${projectSlug}/entrar`}>
          JÁ TENHO UMA CONTA
        </Link>

        <button type="button" className="continuar-navegador discreto" onClick={aoFechar}>
          CONTINUAR EXPLORANDO
        </button>
      </div>
    </div>
  )
}
