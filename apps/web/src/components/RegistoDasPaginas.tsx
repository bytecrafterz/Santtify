'use client'

import { useEffect } from 'react'
import { instalarRegistoDasPaginas } from '@/lib/paginas-visitadas'

/**
 * Começa a lista das páginas por onde se passa, para o Voltar de cada página
 * saber qual é a anterior. Ver `paginas-visitadas.ts`. Não desenha nada.
 */
export function RegistoDasPaginas() {
  useEffect(() => {
    instalarRegistoDasPaginas()
  }, [])
  return null
}
