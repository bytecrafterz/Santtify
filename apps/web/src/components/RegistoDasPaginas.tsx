'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { instalarRegistoDasPaginas, PAGINAS_MUDARAM } from '@/lib/paginas-visitadas'

/**
 * Começa a lista das páginas por onde se passa, para o Voltar de cada página
 * saber qual é a anterior. Ver `paginas-visitadas.ts`. Não desenha nada.
 *
 * ── E LARGA AS PÁGINAS GUARDADAS QUANDO O PAINEL MUDA ALGUMA COISA (12/10) ──
 *
 * O Next guarda na memória do telemóvel as páginas que já buscou, e as que os
 * links à vista pedem antes do toque, e durante cinco minutos mostra-as sem
 * perguntar ao servidor. Medido no registo do servidor em 12/10: ele abriu o
 * início às 06:06:55, trocou a capa do Quem é Jesus às 06:09:08, voltou ao
 * início às 06:09:34 — e o telemóvel não pediu nada: desenhou a cópia de dois
 * minutos antes, com a capa antiga, enquanto o painel já mostrava a nova.
 *
 * Depois de cada gravação do painel (e de o servidor ter esquecido as suas
 * cópias), `refresh()` esvazia essa memória: a próxima página é pedida de novo.
 */
export function RegistoDasPaginas() {
  const router = useRouter()
  useEffect(() => {
    instalarRegistoDasPaginas()
  }, [])
  useEffect(() => {
    const largar = () => router.refresh()
    window.addEventListener(PAGINAS_MUDARAM, largar)
    return () => window.removeEventListener(PAGINAS_MUDARAM, largar)
  }, [router])
  return null
}
