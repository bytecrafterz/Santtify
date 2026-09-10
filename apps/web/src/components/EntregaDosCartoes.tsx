'use client'

import { useState } from 'react'
import { cartoes } from '@/lib/cartoes'
import { ErroDeApi } from '@/lib/auth'

/**
 * As quatro formas de receber os cartões, do ponto 8.
 *
 * BAIXAR e IMPRIMIR saem do ficheiro directamente. WHATSAPP e E-MAIL saem de
 * uma LIGAÇÃO, e não do ficheiro — porque nenhum dos dois aceita um anexo vindo
 * de uma página web. Quem tentar mandar o PDF por `wa.me` descobre isso ao fim
 * de uma tarde: o WhatsApp abre com o texto e sem ficheiro nenhum.
 *
 * A ligação é assinada e tem o prazo do próprio ficheiro. Vai abrir na gráfica,
 * no telemóvel do marido, no computador da escola — sítios onde ela não tem
 * sessão. É por isso que existe.
 */
export function EntregaDosCartoes({
  projectSlug,
  pedidoId,
  criancaId,
  nome,
  liberado,
}: {
  projectSlug: string
  pedidoId: string
  criancaId: string
  nome: string
  liberado: boolean
}) {
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)
  const [email, definirEmail] = useState('')
  const [aPedirEmail, definirAPedirEmail] = useState(false)

  const urlDoPdf = cartoes.urlDoPdf(projectSlug, pedidoId, criancaId)

  if (!liberado) {
    return (
      <p className="cartoes-estado-espera">
        Liberado assim que o pagamento for confirmado.
      </p>
    )
  }

  const comErro = async (chave: string, accao: () => Promise<void>) => {
    definirErro(null)
    definirAviso(null)
    definirOcupado(chave)
    try {
      await accao()
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível concluir.')
    } finally {
      definirOcupado(null)
    }
  }

  return (
    <div className="entrega-dos-cartoes">
      <a className="cartoes-accao" href={urlDoPdf} download>
        Baixar o PDF
      </a>

      {/*
        Imprimir abre o ficheiro numa aba, e é o navegador que imprime. Um
        `window.print()` daqui imprimiria ESTA página — os botões e tudo — e não
        os cartões, que é o erro clássico deste botão.
      */}
      <a
        className="cartoes-accao-secundaria"
        href={urlDoPdf}
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir para imprimir
      </a>

      <button
        type="button"
        className="cartoes-accao-secundaria"
        disabled={ocupado !== null}
        onClick={() =>
          comErro('whatsapp', async () => {
            const l = await cartoes.partilha(projectSlug, pedidoId, criancaId)
            window.open(
              `https://wa.me/?text=${encodeURIComponent(l.textoParaWhatsApp)}`,
              '_blank',
              'noopener',
            )
          })
        }
      >
        {ocupado === 'whatsapp' ? 'A preparar…' : 'Enviar pelo WhatsApp'}
      </button>

      {aPedirEmail ? (
        <div className="entrega-email">
          <label className="cartoes-campo">
            <span>Para qual e-mail?</span>
            <input
              type="email"
              value={email}
              placeholder="grafica@exemplo.com"
              onChange={(e) => definirEmail(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="cartoes-accao"
            disabled={ocupado !== null || !email.includes('@')}
            onClick={() =>
              comErro('email', async () => {
                const r = await cartoes.enviarPorEmail(projectSlug, pedidoId, criancaId, email)
                if (r.enviado) {
                  definirAviso(`✓ Enviado para ${email}.`)
                  definirAPedirEmail(false)
                  definirEmail('')
                } else {
                  /**
                   * Sem serviço de e-mail configurado, mostra-se a ligação em vez
                   * de fingir que foi enviada. Ela copia e manda como quiser —
                   * pior do que não enviar é dizer que enviou.
                   */
                  definirAviso(`O envio de e-mail ainda não está configurado. Copie o link: ${r.url}`)
                }
              })
            }
          >
            {ocupado === 'email' ? 'A enviar…' : 'Enviar'}
          </button>
          <button
            type="button"
            className="cartoes-ligacao"
            onClick={() => definirAPedirEmail(false)}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="cartoes-accao-secundaria"
          onClick={() => definirAPedirEmail(true)}
        >
          Enviar por e-mail
        </button>
      )}

      {aviso && <p className="entrega-aviso">{aviso}</p>}
      {erro && <p className="cartoes-erro">{erro}</p>}

      <p className="cartoes-ajuda">
        O link enviado por WhatsApp ou e-mail abre sem precisar de conta — dá
        para mandar direto para a gráfica. Ele vale pelo mesmo prazo do arquivo.
      </p>
      <span className="apenas-leitor-de-ecra">Cartões de {nome}</span>
    </div>
  )
}
