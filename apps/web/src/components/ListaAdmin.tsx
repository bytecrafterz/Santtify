'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { admin } from '@/lib/admin'
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
  const [dados, definirDados] = useState<Awaited<ReturnType<typeof admin.listar>> | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aguardando, definirAguardando] = useState<number | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(
        `/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname),
      )
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

  if (erro) return <p className="erro">{erro}</p>
  if (carregando || !dados) return <p className="vazio">Carregando...</p>

  const publicados = dados.contents.filter((c) => c.status === 'PUBLISHED').length

  return (
    <>
      <p className="subtitulo">
        {publicados} de {dados.contents.length} conteúdos publicados
      </p>

      {/* AJUDA E SUPORTE fica acima de tudo. Quem está à espera de entrar
          não pode ficar por baixo de métricas e categorias — é a única coisa
          desta lista em que há uma pessoa parada do outro lado. */}
      <Link className="bloco linha atalho-suporte" href={`/${projectSlug}/admin/suporte`}>
        <span>Ajuda e suporte</span>
        <small>quem ficou sem entrar, e o que fazer por essa pessoa</small>
      </Link>

      {/* A entrada nova fica em PRIMEIRO. É por aqui que ele vai trabalhar
          agora, e enterrá-la no meio dos atalhos antigos seria pedir-lhe que
          procurasse a coisa que acabou de pedir. */}
      <Link className="bloco linha atalho-alfabeto" href={`/${projectSlug}/admin/estrutura`}>
        <span>Estrutura raiz</span>
        <small>perfil + introdução + alfabeto — as três partes da página, numa só raiz</small>
      </Link>

      {/*
        O PRODUTO VIVO TEM PÁGINA PRÓPRIA.

        Vivia dentro da Estrutura raiz e só lá. Eu disse-lhe onde era e ele
        respondeu em 26/08 que entrou no painel e "não encontrou de forma
        clara". Uma coisa que existe mas que é preciso explicar por mensagem
        para se achar não está no painel: está escondida nele.

        Ganhou entrada própria nessa altura, mas a entrada levava a uma âncora
        DENTRO da página do perfil, e ele voltou a pedir em 28/08 que fossem
        separados. Tinha razão outra vez: um atalho com nome próprio que abre a
        página de outra coisa é meio caminho, e meio caminho lê-se como defeito.
      */}
      <Link className="bloco linha atalho-alfabeto" href={`/${projectSlug}/admin/produto-vivo`}>
        <span>Produto Vivo</span>
        <small>as imagens e a arte com áudio que as empresas veem</small>
      </Link>

      <Link className="bloco linha atalho-alfabeto" href={`/${projectSlug}/admin/alfabeto`}>
        <span>Alfabeto — sequência infinita</span>
        <small>
          26 letras, quatro cartões em cada uma: foto, áudio, título e texto numa peça só
        </small>
      </Link>

      {/* As duas funções novas de 09/09. Ficam a seguir ao conteúdo e antes das
          métricas porque é isso que são: sítios onde ele MEXE, e não sítios
          onde ele olha. */}
      <Link className="bloco linha atalho-alfabeto" href={`/${projectSlug}/admin/cartoes`}>
        <span>Cartões personalizados</span>
        <small>
          os modelos, as medidas da moldura da foto, o preço e o desconto
        </small>
      </Link>

      <Link className="bloco linha atalho-alfabeto" href={`/${projectSlug}/admin/carrossel`}>
        <span>Carrossel de projetos</span>
        <small>os dois destaques do perfil e a criação de projetos novos</small>
      </Link>

      <Link className="bloco linha atalho-metricas" href={`/${projectSlug}/admin/metricas`}>
        <span>Ver métricas</span>
        <small>visitantes, origem, propagação e conteúdos mais acessados</small>
      </Link>

      <LinkDeCompra
        projectSlug={projectSlug}
        atual={dados.project.checkoutUrl ?? null}
        aoMudar={async () => definirDados(await admin.listar(projectSlug))}
      />

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
          <small>{aguardando === 1 ? 'foto aguardando' : 'fotos aguardando'} a sua aprovação</small>
        </Link>
      ) : null}

      {/*
        A LISTA DE TODOS OS CONTEÚDOS SAIU DAQUI.

        Estava por baixo dos atalhos e repetia tudo o que a Estrutura raiz e o
        Alfabeto já fazem, mas pelo editor antigo, o de blocos soltos. Ele
        apanhou os dois em 26/08: "vejo Introdução num lugar e também Estrutura
        raiz noutro, não estou entendendo por que existem os dois".

        Tinha razão, e a resposta é que só um deve ficar. Fica o novo, onde um
        cartão é uma peça inteira. Enquanto os dois existiram, o que ele abria
        pelo caminho antigo mostrava-lhe a Introdução no modelo velho, que é
        exactamente a queixa número um da mesma mensagem.
      */}
    </>
  )
}

/**
 * O link externo de compra do projeto.
 *
 * Fica no painel principal e não em cada letra: o produto é um só, então ele
 * cola uma vez e o botão aparece nas 26. Por letra seriam 26 lugares para
 * errar e depois manter.
 *
 * O clique no botão do site é registrado antes de a pessoa sair, e o endereço
 * leva junto um código da origem dela — é o que vai permitir, no dia em que a
 * confirmação da Hotmart for ligada, saber de qual canal veio cada venda.
 */
function LinkDeCompra({
  projectSlug,
  atual,
  aoMudar,
}: {
  projectSlug: string
  atual: string | null
  aoMudar: () => Promise<void>
}) {
  const [valor, definirValor] = useState(atual ?? '')
  const [salvando, definirSalvando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const [salvo, definirSalvo] = useState(false)

  async function salvar() {
    if (valor.trim() === (atual ?? '')) return
    definirSalvando(true)
    definirErro(null)
    try {
      await admin.definirLinkDeCompra(projectSlug, valor.trim() || null)
      await aoMudar()
      definirSalvo(true)
      setTimeout(() => definirSalvo(false), 2500)
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível salvar')
    } finally {
      definirSalvando(false)
    }
  }

  return (
    <div className="bloco link-de-compra">
      <span className="bloco-rotulo">Link de compra</span>
      <p className="nota">
        Cole aqui o endereço da Hotmart. O botão de comprar aparece no fim de todas as letras, e
        cada clique fica registrado com a origem da pessoa.
      </p>
      <input
        type="url"
        inputMode="url"
        value={valor}
        placeholder="https://pay.hotmart.com/..."
        onChange={(e) => definirValor(e.target.value)}
        onBlur={salvar}
      />
      {salvando && <p className="nota">Salvando...</p>}
      {salvo && <p className="nota">Salvo.</p>}
      {!atual && !valor && (
        <p className="nota">Enquanto estiver vazio, nenhum botão de compra aparece no site.</p>
      )}
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
