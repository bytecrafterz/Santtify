import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { api } from '@/lib/api'
import { RastreadorDeVisita } from '@/components/RastreadorDeVisita'
import { BannerDeConsentimento } from '@/components/BannerDeConsentimento'
import { AvisosDeEntrada } from '@/components/AvisosDeEntrada'
import { CabecalhoDePerfil } from '@/components/CabecalhoDePerfil'
import { CarrosselDeProjetos } from '@/components/CarrosselDeProjetos'
import { BarraInferior } from '@/components/BarraInferior'

/**
 * A PÁGINA INICIAL: o perfil e os projetos, e mais nada.
 *
 * Isto era um `redirect()` para o Jesus Alfabeto. Fazia sentido enquanto havia
 * um projeto só — e o comentário que aqui estava dizia isso mesmo, que quando o
 * multi-projeto chegasse esta página viraria a vitrine. Chegou: são três.
 *
 * O que forçou a mudança foi ele, em 22/09, depois de tocar num projeto e
 * encontrar a página inicial outra vez por cima dele:
 *
 *   "Hoje eu clico em Minha Identidade e Poder em Jesus, os sete blocos
 *    aparecem mais abaixo, mas continuam aparecendo acima o Jesus Alfabeto
 *    Saudável, Minha Identidade e Poder em Jesus, perfil e outros conteúdos da
 *    página inicial. Eu não quero assim. (...) Quero navegação para uma página
 *    própria, limpa, mostrando 100% daquele conteúdo. Depois, quando eu voltar
 *    para a página inicial, aí sim aparecem novamente perfil, projetos e os
 *    demais conteúdos."
 *
 * Ele não estava a descrever um defeito de um botão. Estava a descrever a
 * página: TODA a página de projeto desenhava o perfil e o carrossel por cima do
 * conteúdo, e por isso tocar num projeto parecia não sair do sítio.
 *
 * O PERFIL AQUI É O DO ANFITRIÃO DO PROJETO PRINCIPAL, e não um perfil novo: é
 * a conta Santtify, a mesma que ele vê hoje no topo. Nada foi inventado para
 * esta página — o que ela faz é ficar com as duas peças que pertenciam à
 * entrada, e deixar as páginas de projeto só com o projeto.
 */
const PROJETO_PADRAO = process.env.NEXT_PUBLIC_PROJETO_PADRAO ?? 'jesus-alfabeto-saudavel'

export const metadata: Metadata = {
  title: 'Santtify',
  description: 'Rede social cristã — projetos para a família toda.',
}

export default async function PaginaInicial() {
  const dados = await api.indice(PROJETO_PADRAO)
  if (!dados) notFound()

  const { project, anfitriao, comunidade } = dados

  return (
    <main className="envoltorio com-barra">
      <RastreadorDeVisita
        projectId={project.id}
        type="PAGE_VIEW"
        props={anfitriao ? { perfilId: anfitriao.id } : undefined}
      />

      <CabecalhoDePerfil
        preferirOUtilizador
        projectSlug={PROJETO_PADRAO}
        projectId={project.id}
        perfisCriados={comunidade.perfis}
        anfitriao={anfitriao}
      />

      {/*
        Os projetos, debaixo do perfil — a posição do mockup dele.

        Aqui é o único sítio onde o carrossel aparece. Enquanto ele estava
        também nas páginas de projeto, tocar num card levava a uma página que
        começava pelo mesmo carrossel, com o mesmo card lá dentro. Era isso que
        fazia parecer que o projeto tinha apenas "aberto mais abaixo".
      */}
      <CarrosselDeProjetos />

      <AvisosDeEntrada projectSlug={PROJETO_PADRAO} />
      <BannerDeConsentimento projectId={project.id} />
      <BarraInferior projectSlug={PROJETO_PADRAO} linkPdf={project.checkoutUrl ?? null} />
    </main>
  )
}
