'use client'

import { admin } from '@/lib/admin'

/**
 * O QR DE UMA PUBLICAÇÃO, com as duas formas de o levar ao designer (09/10).
 *
 * "Todas as publicações precisam gerar um QR Code, com opção de baixar e enviar
 * ao designer." Até aqui só a casa (a letra, o dia) tinha QR — ver `QrDaLetra`.
 * Este abre a letra já nesta publicação, e é gerado no servidor na primeira vez
 * que o painel o mostra: os cartões que já existiam ganham o seu sem fazer nada.
 *
 * Os dois formatos pela mesma razão do da letra: o PNG vai pelo WhatsApp, o SVG
 * é o que a gráfica amplia sem serrilhar. O ficheiro leva o título do cartão no
 * nome, para o designer saber qual é qual.
 */
export function QrDaPublicacao({
  projectSlug,
  blocoId,
  titulo,
  publicado,
}: {
  projectSlug: string
  blocoId: string
  titulo: string | null
  publicado: boolean
}) {
  const nome = titulo?.trim() || 'publicacao'
  return (
    <section className="bloco-qr qr-da-publicacao">
      <h3>QR CODE DESTA PUBLICAÇÃO</h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="imagem-qr"
        src={admin.urlQrDaPublicacao(projectSlug, blocoId, 'svg')}
        alt={`QR Code de ${nome}`}
        width={160}
        height={160}
      />
      <p className="nota-qr">
        Quem escanear abre direto esta publicação.
        {!publicado && ' Ela só aparece depois de publicada.'}
      </p>
      <div className="linha-acoes centrada">
        <a className="botao-acao" href={admin.urlQrDaPublicacao(projectSlug, blocoId, 'png', nome)} download>
          ⬇ PNG (WhatsApp)
        </a>
        <a className="botao-acao" href={admin.urlQrDaPublicacao(projectSlug, blocoId, 'svg', nome)} download>
          ⬇ SVG (gráfica)
        </a>
      </div>
    </section>
  )
}
