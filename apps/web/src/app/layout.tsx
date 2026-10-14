import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RegistroDoServiceWorker } from '@/components/RegistroDoServiceWorker'
import { ProvedorDeAuth } from '@/components/ProvedorDeAuth'
import { PainelPersistente } from '@/components/painel/PainelPersistente'
import { RelatorDeErros } from '@/components/RelatorDeErros'
import { UmSomDeCadaVez } from '@/components/UmSomDeCadaVez'
import { TocadorGlobal } from '@/components/TocadorGlobal'
import { RegistoDasPaginas } from '@/components/RegistoDasPaginas'

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
      <head>
        {/*
          A APLICAÇÃO DO IPHONE ABRE SEMPRE NO INÍCIO (14/10).

          "Quando eu entro no aplicativo ele sempre vai na página da cenoura.
          Eu quero que ele vá na página principal." O registo do servidor
          mostra-o: cada vez que a aplicação dele abre, o primeiro pedido é
          /jesus-alfabeto-saudavel?letra=c&pub=… — a publicação da cenoura.

          O manifesto diz `start_url: "/"`, mas o iPhone guarda como início a
          página onde a pessoa estava quando tocou em "Adicionar ao Ecrã
          Principal". Ele instalou-a a partir do QR de um cartão, e é o que
          acontece a qualquer família que instale depois de ler um QR.

          Aqui: só no iPhone (`navigator.standalone`, que só o iPhone tem), só
          quando a aplicação acaba de ser aberta pelo ícone (a sessão começa
          vazia), e só se não abriu no início — troca para o início antes de
          desenhar a página errada. Recarregar a meio do uso não volta ao
          início, porque a sessão já tem a marca. No Android não se toca: lá a
          aplicação abre links de QR por si, e esses devem abrir onde apontam.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(navigator.standalone!==true)return;if(sessionStorage.getItem('pv_aplicacao_aberta'))return;sessionStorage.setItem('pv_aplicacao_aberta','1');if(location.pathname+location.search!=='/')location.replace('/')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        {/* As páginas por onde se passa, para o Voltar de cada uma ir à anterior (11/10). */}
        <RegistoDasPaginas />
        <UmSomDeCadaVez />
        <ProvedorDeAuth>
          <PainelPersistente>{children}</PainelPersistente>
        </ProvedorDeAuth>
        {/* A música que continua pela plataforma inteira (10/10). Fora das
            páginas, para nunca ser desmontado ao navegar. */}
        <TocadorGlobal />
        <RegistroDoServiceWorker />
        <RelatorDeErros />
      </body>
    </html>
  )
}
