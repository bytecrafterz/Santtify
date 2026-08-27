'use client'

import { useState } from 'react'
import { auth, ErroDeApi, type PerfilResposta } from '@/lib/auth'

/**
 * Edição do próprio perfil: fotografia, nome, descrição e responsável.
 *
 * Fechado por padrão, como a troca de senha: o perfil serve para ver os
 * próprios números, e um formulário sempre aberto empurra esses números para
 * fora do ecrã do telemóvel.
 *
 * A pré-visualização da foto usa um URL local do próprio navegador, então a
 * pessoa vê o retrato antes de gravar. Sem isso, ela envia às cegas e só
 * descobre que escolheu a fotografia errada depois de já estar publicada.
 */
export function EditarPerfil({
  perfil,
  aoGravar,
}: {
  perfil: PerfilResposta
  aoGravar: (novo: PerfilResposta) => void
}) {
  const [aberto, definirAberto] = useState(false)
  const [nome, definirNome] = useState(perfil.user.displayName)
  const [descricao, definirDescricao] = useState(perfil.user.bio ?? '')
  const [responsavel, definirResponsavel] = useState(perfil.user.guardianName ?? '')
  const [foto, definirFoto] = useState<File | null>(null)
  const [previa, definirPrevia] = useState<string | null>(null)
  const [gravando, definirGravando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  function escolherFoto(arquivo: File | null) {
    definirFoto(arquivo)
    if (previa) URL.revokeObjectURL(previa)
    definirPrevia(arquivo ? URL.createObjectURL(arquivo) : null)
  }

  function fechar() {
    if (previa) URL.revokeObjectURL(previa)
    definirPrevia(null)
    definirFoto(null)
    definirErro(null)
    definirAberto(false)
  }

  async function gravar(e: React.FormEvent) {
    e.preventDefault()
    definirErro(null)

    if (nome.trim().length < 2) {
      definirErro('O nome precisa ter pelo menos 2 letras.')
      return
    }

    definirGravando(true)
    try {
      const novo = await auth.atualizarPerfil({
        displayName: nome,
        bio: descricao,
        guardianName: responsavel,
        foto,
      })
      aoGravar(novo)
      fechar()
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível gravar agora.')
    } finally {
      definirGravando(false)
    }
  }

  if (!aberto) {
    return (
      <div className="acoes-perfil">
        <button
          type="button"
          className="secundario"
          onClick={() => {
            definirAberto(true)
            /*
              LEVAR A PESSOA ATÉ AO FORMULÁRIO, e não deixá-la a olhar para o
              sítio onde o botão estava.

              O formulário tem 714px e abre por baixo do que se está a ver. Num
              ecrã de telemóvel ele ficava fora de vista, e as saídas ficavam a
              534px abaixo da dobra. Ele escreveu em 27/08 "fiquei preso nessa
              parte": não estava preso, estava a olhar para o meio de um
              formulário sem ver que tinha Cancelar e Gravar mais abaixo.
            */
            requestAnimationFrame(() => {
              document
                .querySelector('.editar-perfil')
                ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
            })
          }}
        >
          Editar perfil
        </button>
      </div>
    )
  }

  return (
    <form className="bloco formulario editar-perfil" onSubmit={gravar}>
      <span className="bloco-rotulo">Editar perfil</span>

      <label htmlFor="perfil-foto">Fotografia</label>
      {previa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="previa-avatar" src={previa} alt="Pré-visualização da fotografia" />
      ) : (
        perfil.user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="previa-avatar" src={perfil.user.avatarUrl} alt="Fotografia actual" />
        )
      )}
      <input
        id="perfil-foto"
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.heic,.webp"
        onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)}
      />

      <label htmlFor="perfil-nome">Nome</label>
      <input
        id="perfil-nome"
        type="text"
        maxLength={80}
        value={nome}
        onChange={(e) => definirNome(e.target.value)}
        required
      />

      <label htmlFor="perfil-descricao">Descrição</label>
      <textarea
        id="perfil-descricao"
        maxLength={1000}
        rows={5}
        value={descricao}
        onChange={(e) => definirDescricao(e.target.value)}
      />

      <label htmlFor="perfil-responsavel">Quem acompanha este perfil</label>
      <input
        id="perfil-responsavel"
        type="text"
        maxLength={80}
        placeholder="Ex.: acompanhado pelo pai, Rossandro Caxito"
        value={responsavel}
        onChange={(e) => definirResponsavel(e.target.value)}
      />
      <p className="nota">
        Se este perfil for de uma criança, diga aqui quem toma conta dele. Fica visível junto ao
        nome.
      </p>

      {erro && <p className="erro">{erro}</p>}

      <div className="tocador-controles">
        <button type="button" className="secundario" onClick={fechar}>
          Cancelar
        </button>
        <button type="submit" disabled={gravando}>
          {gravando ? 'A gravar...' : 'Gravar'}
        </button>
      </div>
    </form>
  )
}
