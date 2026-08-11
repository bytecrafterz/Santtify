'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { admin, type PublicacaoPendente } from '@/lib/admin'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Fila de aprovação das fotos do My Post.
 *
 * A foto aparece grande e inteira, sem corte: o recorte quadrado esconderia
 * justamente o canto onde costuma estar o problema — outra criança ao fundo,
 * um rosto, o nome de uma escola.
 *
 * Recusar pede um motivo em texto livre, e o motivo vai para o autor. Recusar
 * em silêncio faria a criança reenviar a mesma foto até desistir.
 *
 * Os itens saem da lista assim que são decididos, sem recarregar tudo: com uma
 * fila grande, recarregar mudaria a posição do que está na tela no meio de uma
 * decisão.
 */
export function FilaDeModeracao({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [pendentes, definirPendentes] = useState<PublicacaoPendente[] | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(`/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
      return
    }
    if (usuario.role !== 'ADMIN') {
      definirErro('Esta área é restrita ao administrador.')
      return
    }
    admin
      .publicacoesPendentes(projectSlug)
      .then((r) => definirPendentes(r.posts))
      .catch((e) => definirErro(e.message))
  }, [usuario, carregando, projectSlug, router])

  async function decidir(post: PublicacaoPendente, aprovar: boolean) {
    let nota: string | undefined
    if (!aprovar) {
      const escrito = window.prompt(
        'Por que esta publicação não foi aprovada? O texto aparece para quem publicou.',
        '',
      )
      if (escrito === null) return
      nota = escrito.trim() || undefined
    }
    definirOcupado(post.id)
    try {
      await admin.moderarPublicacao(post.id, aprovar, nota)
      definirPendentes((atual) => (atual ?? []).filter((p) => p.id !== post.id))
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível concluir')
    } finally {
      definirOcupado(null)
    }
  }

  if (erro) return <p className="erro">{erro}</p>
  if (carregando || pendentes === null) return <p className="vazio">Carregando...</p>

  if (pendentes.length === 0) {
    return (
      <div className="bloco">
        <p className="bloco-vazio">
          Nenhuma publicação aguardando aprovação. Fotos enviadas pelos usuários aparecem aqui
          antes de ficarem visíveis no perfil.
        </p>
      </div>
    )
  }

  return (
    <ul className="lista">
      {pendentes.map((p) => (
        <li className="bloco moderacao-item" key={p.id}>
          <p className="moderacao-quem">
            {p.user.displayName} · {formatarData(p.createdAt)} · em{' '}
            <Link href={`/${p.content.project.slug}/${p.content.slug}`}>{p.content.title}</Link>
          </p>

          {p.imageAsset && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageAsset.url} alt={p.body ?? 'Foto aguardando aprovação'} />
          )}

          {p.body && <p className="bloco-texto">{p.body}</p>}

          <div className="moderacao-acoes">
            <button
              type="button"
              className="recusar"
              disabled={ocupado === p.id}
              onClick={() => decidir(p, false)}
            >
              Recusar
            </button>
            <button
              type="button"
              className="aprovar"
              disabled={ocupado === p.id}
              onClick={() => decidir(p, true)}
            >
              {ocupado === p.id ? 'Salvando...' : 'Aprovar'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
