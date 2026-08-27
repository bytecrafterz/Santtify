'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DecoracaoPastel } from '@/components/DecoracaoPastel'

/**
 * A folha de instalação, sobre a tela de entrada — os dois desenhos que ele
 * mandou em 22/08, o do Android e o do iPhone.
 *
 * A regra que ele deu é a mesma nos dois: NÃO SAIR DA PÁGINA. A instalação
 * aparece por cima, o cadastro fica por baixo, e quando a instalação termina a
 * folha desaparece e o cadastro continua ali. Por isso isto é uma folha
 * sobreposta e não outra tela: quem instala não perde o que estava a fazer, e
 * quem não quer instalar afasta-a e continua.
 *
 * OS DOIS TELEMÓVEIS NÃO INSTALAM DA MESMA MANEIRA, e é essa a razão de haver
 * dois ecrãs aqui em vez de um botão só.
 *
 * O Android avisa o site de que a instalação é possível (`beforeinstallprompt`)
 * e deixa-nos abrir a caixa dele — ali há mesmo um botão que instala.
 *
 * O iPhone nunca avisa nada e não deixa nenhum site iniciar a instalação. Lá o
 * caminho é o menu de partilha do Safari, e a única coisa honesta é mostrar
 * onde tocar. Foi o que ele desenhou: quatro passos e um "JÁ BAIXEI" no fim,
 * porque só a pessoa sabe se chegou ao fim — o site não tem como saber.
 *
 * O botão verde nunca desaparece. O aviso do Android não vem sempre: não vem
 * se a aplicação já estiver instalada e às vezes demora. A tentação era
 * escondê-lo nesses casos, mas um botão que aparece e desaparece obriga a
 * adivinhar, e adivinhar num botão já nos custou uma queixa neste projecto.
 * Quando não há caixa para abrir, ele abre aqui dentro o caminho manual.
 */
type Aviso = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Estado = 'convite' | 'passos' | 'fechada' | 'instalado'

const CHAVE = 'pv_folha_instalar_fechada'

export function FolhaDeInstalacao() {
  const [estado, definirEstado] = useState<Estado>('convite')
  const [pronta, definirPronta] = useState(false)
  const [ehIphone, definirEhIphone] = useState(false)
  /**
   * O SAMSUNG INTERNET NÃO É O CHROME, E É O QUE VEM NOS GALAXY.
   *
   * A amiga dele conseguiu registar-se num Galaxy A35 e não conseguiu pôr o
   * ícone no ecrã principal. Os nossos passos mandavam procurar os três
   * pontinhos e "Instalar aplicativo", que é o caminho do Chrome. No Samsung
   * Internet o menu é de três traços, em baixo, e a opção chama-se outra coisa.
   * Ela andou à procura de uma coisa que não existe naquele ecrã.
   */
  const [ehSamsung, definirEhSamsung] = useState(false)
  const [abrindo, definirAbrindo] = useState(false)
  const aviso = useRef<Aviso | null>(null)

  useEffect(() => {
    const ua = window.navigator.userAgent
    const iphone = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
    definirEhIphone(iphone)
    definirEhSamsung(/SamsungBrowser/i.test(ua))

    const instalada =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && Boolean(window.navigator.standalone))

    if (instalada) definirEstado('fechada')
    else if (window.sessionStorage.getItem(CHAVE) === 'sim') definirEstado('fechada')
    // No iPhone não há caixa nenhuma para abrir, e um botão "Baixar aplicativo"
    // que não baixa nada é pior do que não existir. Lá entra-se logo nos passos.
    else if (iphone) definirEstado('passos')

    const t = window.setTimeout(() => definirPronta(true), 60)

    function guardar(e: Event) {
      e.preventDefault()
      aviso.current = e as Aviso
    }

    function instalou() {
      definirEstado('instalado')
      window.sessionStorage.setItem(CHAVE, 'sim')
    }

    window.addEventListener('beforeinstallprompt', guardar)
    window.addEventListener('appinstalled', instalou)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('beforeinstallprompt', guardar)
      window.removeEventListener('appinstalled', instalou)
    }
  }, [])

  const fechar = useCallback(() => {
    definirEstado('fechada')
    window.sessionStorage.setItem(CHAVE, 'sim')
  }, [])

  const jaBaixei = useCallback(() => {
    definirEstado('instalado')
    window.sessionStorage.setItem(CHAVE, 'sim')
  }, [])

  async function baixar() {
    const guardado = aviso.current
    if (!guardado) {
      definirEstado('passos')
      return
    }
    definirAbrindo(true)
    try {
      await guardado.prompt()
      const escolha = await guardado.userChoice.catch(() => null)
      aviso.current = null
      if (escolha?.outcome === 'accepted') {
        // O `appinstalled` costuma chegar sozinho, mas em alguns Android chega
        // tarde ou não chega. Não deixo a folha presa à espera dele.
        definirEstado('instalado')
        window.sessionStorage.setItem(CHAVE, 'sim')
      }
    } finally {
      definirAbrindo(false)
    }
  }

  if (estado === 'fechada') return null

  if (estado === 'instalado') {
    return (
      <p className="aviso-instalado" role="status">
        <span aria-hidden>✓</span> Pronto. Agora é só entrar.
      </p>
    )
  }

  return (
    <div className={`folha-instalar ${pronta ? 'aberta' : ''}`} role="dialog" aria-modal="false">
      {/* O escurecido não fecha a folha ao toque: nesta tela ela é o passo, não
          um anúncio, e fechar sem querer deixava a pessoa sem perceber o que
          desapareceu. Fecha-se pelo texto verde, que diz o que faz. */}
      <div className="folha-sombra" aria-hidden />

      <section className={`folha-corpo ${estado === 'passos' ? 'alta' : ''}`}>
        <DecoracaoPastel variante="folha" />
        <span className="folha-pega" aria-hidden />

        <div className="folha-conteudo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="folha-marca" src="/logo-santtify.png" alt="Santtify" />

          {estado === 'convite' ? (
            <>
              <h2>
                BAIXE O APLICATIVO <span className="realce">GRÁTIS</span>
              </h2>
              <p>Baixe o aplicativo e depois faça seu cadastro gratuito.</p>

              <button type="button" className="botao-baixar" onClick={baixar} disabled={abrindo}>
                <span className="seta" aria-hidden>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4l3.3 3.3V4a1 1 0 0 1 1-1Z" />
                    <path d="M4 18a1 1 0 0 1 1 1v1h14v-1a1 1 0 1 1 2 0v1.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20.5V19a1 1 0 0 1 1-1Z" />
                  </svg>
                </span>
                {abrindo ? 'ABRINDO...' : 'BAIXAR APLICATIVO'}
              </button>
            </>
          ) : (
            <>
              <h2>
                INSTALE <span className="realce-verde">GRÁTIS</span> O{' '}
                <span className="realce">WEB APP</span>
              </h2>
              <p>É o site da Santtify instalado no seu telefone.</p>
              <p className="folha-conta-passos">Siga estes {ehIphone ? '4' : '3'} passos:</p>

              {ehIphone ? (
                <PassosDoIphone />
              ) : ehSamsung ? (
                <PassosDoSamsung />
              ) : (
                <PassosDoAndroid />
              )}

              {/* Só a pessoa sabe se chegou ao fim: nem o iPhone nem o Android
                  nos contam nada quando a instalação é feita pelo menu. É por
                  isso que este botão existe e é ela que o toca. */}
              <button type="button" className="botao-baixar" onClick={jaBaixei}>
                JÁ BAIXEI
              </button>
            </>
          )}

          <button type="button" className="folha-sair" onClick={fechar}>
            CONTINUAR EXPLORANDO
          </button>
        </div>
      </section>
    </div>
  )
}

/**
 * Os quatro passos do iPhone, com um desenho de cada ecrã.
 *
 * Os desenhos são feitos aqui, com caixas e texto, e não são capturas. Uma
 * captura do iOS envelhece a cada versão e fica com o telemóvel dele dentro —
 * hora, bateria, operadora. Isto é a forma das coisas, que é o que a pessoa
 * precisa de reconhecer, e não muda quando a Apple muda o cinzento.
 */
function PassosDoIphone() {
  return (
    <ol className="passos-instalar">
      <li>
        <span className="numero-passo">1</span>
        <div className="figura barra-safari">
          <span className="aa">AA</span>
          <span className="cadeado" aria-hidden>
            🔒
          </span>
          <span className="endereco">santtify.com</span>
          <span className="alvo-partilhar">
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v11" />
              <path d="M8.5 6.5 12 3l3.5 3.5" />
              <path d="M6 12v8h12v-8" />
            </svg>
          </span>
        </div>
        <p>Toque no símbolo Compartilhar.</p>
      </li>

      <li>
        <span className="numero-passo">2</span>
        <div className="figura ver-mais">
          <span className="pastilha" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span className="rotulo">Ver mais</span>
        </div>
        <p>Toque em Ver mais.</p>
      </li>

      <li>
        <span className="numero-passo">3</span>
        <div className="figura menu-ios">
          <span className="linha">Imprimir</span>
          <span className="linha destacada">Adicionar ao ecrã principal</span>
          <span className="linha">Adicionar a uma nota rápida</span>
        </div>
        <p>Toque em Adicionar ao ecrã principal.</p>
      </li>

      <li>
        <span className="numero-passo">4</span>
        <div className="figura caixa-adicionar">
          <span className="topo">
            <span className="x" aria-hidden>
              ✕
            </span>
            <span className="titulo">Adicionar a...</span>
            <span className="botao">Adicionar</span>
          </span>
          <span className="linha-app">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icone-192.png" alt="" aria-hidden />
            <span className="nome">Santtify</span>
          </span>
        </div>
        <p>Confirme Santtify e toque em Adicionar.</p>
      </li>
    </ol>
  )
}

/** O mesmo, para quem está no Android e o navegador não ofereceu a caixa. */
/**
 * Os passos do Samsung Internet, que é o navegador dos Galaxy.
 *
 * Aqui o menu é de três TRAÇOS e fica em BAIXO à direita, não de três pontinhos
 * em cima. E a opção não se chama "Instalar aplicativo": chama-se "Adicionar
 * página a", e só depois se escolhe o ecrã principal. Mandar procurar as
 * palavras do Chrome neste telefone é mandar procurar o que não existe.
 */
function PassosDoSamsung() {
  return (
    <ol className="passos-instalar">
      <li>
        <span className="numero-passo">1</span>
        <div className="figura menu-ios">
          <span className="linha destacada">☰ Menu, em baixo à direita</span>
        </div>
        <p>Toque nos três tracinhos, no canto de baixo.</p>
      </li>
      <li>
        <span className="numero-passo">2</span>
        <div className="figura menu-ios">
          <span className="linha destacada">Adicionar página a</span>
          <span className="linha">Marcadores</span>
        </div>
        <p>Toque em Adicionar página a.</p>
      </li>
      <li>
        <span className="numero-passo">3</span>
        <div className="figura caixa-adicionar">
          <span className="topo">
            <span className="titulo">Adicionar a</span>
            <span className="botao">Ecrã inicial</span>
          </span>
          <span className="linha-app">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icone-192.png" alt="" aria-hidden />
            <span className="nome">Santtify</span>
          </span>
        </div>
        <p>Escolha Ecrã inicial. O ícone aparece junto aos outros aplicativos.</p>
      </li>
    </ol>
  )
}

function PassosDoAndroid() {
  return (
    <ol className="passos-instalar">
      <li>
        <span className="numero-passo">1</span>
        <div className="figura menu-ios">
          <span className="linha destacada">⋮ Menu do navegador</span>
        </div>
        <p>Toque nos três pontinhos, no canto de cima.</p>
      </li>
      <li>
        <span className="numero-passo">2</span>
        <div className="figura menu-ios">
          <span className="linha destacada">Instalar aplicativo</span>
          <span className="linha">Adicionar à tela inicial</span>
        </div>
        <p>Toque em Instalar aplicativo.</p>
      </li>
      <li>
        <span className="numero-passo">3</span>
        <div className="figura caixa-adicionar">
          <span className="topo">
            <span className="titulo">Instalar aplicativo</span>
            <span className="botao">Instalar</span>
          </span>
          <span className="linha-app">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icone-192.png" alt="" aria-hidden />
            <span className="nome">Santtify</span>
          </span>
        </div>
        <p>Confirme em Instalar.</p>
      </li>
    </ol>
  )
}
