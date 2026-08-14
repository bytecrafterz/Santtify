'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { admin, type CategoriaAdmin } from '@/lib/admin'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Categorias de áudio do projeto.
 *
 * Pedido do cliente em 14/08: cada letra terá vários áudios — explicação,
 * música, memorização do versículo, oração — e ele quer poder criar categorias
 * novas sozinho, sem esperar por mim.
 *
 * Por isso é uma tabela e não uma lista fixa no código: qualquer ideia futura
 * dele vira uma linha aqui, e a playlist ganha o filtro correspondente sem
 * ninguém tocar no sistema.
 */
export function CategoriasDeAudio({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [categorias, definirCategorias] = useState<CategoriaAdmin[] | null>(null)
  const [nova, definirNova] = useState('')
  const [ocupado, definirOcupado] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

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
    void recarregar()
  }, [usuario, carregando, projectSlug, router])

  async function recarregar() {
    try {
      const r = await admin.categorias(projectSlug)
      definirCategorias(r.categorias)
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível carregar')
    }
  }

  async function criar(evento: React.FormEvent) {
    evento.preventDefault()
    const nome = nova.trim()
    if (nome.length < 2) return
    definirOcupado(true)
    definirErro(null)
    try {
      await admin.criarCategoria(projectSlug, nome)
      definirNova('')
      await recarregar()
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível criar')
    } finally {
      definirOcupado(false)
    }
  }

  async function renomear(c: CategoriaAdmin) {
    const nome = window.prompt('Novo nome da categoria:', c.name)
    if (nome === null) return
    definirOcupado(true)
    try {
      await admin.renomearCategoria(c.id, nome.trim())
      await recarregar()
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível renomear')
    } finally {
      definirOcupado(false)
    }
  }

  async function remover(c: CategoriaAdmin) {
    // O número de áudios vai na pergunta: apagar uma categoria vazia é
    // inofensivo, apagar uma com trinta áudios dentro tira todos eles dos
    // filtros da playlist. Quem decide precisa ver a diferença.
    const aviso =
      c.audios && c.audios > 0
        ? `Apagar a categoria "${c.name}"? Os ${c.audios} áudios dela continuam existindo e tocando, mas ficam sem categoria e somem dos filtros da playlist até você classificá-los de novo.`
        : `Apagar a categoria "${c.name}"?`
    if (!window.confirm(aviso)) return
    definirOcupado(true)
    try {
      await admin.removerCategoria(c.id)
      await recarregar()
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível apagar')
    } finally {
      definirOcupado(false)
    }
  }

  if (erro && !categorias) return <p className="erro">{erro}</p>
  if (carregando || categorias === null) return <p className="vazio">Carregando...</p>

  return (
    <>
      <form className="bloco criar-categoria" onSubmit={criar}>
        <span className="bloco-rotulo">Nova categoria</span>
        <p className="nota">
          Por exemplo: Explicação, Música, Memorização do versículo, Oração. Depois de criada,
          ela aparece como filtro na Minha Playlist e você escolhe a categoria de cada áudio
          na página da letra.
        </p>
        <input
          value={nova}
          onChange={(e) => definirNova(e.target.value)}
          placeholder="Nome da categoria"
          maxLength={60}
        />
        <button type="submit" disabled={ocupado || nova.trim().length < 2}>
          {ocupado ? 'Salvando...' : 'Criar categoria'}
        </button>
      </form>

      {erro && <p className="erro">{erro}</p>}

      {categorias.length === 0 ? (
        <div className="bloco">
          <p className="bloco-vazio">Nenhuma categoria ainda.</p>
        </div>
      ) : (
        <ul className="lista">
          {categorias.map((c) => (
            <li className="bloco item-categoria" key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <small>
                  {c.audios === 0
                    ? 'nenhum áudio ainda'
                    : c.audios === 1
                      ? '1 áudio'
                      : `${c.audios} áudios`}
                </small>
              </div>
              <div className="acoes-categoria">
                <button type="button" className="secundario" disabled={ocupado} onClick={() => renomear(c)}>
                  Renomear
                </button>
                <button type="button" className="remover" disabled={ocupado} onClick={() => remover(c)}>
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
