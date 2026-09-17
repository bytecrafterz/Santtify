'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * A visita a um perfil, contada só quando vem de fora.
 *
 * A regra já estava escrita na página do perfil: "o dono a olhar para si
 * próprio entra por `/perfil`, que não emite isto". Deixou de ser verdade em
 * 02/09, quando "O meu perfil" passou a abrir o perfil visto de fora, e em
 * 17/09 "Meu Perfil" passou a abrir o mesmo sítio. Sem esta verificação, o dono
 * aumentava o próprio número de cada vez que olhava para si.
 *
 * Espera pela sessão antes de decidir: durante o primeiro instante `usuario`
 * ainda é nulo, e contar nesse instante contaria o dono como visitante.
 *
 * E DECIDE UMA VEZ SÓ. A primeira versão voltava a decidir a cada mudança de
 * sessão, e medido em 17/09: ao carregar em "Sair da conta" no próprio perfil,
 * a sessão desaparece enquanto a página ainda está à vista, a verificação passa
 * a achar que é um visitante, e o dono contava uma visita a si próprio no
 * instante em que saía. Quem estava a ver quando a página abriu é quem conta.
 *
 * QUANDO É O DONO, A PÁGINA PEDE-SE OUTRA VEZ AO SERVIDOR, uma vez. Gravar a
 * edição volta a este ecrã com "voltar", e voltar reaproveita a página que o
 * navegador já tinha — com o nome antigo. Quem acabou de mudar o próprio nome
 * tem de o ver mudado. Aos visitantes não se faz isto: não mudaram nada.
 */
export function VisitaAoPerfil({ projectId, userId }: { projectId: string; userId: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const decisao = useRef<'contar' | 'ignorar' | null>(null)
  const refrescado = useRef(false)

  if (decisao.current === null && !carregando) {
    decisao.current = usuario?.id === userId ? 'ignorar' : 'contar'
  }

  useEffect(() => {
    if (decisao.current === 'ignorar' && !refrescado.current) {
      refrescado.current = true
      router.refresh()
    }
  })

  if (decisao.current !== 'contar') return null
  return <RastreadorDeVisita projectId={projectId} type="PAGE_VIEW" props={{ perfilId: userId }} />
}
