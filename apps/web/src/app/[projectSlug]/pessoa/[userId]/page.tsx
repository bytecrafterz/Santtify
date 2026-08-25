import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api, type PerfilAnfitriao } from '@/lib/api'
import { PerfilDePessoa } from '@/components/PerfilDePessoa'
import { IntroducaoEmCartoes } from '@/components/IntroducaoEmCartoes'
import { IntroducaoRecolhivel } from '@/components/IntroducaoRecolhivel'
import { ExperienciaContinua } from '@/components/ExperienciaContinua'
import { BarraInferior } from '@/components/BarraInferior'

export const metadata = { title: 'Perfil' }

/**
 * O perfil público de uma pessoa qualquer, aberto a partir de um comentário.
 *
 * Antes, tocar na foto ou no nome de quem comentou não fazia nada: as pessoas
 * apareciam mas não existiam como sítio para onde ir. Num sistema social isso
 * é meio caminho — vê-se quem falou e não se sabe quem é.
 *
 * Mostra só o que a própria pessoa escolheu pôr no perfil. Nada de e-mail,
 * nada de histórico: quem comenta uma letra não está a autorizar que a
 * examinem.
 */
export default async function PaginaDePessoa({
  params,
}: {
  params: Promise<{ projectSlug: string; userId: string }>
}) {
  const { projectSlug, userId } = await params
  const projeto = await api.projeto(projectSlug)
  if (!projeto) notFound()

  // A plataforma inteira, para o perfil não ser um beco.
  const indice = await api.indice(projectSlug)
  const semLetra = indice?.contents.find((c) => !c.letra && c.publicado)
  const introducao = semLetra
    ? await api.conteudo(projectSlug, semLetra.slug).catch(() => null)
    : null

  // As categorias que ele criou no painel, para o filtro do tocador.
  const cats = await api.categorias(projectSlug).catch(() => null)

  const base = process.env.NEXT_PUBLIC_API_URL ?? ''
  // Os números sociais deixam de ser lidos aqui. Lidos no servidor, vinham
  // sempre sem sessão — e sem sessão o servidor responde como responde a um
  // visitante: "ninguém curtiu isto, muito menos tu". Quem os lê agora é o
  // componente, no navegador, já com a sessão de quem está a ver.
  const pessoaRes = await fetch(`${base}/profiles/${userId}`, { next: { revalidate: 30 } })
  if (!pessoaRes.ok) notFound()

  const pessoa = (await pessoaRes.json()) as PerfilAnfitriao

  return (
    <main className="envoltorio com-barra">
      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← Voltar</Link>
      </div>

      <div className="perfil-capa sangria">
        {pessoa.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-capa" src={pessoa.avatarUrl} alt={pessoa.displayName} />
        ) : (
          <div className="foto-capa capa-vazia">
            <span aria-hidden>👤</span>
            <span>Sem fotografia</span>
          </div>
        )}
        <div className="nome-no-retrato">
          <h1 title={pessoa.displayName}>{pessoa.displayName}</h1>
        </div>
      </div>

      {pessoa.guardianName && <p className="responsavel-perfil">{pessoa.guardianName}</p>}
      {pessoa.bio && <p className="bio-perfil">{pessoa.bio}</p>}

      <PerfilDePessoa pessoa={pessoa} projectId={projeto.id} projectSlug={projectSlug} />

      {/* E POR BAIXO, A PLATAFORMA — igual ao perfil dele e ao de quem entra.
          Ele disse-o em 25/08 depois de abrir o perfil da Kadosh: "não pode
          abrir numa página praticamente vazia mostrando apenas Publicações".
          Tinha razão. Um perfil que não leva a lado nenhum é uma saída sem
          porta: quem lá chega por um comentário fica preso, e o único caminho
          de volta é o botão do navegador. */}
      <IntroducaoRecolhivel nome={projeto.name}>
        {introducao && (
          <IntroducaoEmCartoes
            contentId={introducao.content.id}
            blocos={introducao.content.blocks}
            projectId={projeto.id}
            projectSlug={projectSlug}
            categorias={cats?.categorias ?? []}
          />
        )}
      </IntroducaoRecolhivel>

      {indice && indice.contents.length > 0 && (
        <ExperienciaContinua
          projectSlug={projectSlug}
          projectId={projeto.id}
          contents={indice.contents}
          progresso={indice.progresso}
          categorias={cats?.categorias ?? []}
        />
      )}

      <BarraInferior projectSlug={projectSlug} linkPdf={projeto.checkoutUrl ?? null} />

      <p className="nota">
        Na plataforma desde{' '}
        {new Date(pessoa.createdAt).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </p>
    </main>
  )
}
