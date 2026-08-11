'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, type PerfilResposta, type Publicacao } from '@/lib/auth'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Perfil do usuário — apenas My Post por enquanto.
 *
 * O cliente decidiu em 11/08 eliminar "Minha Jornada" e "Meus Lançamentos",
 * deixando o perfil com duas áreas: My Post e Minha Playlist. A playlist é o
 * Bloco 1 e entra quando ele aprovar; até lá o perfil mostra só as publicações,
 * e as abas voltam quando houver uma segunda área para alternar.
 *
 * O que ficou para trás, e por que não foi apagado do servidor: a leitura do
 * histórico (`/me/record`) e a vitrine de lançamentos continuam existindo na
 * API, sem nenhuma tela apontando para elas. Este cliente mudou de direção três
 * vezes em três dias, e o backend das duas áreas já está construído e testado —
 * apagar tabela e migration seria destrutivo e irreversível por uma decisão que
 * pode voltar atrás. Sem tela não custa nada manter; reconstruir custaria.
 */
export function PainelDePerfil({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando, sair } = useAuth()
  const [perfil, definirPerfil] = useState<PerfilResposta | null>(null)
  const [publicacoes, definirPublicacoes] = useState<Publicacao[] | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(`/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
      return
    }
    void auth.perfil().then(definirPerfil).catch(() => definirPerfil(null))
  }, [usuario, carregando, router, projectSlug])

  useEffect(() => {
    if (!usuario || publicacoes !== null) return
    void auth.publicacoes().then(definirPublicacoes).catch(() => definirPublicacoes([]))
  }, [usuario, publicacoes])

  if (carregando || !usuario) {
    return <p className="vazio">Carregando...</p>
  }

  return (
    <>
      <div className="perfil-topo">
        <div className="avatar" aria-hidden>
          {usuario.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1>{usuario.displayName}</h1>
          <p className="subtitulo">
            Na plataforma desde{' '}
            {new Date(perfil?.user.createdAt ?? usuario.createdAt).toLocaleDateString('pt-PT', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {perfil && (
        <div className="numeros">
          <Numero valor={perfil.estatisticas.conteudosVistos} rotulo="Conteúdos vistos" />
          <Numero valor={perfil.estatisticas.curtidas} rotulo="Curtidas" />
          <Numero valor={perfil.estatisticas.publicacoes} rotulo="Publicações" />
          <Numero valor={perfil.estatisticas.compartilhamentos} rotulo="Compartilhamentos" />
        </div>
      )}

      <h2>My Post</h2>

      <Lista
        itens={publicacoes}
        vazio="Você ainda não publicou nada. Abra uma letra e toque em Publicar no meu perfil."
        renderizar={(p) => (
          <li className="bloco" key={p.id}>
            {/* O estado vem primeiro: quem publicou uma foto precisa entender
                por que ela ainda não está no perfil antes de olhar o resto. */}
            {p.status === 'PENDING' && (
              <p className="selo-moderacao aguardando">Aguardando aprovação</p>
            )}
            {p.status === 'REJECTED' && (
              <p className="selo-moderacao recusada">
                Esta foto não foi aprovada
                {p.moderationNote ? `: ${p.moderationNote}` : '.'}
              </p>
            )}
            {p.imageAsset && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="foto-publicada" src={p.imageAsset.url} alt={p.body ?? 'Foto publicada'} />
            )}
            {p.body && <p className="bloco-texto">{p.body}</p>}
            <Link
              className="conteudo-publicado"
              href={`/${p.content.project.slug}/${p.content.slug}`}
            >
              <span aria-hidden>♪</span>
              <span>
                <strong>{p.content.title}</strong>
                {p.content.subtitle && <small> — {p.content.subtitle}</small>}
              </span>
            </Link>
            <small>{formatarData(p.createdAt)}</small>
          </li>
        )}
      />

      <div className="acoes-perfil">
        <button
          type="button"
          className="secundario"
          onClick={async () => {
            await sair()
            router.push(`/${projectSlug}`)
          }}
        >
          Sair da conta
        </button>
      </div>
    </>
  )
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="numero">
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  )
}

function Lista<T>({
  itens,
  vazio,
  renderizar,
}: {
  itens: T[] | null
  vazio: string
  renderizar: (item: T) => React.ReactNode
}) {
  if (itens === null) return <p className="vazio">Carregando...</p>
  if (itens.length === 0) {
    return (
      <div className="bloco">
        <p className="bloco-vazio">{vazio}</p>
      </div>
    )
  }
  return <ul className="lista">{itens.map(renderizar)}</ul>
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
