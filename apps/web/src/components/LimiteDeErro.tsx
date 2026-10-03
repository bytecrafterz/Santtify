'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { relatarErro } from '@/lib/erros'

/**
 * Uma rede à volta de um pedaço da página (03/10).
 *
 * Se o editor do cartão cair, cai só ele: a página fica, aparece a explicação
 * e um botão para recomeçar, e o erro vai para o registo com a lista dos
 * componentes por onde passou — que é o que diz ONDE foi.
 */
export class LimiteDeErro extends Component<
  { children: ReactNode; aoRecomecar?: () => void; mensagem?: string },
  { erro: Error | null }
> {
  state: { erro: Error | null } = { erro: null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    relatarErro({
      tipo: 'editor',
      mensagem: `${erro.name}: ${erro.message}`,
      pilha: erro.stack,
      componentes: info.componentStack ?? undefined,
    })
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="cartoes-passo">
        <p className="cartoes-erro">
          {this.props.mensagem ?? 'Algo deu errado aqui. Já recebemos o aviso do problema.'}
        </p>
        <button
          type="button"
          className="cartoes-accao"
          onClick={() => {
            this.props.aoRecomecar?.()
            this.setState({ erro: null })
          }}
        >
          Tentar de novo
        </button>
      </div>
    )
  }
}
