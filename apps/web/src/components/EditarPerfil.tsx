'use client'

import { useState } from 'react'
import { auth, ErroDeApi, type PerfilResposta } from '@/lib/auth'
import { useAuth } from './ProvedorDeAuth'
import { AjustarFoto } from './AjustarFoto'

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
  projectSlug,
  aoGravar,
  sempreAberto = false,
  aoSair,
}: {
  perfil: PerfilResposta
  /** Para mandar o servidor esquecer as páginas deste projecto depois de gravar. */
  projectSlug: string
  aoGravar: (novo: PerfilResposta) => void
  /**
   * Numa página só de edição não faz sentido um botão que abre o formulário:
   * a pessoa já lá chegou de propósito. Sem isto, ela teria de tocar em
   * "Editar perfil" dentro da página chamada Editar perfil.
   */
  sempreAberto?: boolean
  /** Onde ir quando ela cancela numa página que é só a edição. */
  aoSair?: () => void
}) {
  const { usuario, definirUsuario } = useAuth()
  const [aberto, definirAberto] = useState(sempreAberto)
  const [nome, definirNome] = useState(perfil.user.displayName)
  const [descricao, definirDescricao] = useState(perfil.user.bio ?? '')
  const [responsavel, definirResponsavel] = useState(perfil.user.guardianName ?? '')
  const [foto, definirFoto] = useState<File | null>(null)
  const [porEnquadrar, definirPorEnquadrar] = useState<File | null>(null)
  const [previa, definirPrevia] = useState<string | null>(null)
  const [gravando, definirGravando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  /**
   * A fotografia escolhida vai PRIMEIRO para o enquadramento.
   *
   * Antes ia direita para a pré-visualização e daí para o servidor, e o corte
   * era decidido pelo `object-fit` do avatar, sem ninguém poder opinar. Ele
   * refez a arte mais de dez vezes a tentar adivinhar esse corte.
   */
  function escolherFoto(arquivo: File | null) {
    definirErro(null)
    if (!arquivo) {
      definirPorEnquadrar(null)
      return
    }
    definirPorEnquadrar(arquivo)
  }

  /** Sai do enquadramento com a imagem já cortada: é esta que sobe. */
  function usarRecorte(recortada: File) {
    definirPorEnquadrar(null)
    definirFoto(recortada)
    if (previa) URL.revokeObjectURL(previa)
    definirPrevia(URL.createObjectURL(recortada))
  }

  /** Numa página só de edição, cancelar volta ao perfil em vez de esconder. */
  function fechar() {
    if (previa) URL.revokeObjectURL(previa)
    definirPrevia(null)
    definirFoto(null)
    definirPorEnquadrar(null)
    definirErro(null)
    if (sempreAberto) aoSair?.()
    else definirAberto(false)
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

      /*
        O TOPO DO PERFIL TEM DE MUDAR AGORA, e não no próximo carregamento.

        `aoGravar` actualiza o painel de baixo, que é onde este formulário vive.
        O cabeçalho lá em cima monta-se a partir do utilizador da sessão, que é
        outro objecto, carregado uma vez quando a pessoa entra — e portanto
        continuava a mostrar o nome e a fotografia antigos até se recarregar a
        página. Ele relatou-o em 28/08 com a frase exacta: "preciso sair da
        página e entrar novamente para conseguir enxergar a nova imagem".

        Actualizar aqui os dois é o mínimo honesto. O correcto a prazo é haver
        um só sítio de onde ambos leiam, mas isso é mexer no provedor de sessão
        inteiro, e não é hoje que se faz isso com ele a testar.
      */
      if (usuario) {
        definirUsuario({
          ...usuario,
          displayName: novo.user.displayName,
          avatarUrl: novo.user.avatarUrl,
          bio: novo.user.bio,
          guardianName: novo.user.guardianName,
        })
      }

      /*
        E as páginas que o SERVIDOR desenha também têm de esquecer o que
        guardaram. O cabeçalho aqui em cima já mudou, mas a página inicial —
        onde a fotografia dele é a capa do projecto — foi desenhada no servidor
        e fica guardada 30 segundos. Era isso que o fazia dizer que "muitas
        vezes" continuava a ver a imagem antiga: dependia dos segundos.

        Sem `await`: isto é limpeza, não faz parte de gravar. Se falhar, o
        máximo que acontece é a página velha durar os tais 30 segundos, que é
        exactamente o que acontecia antes.
      */
      void fetch('/revalidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug, userId: novo.user.id }),
      }).catch(() => {})

      /*
        NUMA PÁGINA SÓ DE EDIÇÃO, QUEM SAI É O `aoGravar`, E SÓ ELE.

        Aqui estava `fechar()` sempre. Numa página de edição `fechar()` também
        navega para trás, e como o `aoGravar` já tinha navegado, gravar dava
        DOIS passos atrás em vez de um: ele saía da edição e ia parar duas
        páginas antes de onde tinha entrado. Apanhado a medir o endereço depois
        de gravar, não a ler isto.

        Dentro do perfil, onde o formulário abre e fecha no mesmo ecrã, o
        `fechar()` continua a ser preciso: ali ele não navega, esconde.
      */
      if (!sempreAberto) fechar()
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
      {/*
        A SAÍDA TAMBÉM NO TOPO.

        Havia Cancelar, mas no fim de um formulário de 714px. Quem está em cima
        não vê saída nenhuma, e foi o que ele disse em 29/08: "o usuário não
        pode ficar preso na edição e precisar fechar ou recarregar a página".
        Ele tem razão duas vezes — uma saída que é preciso procurar não é uma
        saída, e esta é a segunda vez que o mesmo formulário me ensina isso.
      */}
      <div className="topo-do-editor">
        <button type="button" className="voltar-do-editor" onClick={fechar}>
          <span aria-hidden>←</span> VOLTAR AO PERFIL
        </button>
      </div>

      <span className="bloco-rotulo">Editar perfil</span>

      <label htmlFor="perfil-foto">Fotografia</label>
      {porEnquadrar && (
        <AjustarFoto
          ficheiro={porEnquadrar}
          aoConfirmar={usarRecorte}
          aoCancelar={() => definirPorEnquadrar(null)}
        />
      )}
      {!porEnquadrar && previa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="previa-avatar" src={previa} alt="Pré-visualização da fotografia" />
      ) : (
        !porEnquadrar &&
        perfil.user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="previa-avatar" src={perfil.user.avatarUrl} alt="Fotografia actual" />
        )
      )}
      <input
        id="perfil-foto"
        hidden={Boolean(porEnquadrar)}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.heic,.webp"
        onChange={(e) => {
          escolherFoto(e.target.files?.[0] ?? null)
          /*
            O CAMPO ESVAZIA-SE PARA A MESMA FOTOGRAFIA PODER SER ESCOLHIDA OUTRA VEZ.

            Sem isto, quem cancela o enquadramento e volta a escolher a MESMA
            imagem não faz acontecer nada: o valor do campo não mudou, o
            navegador não avisa ninguém, e o ecrã de enquadrar não abre. Parece
            que o botão morreu.

            É o caso mais provável dele, que passou uma tarde a tentar enquadrar
            a mesma arte. Encontrado ao andar pelo ecrã, e não a lê-lo.
          */
          e.target.value = ''
        }}
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
          {gravando ? 'A guardar...' : 'SALVAR PERFIL'}
        </button>
      </div>
    </form>
  )
}
