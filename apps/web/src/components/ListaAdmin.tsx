'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { admin, type ItemAdmin } from '@/lib/admin'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Índice do painel: o que já está preenchido e o que falta.
 *
 * A coluna de progresso ("2/4 blocos") existe porque a tarefa real do cliente
 * é cadastrar 26 conteúdos ao longo de dias. Sem ela, ele precisaria abrir um
 * por um para lembrar onde parou.
 */
export function ListaAdmin({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [dados, definirDados] = useState<{ contents: ItemAdmin[] } | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [criando, definirCriando] = useState(false)
  const [aguardando, definirAguardando] = useState<number | null>(null)

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
      .listar(projectSlug)
      .then(definirDados)
      .catch((e) => definirErro(e.message))

    // A contagem entra separada de propósito: se a fila falhar, o painel
    // inteiro não pode deixar de abrir por causa dela.
    admin
      .publicacoesPendentes(projectSlug)
      .then((r) => definirAguardando(r.posts.length))
      .catch(() => definirAguardando(null))
  }, [usuario, carregando, projectSlug, router])

  async function criar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const form = evento.currentTarget
    const fd = new FormData(form)
    definirCriando(true)
    try {
      await admin.criarConteudo(projectSlug, {
        slug: String(fd.get('slug') ?? ''),
        title: String(fd.get('title') ?? ''),
      })
      form.reset()
      definirDados(await admin.listar(projectSlug))
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Erro ao criar')
    } finally {
      definirCriando(false)
    }
  }

  if (erro) return <p className="erro">{erro}</p>
  if (carregando || !dados) return <p className="vazio">Carregando...</p>

  const publicados = dados.contents.filter((c) => c.status === 'PUBLISHED').length

  return (
    <>
      <p className="subtitulo">
        {publicados} de {dados.contents.length} conteúdos publicados
      </p>

      <Link className="bloco linha atalho-metricas" href={`/${projectSlug}/admin/metricas`}>
        <span>Ver métricas</span>
        <small>visitantes, origem, propagação e conteúdos mais acessados</small>
      </Link>

      <Link className="bloco linha atalho-metricas" href={`/${projectSlug}/admin/categorias`}>
        <span>Categorias de áudio</span>
        <small>explicação, música, oração — definem os filtros da playlist</small>
      </Link>

      <Link className="bloco linha atalho-metricas" href={`/${projectSlug}/admin/comunidade`}>
        <span>Comunidade</span>
        <small>apagar comentário impróprio e bloquear conta</small>
      </Link>

      {/* O atalho de Aprovações só aparece se houver algo esperando. Com o My
          Post fora da interface ninguém publica foto, então a fila fica vazia e
          um atalho para uma tela que nunca tem nada é ruído no painel de quem
          precisa cadastrar 26 letras. A tela continua acessível pelo endereço. */}
      {aguardando ? (
        <Link className="bloco linha atalho-metricas" href={`/${projectSlug}/admin/moderacao`}>
          <span>
            Aprovações
            <em className="contador-fila">{aguardando}</em>
          </span>
          <small>
            {aguardando === 1 ? 'foto aguardando' : 'fotos aguardando'} a sua aprovação
          </small>
        </Link>
      ) : null}

      <ul className="lista">
        {dados.contents.map((c) => {
          const completo = c.blocosTotal > 0 && c.blocosPreenchidos === c.blocosTotal
          return (
            <li key={c.id}>
              <Link className="bloco item-admin" href={`/${projectSlug}/admin/${c.slug}`}>
                <div>
                  <strong>{c.title}</strong>
                  {c.subtitle && <small> — {c.subtitle}</small>}
                  <div className="meta-admin">
                    <span className={c.status === 'PUBLISHED' ? 'etiqueta publicado' : 'etiqueta'}>
                      {c.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
                    </span>
                    <span className={completo ? 'progresso completo' : 'progresso'}>
                      {c.blocosPreenchidos}/{c.blocosTotal} blocos
                    </span>
                    {c.qrCode && <span className="progresso">QR pronto</span>}
                  </div>
                </div>
                <span aria-hidden>›</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <form className="formulario criar-conteudo" onSubmit={criar}>
        <h2>Novo conteúdo</h2>
        <label>
          Título
          <input name="title" required maxLength={160} placeholder="Letra Ç, Episódio 1..." />
        </label>
        <label>
          Endereço na web
          <input name="slug" required maxLength={80} placeholder="letra-c-cedilha" />
          <small>Aparece no link e no QR Code. Use apenas letras, números e hífen.</small>
        </label>
        <button type="submit" disabled={criando}>
          {criando ? 'Criando...' : 'Criar conteúdo'}
        </button>
      </form>
    </>
  )
}
