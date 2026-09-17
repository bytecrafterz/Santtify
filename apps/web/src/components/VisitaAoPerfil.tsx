'use client'

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
 */
export function VisitaAoPerfil({ projectId, userId }: { projectId: string; userId: string }) {
  const { usuario, carregando } = useAuth()
  if (carregando) return null
  if (usuario?.id === userId) return null
  return <RastreadorDeVisita projectId={projectId} type="PAGE_VIEW" props={{ perfilId: userId }} />
}
