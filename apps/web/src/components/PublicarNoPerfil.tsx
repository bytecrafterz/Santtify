'use client'

import Link from 'next/link'
import { useState } from 'react'
import { social } from '@/lib/social'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * "My Post" — publicar no próprio perfil a música que a pessoa está ouvindo.
 *
 * O escopo é exatamente o exemplo que o cliente deu: alguém ouvindo uma música
 * do Jesus Alfabeto Saudável e querendo aquilo no perfil dela, com uma legenda
 * escrita por ela. Não há envio de arquivo aqui de propósito — foto e vídeo do
 * aparelho são outro bloco, com moderação, porque envolvem conteúdo de criança.
 *
 * A legenda é opcional: publicar só a música é um uso legítimo, e exigir texto
 * faria a pessoa desistir no meio.
 */
export function PublicarNoPerfil({
  contentId,
  projectId,
  projectSlug,
  titulo,
}: {
  contentId: string
  projectId: string
  projectSlug: string
  titulo: string
}) {
  const { usuario } = useAuth()
  const [aberto, definirAberto] = useState(false)
  const [legenda, definirLegenda] = useState('')
  const [enviando, definirEnviando] = useState(false)
  const [publicado, definirPublicado] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  if (!usuario) {
    return (
      <p className="aviso-social">
        <Link href={`/${projectSlug}/entrar`}>Entre na sua conta</Link> para publicar esta
        música no seu perfil.
      </p>
    )
  }

  if (publicado) {
    return (
      <p className="aviso-social">
        Publicado no seu perfil.{' '}
        <Link href={`/${projectSlug}/perfil`}>Ver em Minhas Publicações</Link>
      </p>
    )
  }

  async function publicar() {
    definirEnviando(true)
    definirErro(null)
    try {
      await social.publicar(contentId, projectId, legenda.trim() || undefined)
      definirPublicado(true)
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível publicar')
      definirEnviando(false)
    }
  }

  if (!aberto) {
    return (
      <button type="button" className="publicar-abrir" onClick={() => definirAberto(true)}>
        Publicar no meu perfil
      </button>
    )
  }

  return (
    <div className="bloco publicar-caixa">
      <span className="bloco-rotulo">Publicar no meu perfil</span>
      <p className="nota">Vai aparecer em Minhas Publicações, junto com {titulo}.</p>
      <textarea
        value={legenda}
        onChange={(e) => definirLegenda(e.target.value)}
        placeholder="Escreva algo sobre esta música (opcional)"
        rows={3}
        maxLength={1000}
      />
      {erro && <p className="erro">{erro}</p>}
      <div className="publicar-acoes">
        <button type="button" className="secundario" onClick={() => definirAberto(false)}>
          Cancelar
        </button>
        <button type="button" onClick={publicar} disabled={enviando}>
          {enviando ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </div>
  )
}
