import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RegistroDoServiceWorker } from '@/components/RegistroDoServiceWorker'
import { ProvedorDeAuth } from '@/components/ProvedorDeAuth'

export const metadata: Metadata = {
  title: 'Jesus Alfabeto Saudável',
  description: 'Aprenda o alfabeto com música, áudio e conteúdo educativo.',
  manifest: '/manifest.json',
  // Sem esta declaração o navegador vai sozinho procurar /favicon.ico, não
  // encontra, e escreve um erro no console de todo visitante. O ícone já
  // existia; faltava dizer onde ele está.
  icons: {
    icon: '/icone.svg',
    apple: '/icone.svg',
    shortcut: '/icone.svg',
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Alfabeto Saudável' },
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
        <ProvedorDeAuth>{children}</ProvedorDeAuth>
        <RegistroDoServiceWorker />
      </body>
    </html>
  )
}
