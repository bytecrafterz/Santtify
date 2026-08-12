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
  const [exigeAprovacao, definirExigeAprovacao] = useState<boolean | null>(null)
  const [trocando, definirTrocando] = useState(false)
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
      .then((r) => {
        definirPendentes(r.posts)
        definirExigeAprovacao(r.project.photoApprovalRequired)
      })
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

  async function trocarChave(exigir: boolean) {
    definirTrocando(true)
    try {
      const r = await admin.definirAprovacaoDeFoto(projectSlug, exigir)
      definirExigeAprovacao(r.photoApprovalRequired)
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível mudar')
    } finally {
      definirTrocando(false)
    }
  }

  if (erro) return <p className="erro">{erro}</p>
  if (carregando || pendentes === null) return <p className="vazio">Carregando...</p>

  return (
    <>
      <Chave
        ligada={exigeAprovacao === true}
        trocando={trocando}
        aoTrocar={trocarChave}
        naFila={pendentes.length}
      />

      {pendentes.length === 0 ? (
        <div className="bloco">
          <p className="bloco-vazio">
            {exigeAprovacao
              ? 'Nenhuma publicação aguardando aprovação. Fotos enviadas pelos usuários aparecem aqui antes de ficarem visíveis no perfil.'
              : 'A aprovação prévia está desligada, então nada chega aqui. As fotos ficam visíveis assim que são enviadas.'}
          </p>
        </div>
      ) : (
        <Fila
          pendentes={pendentes}
          ocupado={ocupado}
          aoDecidir={decidir}
        />
      )}
    </>
  )
}

/**
 * A chave que liga e desliga a aprovação prévia.
 *
 * Fica no alto da própria fila porque é ali que a pergunta aparece: quem abre
 * esta tela e vê trabalho acumulado é exatamente quem precisa saber que dá
 * para desligar — e quem desliga precisa entender, na mesma frase, o que passa
 * a acontecer.
 */
function Chave({
  ligada,
  trocando,
  aoTrocar,
  naFila,
}: {
  ligada: boolean
  trocando: boolean
  aoTrocar: (exigir: boolean) => void
  naFila: number
}) {
  return (
    <div className={ligada ? 'bloco chave-aprovacao' : 'bloco chave-aprovacao desligada'}>
      <span className="bloco-rotulo">Aprovação prévia de fotos</span>
      <p className="bloco-texto">
        {ligada
          ? 'Ligada. Toda foto enviada por um usuário espera aqui e só fica visível depois que você aprovar.'
          : 'Desligada. As fotos ficam públicas no instante do envio, sem passar por você.'}
      </p>
      {!ligada && naFila > 0 && (
        <p className="nota">
          As {naFila} que já estavam na fila continuam esperando a sua decisão.
        </p>
      )}
      <button type="button" className="secundario" disabled={trocando} onClick={() => aoTrocar(!ligada)}>
        {trocando ? 'Salvando...' : ligada ? 'Desligar a aprovação prévia' : 'Ligar a aprovação prévia'}
      </button>
    </div>
  )
}

function Fila({
  pendentes,
  ocupado,
  aoDecidir,
}: {
  pendentes: PublicacaoPendente[]
  ocupado: string | null
  aoDecidir: (p: PublicacaoPendente, aprovar: boolean) => void
}) {
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
              onClick={() => aoDecidir(p, false)}
            >
              Recusar
            </button>
            <button
              type="button"
              className="aprovar"
              disabled={ocupado === p.id}
              onClick={() => aoDecidir(p, true)}
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
