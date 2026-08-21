import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api, type PerfilAnfitriao } from '@/lib/api'
import { abreviar } from '@/lib/numeros'

export const metadata = { title: 'Perfil' }

/**
 * O perfil público de uma pessoa qualquer, aberto a partir de um comentário.
 *
 * Antes, tocar na foto ou no nome de quem comentou não fazia nada: as pessoas
 * apareciam mas não existiam como sítio para onde ir. Num sistema social isso
 * é meio caminho — vê-se quem falou e não se sabe quem é.
 *
 * Mostra só o que a própria pessoa escolheu pôr no perfil. Nada de e-mail,
 * nada de histórico: quem comenta uma letra não está a autorizar que a
 * examinem.
 */
export default async function PaginaDePessoa({
  params,
}: {
  params: Promise<{ projectSlug: string; userId: string }>
}) {
  const { projectSlug, userId } = await params

  const base = process.env.NEXT_PUBLIC_API_URL ?? ''
  const [pessoaRes, socialRes] = await Promise.all([
    fetch(`${base}/profiles/${userId}`, { next: { revalidate: 30 } }),
    fetch(`${base}/profiles/${userId}/social`, { next: { revalidate: 30 } }),
  ])
  if (!pessoaRes.ok) notFound()

  const pessoa = (await pessoaRes.json()) as PerfilAnfitriao
  const numeros = socialRes.ok
    ? ((await socialRes.json()) as {
        visualizacoes: number
        curtidas: number
        comentarios: number
        compartilhamentos: number
      })
    : null

  return (
    <main className="envoltorio">
      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← Voltar</Link>
      </div>

      <div className="perfil-capa sangria">
        {pessoa.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-capa" src={pessoa.avatarUrl} alt={pessoa.displayName} />
        ) : (
          <div className="foto-capa capa-vazia">
            <span aria-hidden>👤</span>
            <span>Sem fotografia</span>
          </div>
        )}
        <div className="nome-no-retrato">
          <h1 title={pessoa.displayName}>{pessoa.displayName}</h1>
        </div>
      </div>

      {pessoa.guardianName && <p className="responsavel-perfil">{pessoa.guardianName}</p>}
      {pessoa.bio && <p className="bio-perfil">{pessoa.bio}</p>}

      {numeros && (
        <div className="numeros">
          <div className="numero">
            <strong>{abreviar(numeros.visualizacoes)}</strong>
            <span>Visitas</span>
          </div>
          <div className="numero">
            <strong>{abreviar(numeros.curtidas)}</strong>
            <span>Curtidas</span>
          </div>
          <div className="numero">
            <strong>{abreviar(numeros.comentarios)}</strong>
            <span>Comentários</span>
          </div>
          <div className="numero">
            <strong>{abreviar(numeros.compartilhamentos)}</strong>
            <span>Partilhas</span>
          </div>
        </div>
      )}

      <p className="nota">
        Na plataforma desde{' '}
        {new Date(pessoa.createdAt).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </p>
    </main>
  )
}
