'use client'

import { admin } from '@/lib/admin'
import { BotaoDeEnviar } from './EnviarSemSair'

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
  const base = paraNomeDeFicheiro(nome) || 'publicacao'
  const ficheiro = `qr-${base}`
  const svg = admin.urlQrDaPublicacao(projectSlug, blocoId, 'svg')
  return (
    <section className="bloco-qr qr-da-publicacao">
      <h3>QR CODE DESTA PUBLICAÇÃO</h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="imagem-qr"
        src={svg}
        alt={`QR Code de ${nome}`}
        width={160}
        height={160}
      />
      <p className="nota-qr">
        Quem escanear abre direto esta publicação.
        {!publicado && ' Ela só aparece depois de publicada.'}
      </p>
      {/* Na aplicação do iPhone estes eram links para o ficheiro, e prendiam-no
          no visor do sistema sem saída (10/10). Ver `EnviarSemSair`. */}
      <div className="linha-acoes centrada">
        <BotaoDeEnviar
          className="botao-acao"
          url={admin.urlQrDaPublicacao(projectSlug, blocoId, 'png', base)}
          nome={`${ficheiro}.png`}
          tipo="image/png"
          titulo="QR Code para o WhatsApp"
          previa={svg}
        >
          ⬇ PNG (WhatsApp)
        </BotaoDeEnviar>
        <BotaoDeEnviar
          className="botao-acao"
          url={admin.urlQrDaPublicacao(projectSlug, blocoId, 'svg', base)}
          nome={`${ficheiro}.svg`}
          tipo="image/svg+xml"
          titulo="QR Code para a gráfica"
          previa={svg}
          dica="O SVG é para a gráfica: amplia sem perder qualidade. Para o WhatsApp use o PNG."
        >
          ⬇ SVG (gráfica)
        </BotaoDeEnviar>
      </div>
    </section>
  )
}

/**
 * "🎧 Conheça o Jesus Alfabeto Saudável" → "conheca-o-jesus-alfabeto-saudavel".
 * O nome ia com o emoji e os acentos, e há programas de gráfica e computadores
 * que tropeçam neles; o designer só precisa de saber qual é qual.
 */
function paraNomeDeFicheiro(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}
