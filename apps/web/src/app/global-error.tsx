'use client'

import { useEffect } from 'react'
import { relatarErro } from '@/lib/erros'

/**
 * Quando cai o próprio layout raiz — a última rede (03/10). Ver `error.tsx`.
 * Aqui o layout já não existe, por isso o documento e o estilo vêm todos daqui.
 */
export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    relatarErro({ tipo: 'render', mensagem: `${error.name}: ${error.message}`, pilha: error.stack, digest: error.digest })
  }, [error])

  return (
    <html lang="pt">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeContent: 'center',
          gap: 14,
          padding: 24,
          textAlign: 'center',
          fontFamily: '-apple-system, Segoe UI, Arial, sans-serif',
          background: '#f6f7fb',
          color: '#171a22',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Algo deu errado</h1>
        <p style={{ margin: 0, color: '#5b6478' }}>Já recebemos o aviso do problema. Tente de novo.</p>
        <button
          type="button"
          onClick={reset}
          style={{ padding: '14px 22px', fontSize: 16, fontWeight: 700, color: '#fff', background: '#16a34a', border: 0, borderRadius: 14 }}
        >
          Tentar de novo
        </button>
        <a href="/" style={{ color: '#2563eb' }}>
          Voltar ao início
        </a>
      </body>
    </html>
  )
}
