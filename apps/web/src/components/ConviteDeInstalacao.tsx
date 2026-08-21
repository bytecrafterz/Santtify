'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * O convite para instalar o Santtify, antes de criar a conta.
 *
 * Duas etapas à vista, como ele desenhou: instalar e depois criar conta. O
 * indicador existe porque instalar uma aplicação a meio de um cadastro parece
 * um desvio; numerado, parece o primeiro passo de dois.
 *
 * ANDROID e IPHONE não se instalam da mesma maneira, e essa é a razão de esta
 * tela existir em vez de um botão só. O Android avisa o site de que a
 * instalação é possível, e aí há mesmo um botão. O iPhone nunca avisa nada e
 * não deixa nenhum site iniciar a instalação: lá o caminho é o menu de
 * partilha do Safari, e a única coisa honesta a fazer é dizer onde tocar.
 */
type Aviso = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function ConviteDeInstalacao({ projectSlug }: { projectSlug: string }) {
  const [aviso, definirAviso] = useState<Aviso | null>(null)
  const [ehIphone, definirEhIphone] = useState(false)
  const [jaInstalado, definirJaInstalado] = useState(false)
  const [instalando, definirInstalando] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent
    definirEhIphone(/iPad|iPhone|iPod/.test(ua) && !('MSStream' in window))
    // Já a correr como aplicação: não faz sentido convidar a instalar de novo.
    definirJaInstalado(
      window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in window.navigator && Boolean(window.navigator.standalone)),
    )

    function guardar(e: Event) {
      // Sem isto o Android mostra a sua própria barra e desaparece; guardando o
      // aviso, o botão desta tela é que passa a mandar.
      e.preventDefault()
      definirAviso(e as Aviso)
    }
    window.addEventListener('beforeinstallprompt', guardar)
    return () => window.removeEventListener('beforeinstallprompt', guardar)
  }, [])

  async function instalar() {
    if (!aviso) return
    definirInstalando(true)
    await aviso.prompt()
    await aviso.userChoice.catch(() => null)
    definirInstalando(false)
    definirAviso(null)
  }

  return (
    <div className="convite-instalar">
      <ol className="passos">
        <li className="passo atual">
          <span className="numero">1</span> Instalar aplicativo
        </li>
        <li className="passo">
          <span className="numero">2</span> Criar conta
        </li>
      </ol>

      <div className="cartao-instalar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="icone-santtify" src="/icone-512.png" alt="Santtify" />
        <h1>Leve o Santtify com você</h1>
        <p className="nota">Instale o aplicativo no seu telefone antes de criar seu perfil.</p>

        {jaInstalado ? (
          <p className="nota-ok">Já está instalado neste aparelho.</p>
        ) : aviso ? (
          <button type="button" className="botao-acao largo" onClick={instalar} disabled={instalando}>
            {instalando ? 'A instalar...' : 'INSTALAR SANTTIFY'}
          </button>
        ) : ehIphone ? (
          <div className="instrucao-iphone">
            <strong>Como instalar no iPhone</strong>
            <ol>
              <li>
                Toque em <strong>Compartilhar</strong> <span aria-hidden>⬆</span>, na barra de baixo
                do Safari.
              </li>
              <li>
                Deslize e toque em <strong>Adicionar à Tela de Início</strong>.
              </li>
              <li>
                Toque em <strong>Adicionar</strong>, no canto superior direito.
              </li>
            </ol>
            <small>
              O iPhone não deixa nenhum site instalar-se sozinho. Este é o único caminho, e é da
              Apple, não nosso.
            </small>
          </div>
        ) : (
          <p className="nota">
            O seu navegador ainda não ofereceu a instalação. Pode continuar no navegador e instalar
            mais tarde — nada se perde.
          </p>
        )}

        {/* Quem já tem conta tem de conseguir entrar daqui.
            Sem esta saída, uma sessão expirada empurrava um utilizador antigo
            para o cadastro, e ele concluía que a conta se tinha perdido — foi
            o que aconteceu ao cliente em 21/08. Instalar nunca pode ser
            condição para entrar. */}
        <Link className="botao-acao largo" href={`/${projectSlug}/entrar`}>
          JÁ TENHO UMA CONTA — ENTRAR
        </Link>

        <Link className="continuar-navegador" href={`/${projectSlug}/cadastrar`}>
          CRIAR CONTA GRÁTIS
        </Link>

        <Link className="continuar-navegador discreto" href={`/${projectSlug}/recuperar`}>
          ESQUECI MINHA SENHA
        </Link>

        <Link className="continuar-navegador discreto" href={`/${projectSlug}`}>
          CONTINUAR NO NAVEGADOR
        </Link>
      </div>
    </div>
  )
}
