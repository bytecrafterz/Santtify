'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { admin } from '@/lib/admin'
import { vendas, type Resumo } from '@/lib/vendas'
import { reais } from '@/lib/dinheiro'
import { casasDesteProjeto, plural } from '@/lib/unidade'
import { useAuth } from '@/components/ProvedorDeAuth'

type Cor = 'ambar' | 'azul' | 'roxo' | 'verde' | 'vermelho' | 'ciano'

type NomeDoIcone =
  | 'vendas'
  | 'cartoes'
  | 'link'
  | 'estrutura'
  | 'sequencia'
  | 'produto-vivo'
  | 'carrossel'
  | 'karaoke'
  | 'categorias'
  | 'suporte'
  | 'comunidade'
  | 'aprovacoes'
  | 'mensagens'
  | 'metricas'
  | 'relatorios'
  | 'site'
  | 'seta'
  | 'dinheiro'
  | 'carteira'
  | 'pessoas'

/** Os ícones do painel, em traço, na cor de cada grupo. */
function Icone({ nome, tamanho = 22 }: { nome: NomeDoIcone; tamanho?: number }) {
  const tracos: Record<NomeDoIcone, ReactNode> = {
    vendas: (
      <>
        <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </>
    ),
    cartoes: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <circle cx="9" cy="11" r="2.2" />
        <path d="M5.8 16.5c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13.5h3.5" />
      </>
    ),
    link: (
      <>
        <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
        <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
      </>
    ),
    estrutura: (
      <>
        <path d="m12 3 9 4.5-9 4.5-9-4.5z" />
        <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
      </>
    ),
    sequencia: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
      </>
    ),
    'produto-vivo': (
      <>
        <path d="M12 3.5 13.8 9l5.7.2-4.5 3.5 1.6 5.5L12 15l-4.6 3.2L9 12.7 4.5 9.2l5.7-.2z" />
      </>
    ),
    carrossel: (
      <>
        <rect x="6" y="5" width="12" height="14" rx="2" />
        <path d="M3 7.5v9M21 7.5v9" />
        <path d="m8.5 15 2.5-3 2 2.2 1.5-1.7 1.5 2.5" />
      </>
    ),
    karaoke: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
      </>
    ),
    categorias: (
      <>
        <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.2 6.2a1.4 1.4 0 0 1-2 0z" />
        <circle cx="8.2" cy="8.2" r="1.5" />
      </>
    ),
    suporte: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.8" />
        <path d="m5.6 5.6 3.7 3.7M14.7 14.7l3.7 3.7M18.4 5.6l-3.7 3.7M9.3 14.7l-3.7 3.7" />
      </>
    ),
    comunidade: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.9-3.6 3.4-5.5 6.5-5.5s5.6 1.9 6.5 5.5" />
        <circle cx="17" cy="9" r="2.8" />
        <path d="M16.5 14.6c2.5.2 4.3 1.9 5 4.9" />
      </>
    ),
    aprovacoes: (
      <>
        <path d="M12 3 5 6v5.5c0 4.3 3 7.8 7 9.5 4-1.7 7-5.2 7-9.5V6z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </>
    ),
    mensagens: <path d="M4.5 18.5V7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 7v7a2.5 2.5 0 0 1-2.5 2.5H8z" />,
    metricas: <path d="M3.5 17.5 9 12l4 4 7.5-8M15 8h5.5v5.5" />,
    relatorios: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    site: <path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />,
    seta: <path d="M5 12h14M13 6l6 6-6 6" />,
    dinheiro: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15 8.8c-.6-.9-1.7-1.3-3-1.3-1.8 0-3 .9-3 2.2 0 3.3 6 1.7 6 5 0 1.3-1.3 2.3-3.1 2.3-1.4 0-2.6-.5-3.2-1.5M12 5.5v13" />
      </>
    ),
    carteira: (
      <>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
        <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
        <path d="M16 13.5h2" />
      </>
    ),
    pessoas: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tracos[nome]}
    </svg>
  )
}

/** Um atalho do painel: o ícone na cor do grupo, o nome, e o que se faz lá. */
function Cartao({
  href,
  icone,
  cor,
  titulo,
  descricao,
  contador,
}: {
  href: string
  icone: NomeDoIcone
  cor: Cor
  titulo: string
  descricao: string
  contador?: number | null
}) {
  return (
    <Link className={`pi-cartao ${cor}`} href={href}>
      <span className="pi-cartao-icone">
        <Icone nome={icone} />
      </span>
      <span className="pi-cartao-texto">
        <strong>
          {titulo}
          {contador ? <em className="pi-contador">{contador}</em> : null}
        </strong>
        <small>{descricao}</small>
      </span>
      <span className="pi-cartao-seta">
        <Icone nome="seta" tamanho={18} />
      </span>
    </Link>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="pi-grupo">
      <h2>{titulo}</h2>
      <div className="pi-grade">{children}</div>
    </section>
  )
}

/**
 * O PAINEL INICIAL: onde se está, o que pede atenção, e as portas.
 *
 * Era uma coluna de links sublinhados, todos iguais, e a pergunta "o que é
 * que eu tenho para fazer hoje?" não tinha resposta à vista. Agora a página
 * abre com o projeto e os números que importam — vendas, publicação, quem
 * está à espera de ajuda — e as portas vêm arrumadas pelo que se faz lá:
 * vender, publicar, cuidar das pessoas, analisar.
 *
 * As decisões antigas continuam valendo, só com outra roupa:
 *   - a ajuda às pessoas paradas à porta fica sempre à vista;
 *   - as Aprovações só aparecem quando há alguma coisa à espera;
 *   - o Produto Vivo tem página própria (ele não a encontrava, 26/08);
 *   - a sequência chama-se pelo nome da unidade de cada projeto (21/09);
 *   - o projeto actual está sempre dito, com a porta para os outros (24/09);
 *   - a lista antiga de conteúdos não volta: a Estrutura raiz e a sequência
 *     fazem tudo o que ela fazia (26/08).
 */
export function ListaAdmin({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [dados, definirDados] = useState<Awaited<ReturnType<typeof admin.listar>> | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aguardando, definirAguardando] = useState<number | null>(null)
  const [aEsperaDeAjuda, definirAEsperaDeAjuda] = useState<number | null>(null)
  const [resumo, definirResumo] = useState<Resumo | null>(null)
  const [projetos, definirProjetos] = useState<Array<{ slug: string; nome: string }> | null>(null)

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

    // Cada número entra separado de propósito: se um falhar, o painel abre na
    // mesma, só sem esse número.
    admin
      .publicacoesPendentes(projectSlug)
      .then((r) => definirAguardando(r.posts.length))
      .catch(() => definirAguardando(null))
    admin
      .pedidosDeReposicao(projectSlug)
      .then((r) => definirAEsperaDeAjuda(r.pedidos.filter((p) => !p.usedAt && !p.atendidoEm).length))
      .catch(() => definirAEsperaDeAjuda(null))
    vendas
      .resumo({})
      .then(definirResumo)
      .catch(() => definirResumo(null))
    admin
      .projetosDoPainel()
      .then(definirProjetos)
      .catch(() => definirProjetos(null))
  }, [usuario, carregando, projectSlug, router])

  if (erro) return <p className="erro">{erro}</p>
  if (carregando || !dados) {
    return (
      <div className="pi-carregando" aria-label="Carregando">
        <span />
        <span />
        <span />
      </div>
    )
  }

  const unidade = dados.project.unidade ?? 'Letra'
  const unidades = plural(unidade)
  const casas = casasDesteProjeto(dados.project)
  // Os conteúdos todos — as casas e as páginas à volta delas —, como o painel
  // sempre contou. As casas da grade são outra conta (as do cartão abaixo).
  const conteudos = dados.contents.length
  const publicados = dados.contents.filter((c) => c.status === 'PUBLISHED').length
  const percentagem = conteudos ? Math.round((publicados / conteudos) * 100) : 0
  const outros = (projetos ?? []).filter((p) => p.slug !== projectSlug)
  const nome = usuario?.displayName.trim().split(/\s+/)[0] ?? ''
  const base = `/${projectSlug}/admin`

  return (
    <div className="pi">
      <header className="pi-topo">
        <div className="pi-saudacao">
          <span className="pi-etiqueta">Painel de administração</span>
          <h1>{nome ? `Olá, ${nome}` : 'Painel'}</h1>
          <p>
            Você está no projeto <strong>{dados.project.name}</strong>
          </p>
          {outros.length > 0 && (
            <nav className="pi-projetos" aria-label="Ir para outro projeto">
              <span>Ir para</span>
              {outros.map((p) => (
                <Link key={p.slug} href={`/${p.slug}/admin`}>
                  {p.nome}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="pi-topo-acoes">
          <Link className="pi-botao claro" href={`/${projectSlug}`}>
            <Icone nome="site" tamanho={18} /> Ver o site
          </Link>
          <Link className="pi-botao" href={`${base}/vendas`}>
            <Icone nome="vendas" tamanho={18} /> Vendas
          </Link>
        </div>
      </header>

      {(aEsperaDeAjuda || aguardando) ? (
        <div className="pi-alertas">
          {aEsperaDeAjuda ? (
            <Link className="pi-alerta vermelho" href={`${base}/suporte`}>
              <Icone nome="suporte" />
              <span>
                <strong>
                  {aEsperaDeAjuda} {aEsperaDeAjuda === 1 ? 'pessoa esperando' : 'pessoas esperando'} ajuda para entrar
                </strong>
                <small>Veja quem ficou sem entrar e o que fazer por cada uma</small>
              </span>
              <Icone nome="seta" tamanho={18} />
            </Link>
          ) : null}
          {aguardando ? (
            <Link className="pi-alerta ambar" href={`${base}/moderacao`}>
              <Icone nome="aprovacoes" />
              <span>
                <strong>
                  {aguardando} {aguardando === 1 ? 'foto aguardando' : 'fotos aguardando'} a sua aprovação
                </strong>
                <small>Aprovar ou recusar antes de aparecer no site</small>
              </span>
              <Icone nome="seta" tamanho={18} />
            </Link>
          ) : null}
        </div>
      ) : null}

      <section className="pi-numeros" aria-label="Resumo">
        <Link className="pi-numero verde" href={`${base}/vendas`}>
          <span className="pi-numero-icone">
            <Icone nome="dinheiro" />
          </span>
          <strong>{resumo ? reais(resumo.brutoCent) : '—'}</strong>
          <span>Vendas nos últimos 30 dias</span>
          <small>
            {resumo ? `${resumo.pedidos} ${resumo.pedidos === 1 ? 'pedido pago' : 'pedidos pagos'}` : 'carregando...'}
          </small>
        </Link>
        <Link className="pi-numero roxo" href={`${base}/vendas/financeiro`}>
          <span className="pi-numero-icone">
            <Icone nome="carteira" />
          </span>
          <strong>{resumo ? reais(resumo.liquidoCent) : '—'}</strong>
          <span>Seu líquido nos 30 dias</span>
          <small>depois de taxas, reembolsos e comissões</small>
        </Link>
        <Link className="pi-numero azul" href={`${base}/alfabeto`}>
          <span className="pi-numero-icone">
            <Icone nome="sequencia" />
          </span>
          <strong>
            {publicados}
            <em> de {conteudos}</em>
          </strong>
          <span>Conteúdos publicados</span>
          <span className="pi-barra" aria-hidden="true">
            <span style={{ width: `${Math.min(100, percentagem)}%` }} />
          </span>
        </Link>
        <Link className={`pi-numero ${aEsperaDeAjuda ? 'vermelho' : 'ciano'}`} href={`${base}/suporte`}>
          <span className="pi-numero-icone">
            <Icone nome="pessoas" />
          </span>
          <strong>{aEsperaDeAjuda ?? '—'}</strong>
          <span>Pedidos de ajuda</span>
          <small>{aEsperaDeAjuda ? 'pessoas esperando para entrar' : 'ninguém esperando agora'}</small>
        </Link>
      </section>

      <Grupo titulo="Vendas">
        <Cartao
          href={`${base}/vendas`}
          icone="vendas"
          cor="ambar"
          titulo="Vendas e afiliados"
          descricao="Pedidos, clientes, afiliados, comissões, pagamentos e relatórios"
        />
        <Cartao
          href={`${base}/cartoes`}
          icone="cartoes"
          cor="ambar"
          titulo="Cartões personalizados"
          descricao="Os modelos, as medidas da moldura da foto, o preço e o desconto"
        />
        <Cartao
          href={`${base}/vendas/financeiro`}
          icone="carteira"
          cor="ambar"
          titulo="Pagamentos a afiliados"
          descricao="Quem tem saldo para receber, e os pagamentos já feitos"
        />
        <LinkDeCompra
          projectSlug={projectSlug}
          atual={dados.project.checkoutUrl ?? null}
          aoMudar={async () => definirDados(await admin.listar(projectSlug))}
        />
      </Grupo>

      <Grupo titulo="Conteúdo">
        <Cartao
          href={`${base}/estrutura`}
          icone="estrutura"
          cor="azul"
          titulo="Estrutura raiz"
          descricao={`Perfil, introdução e ${unidades.toLowerCase()} — as três partes da página, numa só raiz`}
        />
        <Cartao
          href={`${base}/alfabeto`}
          icone="sequencia"
          cor="azul"
          titulo={`${unidades} — sequência infinita`}
          descricao={`${casas} ${unidades.toLowerCase()}, quatro cartões em cada: foto, áudio, título e texto numa peça só`}
        />
        <Cartao
          href={`${base}/produto-vivo`}
          icone="produto-vivo"
          cor="azul"
          titulo="Produto Vivo"
          descricao="As imagens e a arte com áudio que as empresas veem"
        />
        <Cartao
          href={`${base}/carrossel`}
          icone="carrossel"
          cor="azul"
          titulo="Projetos da página inicial"
          descricao="A imagem de cada projeto, a ordem, quais aparecem, e projetos novos"
        />
        <Cartao
          href={`${base}/karaoke`}
          icone="karaoke"
          cor="azul"
          titulo="Modo Karaokê"
          descricao="Palavras em destaque, quem pode cantar e a sincronização de cada música"
        />
        <Cartao
          href={`${base}/categorias`}
          icone="categorias"
          cor="azul"
          titulo="Categorias de áudio"
          descricao="Explicação, música, oração — definem os filtros da playlist"
        />
      </Grupo>

      <Grupo titulo="Pessoas">
        <Cartao
          href={`${base}/suporte`}
          icone="suporte"
          cor="vermelho"
          titulo="Ajuda e suporte"
          descricao="Quem ficou sem entrar, e o que fazer por essa pessoa"
          contador={aEsperaDeAjuda}
        />
        <Cartao
          href={`${base}/comunidade`}
          icone="comunidade"
          cor="roxo"
          titulo="Comunidade"
          descricao="Apagar comentário impróprio e bloquear conta"
        />
        {/* Só com fotos à espera: uma porta para uma fila sempre vazia é ruído.
            A página continua a abrir pelo endereço. */}
        {aguardando ? (
          <Cartao
            href={`${base}/moderacao`}
            icone="aprovacoes"
            cor="roxo"
            titulo="Aprovações"
            descricao="Fotos publicadas que esperam a sua aprovação"
            contador={aguardando}
          />
        ) : null}
        <Cartao
          href={`/${projectSlug}/mensagens`}
          icone="mensagens"
          cor="roxo"
          titulo="Mensagens"
          descricao="As conversas privadas, com arquivos e áudio"
        />
      </Grupo>

      <Grupo titulo="Análise">
        <Cartao
          href={`${base}/metricas`}
          icone="metricas"
          cor="verde"
          titulo="Métricas"
          descricao="Visitantes, origem, propagação e conteúdos mais acessados"
        />
        <Cartao
          href={`${base}/vendas/relatorios`}
          icone="relatorios"
          cor="verde"
          titulo="Relatórios de vendas"
          descricao="Faturamento por dia, meios de pagamento, origem e o funil da compra"
        />
      </Grupo>
    </div>
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
    <div className="pi-cartao pi-cartao-campo ambar">
      <span className="pi-cartao-icone">
        <Icone nome="link" />
      </span>
      <span className="pi-cartao-texto">
        <strong>
          Link de compra
          {atual ? <em className="pi-estado ok">ligado</em> : <em className="pi-estado">vazio</em>}
        </strong>
        <small>O endereço da Hotmart. O botão de comprar aparece no fim de cada página do projeto.</small>
        <input
          type="url"
          inputMode="url"
          value={valor}
          placeholder="https://pay.hotmart.com/..."
          aria-label="Link de compra da Hotmart"
          onChange={(e) => definirValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {salvando && <small>Salvando...</small>}
        {salvo && <small className="pi-ok">Salvo.</small>}
        {!atual && !valor && !salvando && <small>Enquanto estiver vazio, nenhum botão de compra aparece no site.</small>}
        {erro && <small className="pi-erro">{erro}</small>}
      </span>
    </div>
  )
}
