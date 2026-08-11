'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { social } from '@/lib/social'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * "My Post" — publicar no próprio perfil.
 *
 * Publica a música que a pessoa está ouvindo, com uma legenda escrita por ela
 * e, desde 12/08, com uma foto do aparelho.
 *
 * A foto é opcional, e a legenda também: publicar só a música é um uso
 * legítimo, e exigir texto faria a pessoa desistir no meio.
 *
 * Publicação com foto passa pela aprovação do responsável antes de aparecer, e
 * a tela diz isso ANTES do envio, não depois. Descobrir que a foto não apareceu
 * e não entender por quê faria a criança reenviar várias vezes.
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
  const [foto, definirFoto] = useState<File | null>(null)
  const [previa, definirPrevia] = useState<string | null>(null)
  const [enviando, definirEnviando] = useState(false)
  const [publicado, definirPublicado] = useState<'nao' | 'direto' | 'aguardando'>('nao')
  const [erro, definirErro] = useState<string | null>(null)
  const seletor = useRef<HTMLInputElement>(null)

  // A prévia é um endereço temporário criado pelo navegador. Sem devolvê-lo, a
  // imagem fica presa na memória a cada troca de foto.
  useEffect(() => {
    if (!foto) return definirPrevia(null)
    const endereco = URL.createObjectURL(foto)
    definirPrevia(endereco)
    return () => URL.revokeObjectURL(endereco)
  }, [foto])

  if (!usuario) {
    return (
      <p className="aviso-social">
        <Link href={`/${projectSlug}/entrar`}>Entre na sua conta</Link> para publicar esta
        música no seu perfil.
      </p>
    )
  }

  if (publicado !== 'nao') {
    return (
      <p className="aviso-social">
        {publicado === 'aguardando'
          ? 'Enviado. A sua foto vai aparecer no perfil assim que for aprovada. '
          : 'Publicado no seu perfil. '}
        <Link href={`/${projectSlug}/perfil`}>Ver em My Post</Link>
      </p>
    )
  }

  function escolher(arquivo: File | undefined) {
    definirErro(null)
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
      definirErro('Por enquanto dá para enviar foto. Vídeo ainda não.')
      return
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      definirErro('Esta foto é grande demais. O limite é de 12 MB.')
      return
    }
    definirFoto(arquivo)
  }

  async function publicar() {
    definirEnviando(true)
    definirErro(null)
    try {
      const criada = await social.publicar(
        contentId,
        projectId,
        legenda.trim() || undefined,
        foto ?? undefined,
      )
      definirPublicado(criada.aguardandoAprovacao ? 'aguardando' : 'direto')
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
      <p className="nota">Vai aparecer em My Post, junto com {titulo}.</p>

      <textarea
        value={legenda}
        onChange={(e) => definirLegenda(e.target.value)}
        placeholder="Escreva algo sobre esta música (opcional)"
        rows={3}
        maxLength={1000}
      />

      <input
        ref={seletor}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => escolher(e.target.files?.[0])}
      />

      {previa ? (
        <div className="foto-escolhida">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previa} alt="Foto escolhida" />
          <button
            type="button"
            className="secundario"
            onClick={() => {
              definirFoto(null)
              if (seletor.current) seletor.current.value = ''
            }}
          >
            Remover foto
          </button>
        </div>
      ) : (
        <button type="button" className="secundario" onClick={() => seletor.current?.click()}>
          Adicionar uma foto
        </button>
      )}

      {foto && (
        <p className="nota">
          Fotos passam pela aprovação do responsável antes de aparecerem no perfil.
        </p>
      )}

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

/** O mesmo limite que o servidor aplica; aqui só para avisar antes do envio. */
const TAMANHO_MAXIMO = 12 * 1024 * 1024
