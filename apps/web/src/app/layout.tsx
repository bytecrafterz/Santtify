import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RegistroDoServiceWorker } from '@/components/RegistroDoServiceWorker'
import { ProvedorDeAuth } from '@/components/ProvedorDeAuth'
import { PainelPersistente } from '@/components/painel/PainelPersistente'
import { RelatorDeErros } from '@/components/RelatorDeErros'
import { UmSomDeCadaVez } from '@/components/UmSomDeCadaVez'

export const metadata: Metadata = {
  title: 'Santtify',
  description: 'Aprenda o alfabeto com música, áudio e conteúdo educativo.',
  manifest: '/manifest.json?v=20261003',
  // Sem esta declaração o navegador vai sozinho procurar /favicon.ico, não
  // encontra, e escreve um erro no console de todo visitante. O ícone já
  // existia; faltava dizer onde ele está.
  icons: {
      icon: [
        { url: '/icone-192.png?v=20261003', sizes: '192x192', type: 'image/png' },
        { url: '/icone-512.png?v=20261003', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png?v=20261003', sizes: '180x180' }],
      shortcut: ['/favicon.ico'],
    },
  /*
    O NOME DO ATALHO É SEMPRE "Santtify", VENHA-SE DE QUALQUER PÁGINA.

    Ele instalou a aplicação a partir da Letra A e o iPhone propôs chamar-lhe
    "A de Amor e Abacate": o iOS usa o título da PÁGINA quando não encontra
    nada melhor, e o que havia de melhor não estava a chegar. O manifesto dizia
    `name: "Jesus Alfabeto Saudável"`, que também não é a marca, e o
    `apple-mobile-web-app-capable` não estava a ser escrito de todo — o Next 15
    escreve `mobile-web-app-capable` e o Safari continua a ler o antigo.

    Agora as três fontes dizem o mesmo: o manifesto (`name` e `short_name`), o
    título da aplicação e a marca de compatibilidade. Não há qual delas o iOS
    escolha que dê outra coisa.
  */
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Santtify' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  // O público é criança: bloquear zoom seria um problema de acessibilidade.
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <UmSomDeCadaVez />
        <ProvedorDeAuth>
          <PainelPersistente>{children}</PainelPersistente>
        </ProvedorDeAuth>
        <RegistroDoServiceWorker />
        <RelatorDeErros />
      </body>
    </html>
  )
}
