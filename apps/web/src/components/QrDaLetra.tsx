'use client'

import { admin } from '@/lib/admin'

/**
 * O QR de uma letra, com as duas formas de o levar dali para fora.
 *
 * O QR PERTENCE À LETRA, E NÃO AO CARTÃO DE IMPRESSÃO.
 *
 * Ontem eu pu-lo dentro do editor do cartão de impressão, que é onde ele estava
 * a olhar quando se queixou de não o encontrar. Só que as letras B e C ainda não
 * têm cartão de impressão criado, e por isso não havia por onde lá chegar. Ele
 * voltou a dizer o mesmo em 27/08, e desta vez sobre outras letras. O QR é criado
 * com a letra, existe desde então, e passa a aparecer onde a letra aparece.
 *
 * DOIS FORMATOS PORQUE SERVEM PARA COISAS DIFERENTES. O vectorial é o que a
 * gráfica amplia para um cartaz sem serrilhar. O PNG é o que se envia por
 * mensagem: ele tentou mandar o vectorial pelo WhatsApp e do outro lado não
 * apareceu nada, porque o WhatsApp trata o SVG como documento e não o desenha.
 */
export function QrDaLetra({
  projectSlug,
  contentSlug,
  letra,
}: {
  projectSlug: string
  contentSlug: string | null
  letra: string
}) {
  const nome = letra ? `Letra ${letra}` : 'esta publicação'

  if (!contentSlug) {
    return (
      <section className="bloco-qr">
        <h3>QR CODE DA {letra ? `LETRA ${letra}` : 'PUBLICAÇÃO'}</h3>
        <p className="nota-qr">
          O QR nasce com a letra. Assim que esta tiver o primeiro cartão, ele aparece aqui.
        </p>
      </section>
    )
  }

  const svg = admin.urlQrSvg(projectSlug, contentSlug)
  const png = admin.urlQrPng(projectSlug, contentSlug)

  return (
    <section className="bloco-qr">
      <h3>QR CODE DA {letra ? `LETRA ${letra}` : 'PUBLICAÇÃO'}</h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="imagem-qr" src={svg} alt={`QR Code da ${nome}`} />
      <p className="nota-qr">Este é o código que leva à {nome}.</p>
      <div className="linha-acoes centrada">
        <a className="botao-acao" href={png} download={`qr-letra-${letra.toLowerCase()}.png`}>
          ⬇ PNG (WhatsApp)
        </a>
        <a className="botao-acao" href={svg} download={`qr-letra-${letra.toLowerCase()}.svg`}>
          ⬇ SVG (gráfica)
        </a>
      </div>
    </section>
  )
}
