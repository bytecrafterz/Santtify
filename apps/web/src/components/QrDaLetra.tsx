'use client'

import { admin } from '@/lib/admin'
import { artigoDefinido, capitalizar } from '@/lib/unidade'

/**
 * O QR de uma casa, com as duas formas de o levar dali para fora.
 *
 * O QR PERTENCE À CASA, E NÃO AO CARTÃO DE IMPRESSÃO.
 *
 * Ontem eu pu-lo dentro do editor do cartão de impressão, que é onde ele estava
 * a olhar quando se queixou de não o encontrar. Só que as letras B e C ainda não
 * têm cartão de impressão criado, e por isso não havia por onde lá chegar. Ele
 * voltou a dizer o mesmo em 27/08, e desta vez sobre outras letras. O QR é criado
 * com a casa, existe desde então, e passa a aparecer onde a casa aparece.
 *
 * DOIS FORMATOS PORQUE SERVEM PARA COISAS DIFERENTES. O vectorial é o que a
 * gráfica amplia para um cartaz sem serrilhar. O PNG é o que se envia por
 * mensagem: ele tentou mandar o vectorial pelo WhatsApp e do outro lado não
 * apareceu nada, porque o WhatsApp trata o SVG como documento e não o desenha.
 *
 * ── E CHAMA A CASA PELO NOME DO PROJETO ───────────────────────────────
 *
 * Dizia "QR CODE DA LETRA 1" e "o código que leva à Letra 1" no painel de um
 * projeto de sete dias. Ele viu-o em 22/09, no Dia 1, logo por baixo do
 * cabeçalho que já dizia "Dia 1" — a mesma casa com dois nomes no mesmo ecrã.
 *
 * Escapou à passagem de ontem, como o "← Alfabeto", porque este ecrã só se vê
 * com sessão iniciada e eu tinha verificado o painel pela API e não pelos olhos.
 */
export function QrDaLetra({
  projectSlug,
  contentSlug,
  letra,
  unidade = 'Letra',
}: {
  projectSlug: string
  contentSlug: string | null
  /** A casa: "A" no alfabeto, "1" num projeto numerado. */
  letra: string
  /** Como se chama uma casa neste projeto. Ver `Project.unidade`. */
  unidade?: string
}) {
  const nome = letra ? `${unidade} ${letra}` : 'esta publicação'
  const titulo = letra ? `${unidade} ${letra}`.toUpperCase() : 'PUBLICAÇÃO'
  /* "leva à Letra 1", mas "leva ao Dia 1". */
  const artigo = artigoDefinido(unidade)
  const aQue = artigo === 'a' ? 'à' : 'ao'

  if (!contentSlug) {
    return (
      <section className="bloco-qr">
        <h3>QR CODE {artigo === 'a' ? 'DA' : 'DO'} {titulo}</h3>
        <p className="nota-qr">
          O QR nasce com {artigo} {unidade.toLowerCase()}. Assim que esta tiver o primeiro cartão,
          ele aparece aqui.
        </p>
      </section>
    )
  }

  const svg = admin.urlQrSvg(projectSlug, contentSlug)
  const png = admin.urlQrPng(projectSlug, contentSlug)
  /* O nome do ficheiro segue a unidade: "qr-dia-1.png" e não "qr-letra-1.png". */
  const ficheiro = `qr-${unidade.toLowerCase()}-${letra.toLowerCase()}`

  return (
    <section className="bloco-qr">
      <h3>QR CODE {artigo === 'a' ? 'DA' : 'DO'} {titulo}</h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="imagem-qr" src={svg} alt={`QR Code ${aQue} ${nome}`} />
      <p className="nota-qr">
        {capitalizar('este')} é o código que leva {aQue} {nome}.
      </p>
      <div className="linha-acoes centrada">
        <a className="botao-acao" href={png} download={`${ficheiro}.png`}>
          ⬇ PNG (WhatsApp)
        </a>
        <a className="botao-acao" href={svg} download={`${ficheiro}.svg`}>
          ⬇ SVG (gráfica)
        </a>
      </div>
    </section>
  )
}
