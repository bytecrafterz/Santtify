'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, type ItemDeRegistro, type PerfilResposta, type Publicacao } from '@/lib/auth'
import { useAuth } from '@/components/ProvedorDeAuth'

type Aba = 'publicacoes' | 'registro' | 'lancamentos'

/**
 * Perfil do usuário, com as três seções que o cliente pediu.
 *
 * PENDÊNCIA DE ESCOPO: ele listou "My Posts", "Meu Registro" e "Meus
 * Lançamentos" sem definir as duas últimas. A pergunta foi feita e ainda não
 * respondida. Enquanto isso:
 *
 *   - Minhas Publicações → comentários da pessoa (leitura segura)
 *   - Meu Registro       → histórico de atividade, lido dos eventos brutos
 *   - Meus Lançamentos   → aba presente, conteúdo aguardando definição
 *
 * A aba fica visível, e não escondida, de propósito: o cliente vê que o lugar
 * dela existe e que só falta ele dizer o que entra ali. Adivinhar significaria
 * construir duas vezes.
 */
export function PainelDePerfil({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando, sair } = useAuth()
  const [perfil, definirPerfil] = useState<PerfilResposta | null>(null)
  const [aba, definirAba] = useState<Aba>('publicacoes')
  const [publicacoes, definirPublicacoes] = useState<Publicacao[] | null>(null)
  const [registro, definirRegistro] = useState<ItemDeRegistro[] | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(`/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
      return
    }
    void auth.perfil().then(definirPerfil).catch(() => definirPerfil(null))
  }, [usuario, carregando, router, projectSlug])

  useEffect(() => {
    if (!usuario) return
    if (aba === 'publicacoes' && publicacoes === null) {
      void auth.publicacoes().then(definirPublicacoes).catch(() => definirPublicacoes([]))
    }
    if (aba === 'registro' && registro === null) {
      void auth.registro().then(definirRegistro).catch(() => definirRegistro([]))
    }
  }, [aba, usuario, publicacoes, registro])

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
          <Numero valor={perfil.estatisticas.comentarios} rotulo="Comentários" />
          <Numero valor={perfil.estatisticas.compartilhamentos} rotulo="Compartilhamentos" />
        </div>
      )}

      <div className="abas" role="tablist">
        <BotaoDeAba atual={aba} valor="publicacoes" ao={definirAba}>
          Minhas Publicações
        </BotaoDeAba>
        <BotaoDeAba atual={aba} valor="registro" ao={definirAba}>
          Meu Registro
        </BotaoDeAba>
        <BotaoDeAba atual={aba} valor="lancamentos" ao={definirAba}>
          Meus Lançamentos
        </BotaoDeAba>
      </div>

      {aba === 'publicacoes' && (
        <Lista
          itens={publicacoes}
          vazio="Você ainda não comentou em nenhum conteúdo."
          renderizar={(p) => (
            <li className="bloco" key={p.id}>
              <Link href={`/${p.content.project.slug}/${p.content.slug}`}>
                <strong>{p.content.title}</strong>
              </Link>
              <p className="bloco-texto">{p.body}</p>
              <small>{formatarData(p.createdAt)}</small>
            </li>
          )}
        />
      )}

      {aba === 'registro' && (
        <Lista
          itens={registro}
          vazio="Seu histórico aparece aqui conforme você navega."
          renderizar={(e) => (
            <li className="bloco linha" key={e.id}>
              <span>
                {descreverEvento(e.type)}
                {e.content && (
                  <>
                    {' — '}
                    <Link href={`/${e.content.project.slug}/${e.content.slug}`}>
                      {e.content.title}
                    </Link>
                  </>
                )}
              </span>
              <small>{formatarData(e.occurredAt)}</small>
            </li>
          )}
        />
      )}

      {aba === 'lancamentos' && (
        <div className="bloco">
          <p className="bloco-vazio">
            Esta seção está reservada e ainda vai ser definida junto com você. Assim que
            você me disser o que entra em Meus Lançamentos, ela é preenchida sem mexer no
            resto do perfil.
          </p>
        </div>
      )}

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

function BotaoDeAba({
  atual,
  valor,
  ao,
  children,
}: {
  atual: Aba
  valor: Aba
  ao: (a: Aba) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={atual === valor}
      className={atual === valor ? 'aba ativa' : 'aba'}
      onClick={() => ao(valor)}
    >
      {children}
    </button>
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

/** Nomes voltados ao usuário, não ao banco. */
function descreverEvento(tipo: string): string {
  const nomes: Record<string, string> = {
    SIGNUP: 'Criou a conta',
    CONTENT_VIEW: 'Visitou',
    MEDIA_COMPLETE: 'Ouviu até o fim',
    LIKE: 'Curtiu',
    COMMENT: 'Comentou em',
    SHARE_CREATED: 'Compartilhou',
  }
  return nomes[tipo] ?? tipo
}
