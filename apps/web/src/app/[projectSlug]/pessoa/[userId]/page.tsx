import Link from 'next/link'
import { notFound } from 'next/navigation'
import { api, type PerfilAnfitriao } from '@/lib/api'
import { PerfilDePessoa } from '@/components/PerfilDePessoa'
import { CabecalhoDePerfil } from '@/components/CabecalhoDePerfil'
import { IntroducaoEmCartoes } from '@/components/IntroducaoEmCartoes'
import { IntroducaoRecolhivel } from '@/components/IntroducaoRecolhivel'
import { ExperienciaContinua } from '@/components/ExperienciaContinua'
import { BarraInferior } from '@/components/BarraInferior'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'

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
      {/*
        A VISITA A ESTE PERFIL CONTA.

        O contador de visualizações do perfil lê os eventos PAGE_VIEW que
        trazem `perfilId`, e isso só era emitido na página inicial, para o
        perfil do anfitrião. Abrir o perfil de uma pessoa qualquer não emitia
        nada, e por isso o número ficava parado para sempre.

        Ele apanhou-o em 29/08 do único jeito que se apanha: "entrei várias
        vezes em diferentes perfis e as views não estão aumentando". As
        curtidas subiam, porque essas passam por outro caminho.

        SÓ CONTA QUEM VEM DE FORA. Este ecrã é o perfil visto por outra pessoa;
        o dono a olhar para si próprio entra por `/perfil`, que não emite isto.
        Se emitisse, qualquer um inflacionava o seu próprio número recarregando
        a página, e ele já tem motivos de sobra para desconfiar de números.
      */}
      <RastreadorDeVisita projectId={projeto.id} type="PAGE_VIEW" props={{ perfilId: userId }} />

      <div className="cabecalho">
        <Link href={`/${projectSlug}`}>← Voltar</Link>
      </div>

      {/* O MESMO COMPONENTE DE PERFIL, e não um desenho parecido.
          Havia três: o do anfitrião, o de quem entra, e este. Este ficava
          sempre para trás — o escudo por baixo em vez de sobre a foto, e a
          descrição aberta em vez de recolhida. Ele apanhou as duas em 25/08.
          Enquanto forem três desenhos, um deles diverge sempre, e é sempre o
          que menos gente vê. */}
      <CabecalhoDePerfil
        projectSlug={projectSlug}
        projectId={projeto.id}
        perfisCriados={indice?.comunidade.perfis ?? 0}
        anfitriao={indice?.anfitriao ?? null}
        pessoa={pessoa}
      />

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
    </main>
  )
}
