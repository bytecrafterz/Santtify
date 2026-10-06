'use client'

import { useEffect, useRef, useState } from 'react'

/** O que o formulário devolve: o token do cartão, nunca o número. */
export interface DadosDoCartao {
  token: string
  metodo: string
  tipo: 'credit_card' | 'debit_card'
  parcelas: number
  documento: { tipo: string; numero: string } | null
  email: string
}

interface ControladorDoBrick {
  unmount: () => void
}

interface FormDataDoBrick {
  token: string
  payment_method_id: string
  installments: number | string
  payer?: { email?: string; identification?: { type?: string; number?: string } }
}

declare global {
  interface Window {
    MercadoPago?: new (
      chave: string,
      opcoes?: { locale?: string },
    ) => {
      bricks: () => {
        create: (tipo: string, alvo: string, opcoes: unknown) => Promise<ControladorDoBrick>
      }
    }
  }
}

const SDK = 'https://sdk.mercadopago.com/js/v2'
const ALVO = 'formulario-de-cartao'
let sdkACarregar: Promise<void> | null = null

/** O SDK do Mercado Pago, carregado uma vez e só quando há cartão para digitar. */
function carregarSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve()
  sdkACarregar ??= new Promise<void>((resolver, rejeitar) => {
    const s = document.createElement('script')
    s.src = SDK
    s.async = true
    s.onload = () => resolver()
    s.onerror = () => {
      sdkACarregar = null
      rejeitar(new Error('Não foi possível carregar o formulário do Mercado Pago.'))
    }
    document.head.appendChild(s)
  })
  return sdkACarregar
}

/**
 * O CARTÃO DIGITADO AQUI MESMO (06/10).
 *
 * "Ao selecionar cartão de crédito, precisamos ter a opção de o cliente
 * inserir os dados do cartão manualmente (…) sem sair da página." É o
 * formulário do próprio Mercado Pago (Card Payment Brick): os campos do cartão
 * são deles, desenhados dentro desta página, e o que chega ao nosso servidor é
 * um token de uso único. O número do cartão nunca passa por nós.
 *
 * E a foto fica: ninguém sai da página, nada recarrega.
 */
export function FormularioDeCartao({
  chavePublica,
  valorCent,
  email,
  aoPagar,
  aoCancelar,
}: {
  chavePublica: string
  valorCent: number
  email: string
  /** Lança com a frase para quem paga quando o cartão é recusado. */
  aoPagar: (dados: DadosDoCartao) => Promise<void>
  aoCancelar: () => void
}) {
  const [estado, definirEstado] = useState<'carregando' | 'pronto' | 'falhou'>('carregando')
  const [erro, definirErro] = useState<string | null>(null)
  const aoPagarActual = useRef(aoPagar)
  aoPagarActual.current = aoPagar

  useEffect(() => {
    let controlador: ControladorDoBrick | null = null
    let largado = false
    const escuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches

    carregarSdk()
      .then(async () => {
        if (largado || !window.MercadoPago) return
        const mp = new window.MercadoPago(chavePublica, { locale: 'pt-BR' })
        const criado = await mp.bricks().create('cardPayment', ALVO, {
          initialization: { amount: valorCent / 100, payer: { email } },
          customization: { visual: { style: { theme: escuro ? 'dark' : 'default' } } },
          callbacks: {
            onReady: () => {
              if (!largado) definirEstado('pronto')
            },
            onSubmit: async (dados: FormDataDoBrick, extra?: { paymentTypeId?: string }) => {
              definirErro(null)
              const documento = dados.payer?.identification?.number
                ? { tipo: dados.payer.identification.type ?? 'CPF', numero: dados.payer.identification.number }
                : null
              try {
                await aoPagarActual.current({
                  token: dados.token,
                  metodo: dados.payment_method_id,
                  tipo: extra?.paymentTypeId === 'debit_card' ? 'debit_card' : 'credit_card',
                  parcelas: Number(dados.installments) || 1,
                  documento,
                  email: dados.payer?.email || email,
                })
              } catch (e) {
                definirErro(e instanceof Error ? e.message : 'Não foi possível concluir o pagamento.')
                // Rejeitar devolve o botão do formulário, para tentar outra vez.
                throw e
              }
            },
            onError: (e: { type?: string; message?: string }) => {
              // Os erros de preenchimento o próprio formulário mostra; só o que o
              // impede de abrir é que precisa de outra saída.
              if (e?.type === 'critical' && !largado) definirEstado('falhou')
            },
          },
        })
        if (largado) criado.unmount()
        else controlador = criado
      })
      .catch(() => {
        if (!largado) definirEstado('falhou')
      })

    return () => {
      largado = true
      controlador?.unmount()
    }
  }, [chavePublica, valorCent, email])

  return (
    <div className="cartoes-cartao-na-pagina">
      {estado === 'carregando' && <p className="cartoes-ajuda">Abrindo o formulário seguro do Mercado Pago…</p>}
      {estado === 'falhou' && (
        <p className="cartoes-erro">
          Não foi possível abrir o formulário do cartão. Confira a internet e tente de novo, ou pague com Pix.
        </p>
      )}
      <div id={ALVO} />
      {erro && <p className="cartoes-erro">{erro}</p>}
      <button type="button" className="cartoes-ligacao" onClick={aoCancelar}>
        Voltar às formas de pagamento
      </button>
    </div>
  )
}
