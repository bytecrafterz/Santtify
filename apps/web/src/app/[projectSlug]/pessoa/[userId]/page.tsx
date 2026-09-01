import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { api, type PerfilAnfitriao } from '@/lib/api'
import { PerfilDePessoa } from '@/components/PerfilDePessoa'
import { CabecalhoDePerfil } from '@/components/CabecalhoDePerfil'
import { IntroducaoEmCartoes } from '@/components/IntroducaoEmCartoes'
import { IntroducaoRecolhivel } from '@/components/IntroducaoRecolhivel'
import { ExperienciaContinua } from '@/components/ExperienciaContinua'
import { BarraInferior } from '@/components/BarraInferior'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'

/**
 * O CARTÃO DE PARTILHA DE UM PERFIL É A PESSOA.
 *
 * Ele apanhou isto em 02/09, logo a seguir a eu corrigir o das publicações:
 * "se eu compartilhar meu perfil, quem recebe precisa entender visualmente que
 * é o meu perfil, e não simplesmente receber a capa da Santtify". Estava a
 * chegar sempre a capa do projeto, fosse qual fosse o perfil.
 *
 * A fotografia da pessoa, e não a arte de quem não tem: mandar a arte que diz
 * "perfis sem foto serão deletados" como cartão de alguém seria uma acusação
 * pública. Sem fotografia, fica a capa do projeto, que é neutra.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string; userId: string }>
}): Promise<Metadata> {
  const { projectSlug, userId } = await params
  const base = process.env.NEXT_PUBLIC_API_URL ?? ''
  const [projeto, pessoaRes] = await Promise.all([
    api.projeto(projectSlug).catch(() => null),
    fetch(`${base}/profiles/${userId}`, { next: { revalidate: 30 } }).catch(() => null),
  ])
  if (!pessoaRes?.ok) return { title: 'Perfil' }
  const pessoa = (await pessoaRes.json()) as PerfilAnfitriao

  const nome = pessoa.displayName
  const arroba = pessoa.username ? `@${pessoa.username}` : null
  const descricao =
    pessoa.bio?.trim().replace(/\s+/g, ' ').slice(0, 200) ??
    (arroba ? `${arroba} no ${projeto?.name ?? 'Santtify'}` : undefined)

  return {
    title: `${nome} — ${projeto?.name ?? 'Santtify'}`,
    description: descricao,
    openGraph: {
      title: arroba ? `${nome} (${arroba})` : nome,
      description: descricao,
      siteName: projeto?.name,
      images: pessoa.avatarUrl ? [{ url: pessoa.avatarUrl, alt: nome }] : undefined,
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: nome,
      description: descricao,
      images: pessoa.avatarUrl ? [pessoa.avatarUrl] : undefined,
    },
  }
}

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

      {/*
        A FRONTEIRA ENTRE A PESSOA E A PLATAFORMA, ESCRITA.

        Sem esta linha, "Sobre o Jesus Alfabeto Saudável" logo a seguir às
        publicações de alguém lê-se como se ainda fizesse parte do perfil dela,
        e foi assim que ele o leu: "aparece aquela estrutura antiga no meio do
        caminho". A plataforma continua aqui, que foi o pedido dele de 25/08 —
        um perfil que não leva a lado nenhum é uma saída sem porta. O que muda
        é que passa a estar assinada como outra coisa.
      */}
      {/*
        A PLATAFORMA FICA, FECHADA.

        Duas coisas verdadeiras ao mesmo tempo, e demorei a perceber que não se
        contradizem:

        25/08, depois de ele abrir o perfil da Kadosh: "não pode abrir numa
        página praticamente vazia mostrando apenas Publicações". Um perfil que
        não leva a lado nenhum é uma saída sem porta — quem lá chega por um
        comentário fica preso e volta pelo botão do navegador.

        31/08: "ao clicar na foto ou no nome de QUALQUER usuário deve abrir
        DIRETAMENTE o perfil novo, não pode existir uma página intermediária".

        Eu tinha resolvido a primeira pondo a plataforma aberta por baixo, e
        criei a segunda: no perfil dele há 357 pixéis dele antes da plataforma
        começar, no perfil de outra pessoa havia 48, e por isso "Sobre o
        Jesus", "letras liberadas" e "Escolha uma letra" caíam todos no
        primeiro ecrã. Ele leu isso como uma página antiga pelo meio, e estava
        a ler bem.

        Fechada resolve as duas: a porta continua lá, a um toque, e o que abre
        quando se toca no nome de alguém é essa pessoa.

        `<details>` e não um estado meu: abre e fecha sem JavaScript, funciona
        antes de a página hidratar, e o navegador já sabe anunciá-lo a quem usa
        leitor de ecrã. Menos código meu para divergir.
      */}
      <details className="plataforma-no-perfil">
        <summary>
          <span>Conheça o {projeto.name}</span>
        </summary>

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
      </details>

      <BarraInferior projectSlug={projectSlug} linkPdf={projeto.checkoutUrl ?? null} />
    </main>
  )
}
