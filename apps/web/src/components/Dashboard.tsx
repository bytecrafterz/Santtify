'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokens, ErroDeApi, renovarSessao } from '@/lib/auth'
import { useAuth } from '@/components/ProvedorDeAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api'

interface VisaoGeral {
  project: { name: string; slug: string }
  periodoDias: number
  totais: {
    visitantes: number
    cadastros: number
    visualizacoes: number
    conversao: number
    curtidas: number
    comentarios: number
    compartilhamentos: number
    cliquesEmPartilha: number
    cliquesNoPv: number
    chegaramAoFimDoPv: number
    contatosPv: number
    cliquesEmComprar: number
  }
  porDia: Array<{ dia: string; visitantes: number; cadastros: number }>
  origemVisitantes: Array<{ plataforma: string; visitantes: number }>
  origemCadastros: Array<{ plataforma: string; cadastros: number }>
  propagacao: {
    diretos: number
    porPartilha: number
    cadastrosPorPartilha: number
    percentualPorPartilha: number
    usuariosPorUsuario: number
  }
  conteudos: Array<{ titulo: string; slug: string; visualizacoes: number; visitantes: number }>
  diaZero: Array<{ platform: string; followers: number | null }>
  porPais: Array<{ pais: string | null; nome: string; visitantes: number; cadastros: number }>
}

async function buscar(projectSlug: string, dias: number, jaRenovou = false): Promise<VisaoGeral> {
  const res = await fetch(`${API_URL}/admin/analytics/${projectSlug}?dias=${dias}`, {
    credentials: 'include',
    headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
  })
  if (res.status === 401 && !jaRenovou && (await renovarSessao())) {
    return buscar(projectSlug, dias, true)
  }
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) throw new ErroDeApi(res.status, corpo?.message ?? 'Não foi possível carregar')
  // O Postgres devolve contagens como bigint; viram string no JSON.
  return corpo as VisaoGeral
}

interface VisitaDoPais {
  id: string
  visitante: string
  rede: string | null
  aparelho: string | null
  primeiraVez: string
  ultimaVez: string
  repetida: boolean
  origem: string
  temConta: boolean
}

interface VisitasDoPais {
  pais: string | null
  total: number
  redesDistintas: number
  visitas: VisitaDoPais[]
}

async function buscarPais(
  projectSlug: string,
  pais: string,
  jaRenovou = false,
): Promise<VisitasDoPais> {
  const res = await fetch(`${API_URL}/admin/analytics/${projectSlug}/paises/${pais}`, {
    credentials: 'include',
    headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
  })
  if (res.status === 401 && !jaRenovou && (await renovarSessao())) {
    return buscarPais(projectSlug, pais, true)
  }
  const corpo = await res.json().catch(() => ({}))
  if (!res.ok) throw new ErroDeApi(res.status, corpo?.message ?? 'Não foi possível carregar')
  return corpo as VisitasDoPais
}

const n = (v: unknown) => Number(v ?? 0)

/**
 * Painel de métricas essenciais.
 *
 * Deliberadamente sem biblioteca de gráficos: a curva é desenhada com barras
 * em CSS. Para os números desta fase isso é suficiente, carrega instantâneo no
 * celular e não adiciona 100 KB de JavaScript a um app que crianças abrem em
 * rede ruim. Quando os cruzamentos da Fase 2 chegarem, aí sim vale um gráfico
 * de verdade.
 */
export function Dashboard({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()
  const [dias, definirDias] = useState(30)
  const [dados, definirDados] = useState<VisaoGeral | null>(null)
  const [pais, definirPais] = useState<{ nome: string; dados: VisitasDoPais | null } | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario)
      return router.replace(
        `/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname),
      )
    if (usuario.role !== 'ADMIN') return definirErro('Esta área é restrita ao administrador.')
    buscar(projectSlug, dias)
      .then(definirDados)
      .catch((e) => definirErro(e.message))
  }, [usuario, carregando, projectSlug, dias, router])

  /** Abre as visitas que formaram o número de um país. */
  async function abrirPais(chave: string, nome: string) {
    definirPais({ nome, dados: null })
    try {
      definirPais({ nome, dados: await buscarPais(projectSlug, chave) })
    } catch {
      definirPais(null)
    }
  }

  if (erro) return <p className="erro">{erro}</p>
  if (!dados) return <p className="vazio">Carregando...</p>

  const t = dados.totais
  const p = dados.propagacao
  const maxDia = Math.max(1, ...dados.porDia.map((d) => n(d.visitantes)))

  return (
    <>
      <div className="cabecalho">
        <Link href={`/${projectSlug}/admin`}>← Painel</Link>
        <select value={dias} onChange={(e) => definirDias(Number(e.target.value))}>
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
        </select>
      </div>

      <h1>Métricas</h1>
      <p className="subtitulo">{dados.project.name}</p>

      {/*
        DOIS FUNIS, E NÃO UM SÓ MISTURADO.

        Estava tudo numa lista, e havia uma secção chamada "Propagação do
        Produto Vivo" que mostrava de onde vieram as pessoas para o SANTTIFY.
        Ele apanhou-o em 27/08 e a correcção dele é a certa: "as 375 pessoas que
        vieram das redes não representam propagação do Produto Vivo, essas
        pessoas chegaram ao Santtify".

        São duas perguntas comerciais diferentes e por isso são dois quadros:
        quantas pessoas entram na plataforma e por onde, e quantas dessas se
        interessaram pela proposta que lá está dentro. Misturadas, a segunda
        parece muito maior do que é, e é justamente a segunda que ele vai
        apresentar a uma empresa.
      */}
      <h2 className="funil">SANTTIFY</h2>
      <p className="nota">A plataforma: quem chega, por onde chega e o que faz lá dentro.</p>

      <div className="numeros">
        <Cartao valor={n(t.visitantes)} rotulo="Visitantes" />
        <Cartao valor={n(t.cadastros)} rotulo="Cadastros" />
        <Cartao valor={`${t.conversao}%`} rotulo="Conversão" />
      </div>

      {/*
        Os quatro números que ele vai mostrar a uma empresa.

        Curtidas e comentários já eram calculados e não chegavam a esta tela;
        as visualizações nem sequer eram somadas para o projecto todo. Ele
        pediu-os por nome em 27/08, e a razão é comercial: visitantes diz quantas
        pessoas entraram, visualizações diz quantas vezes o conteúdo foi mesmo
        aberto, e é a segunda que responde à pergunta de quem compra.
      */}
      <h2>Interação</h2>
      <div className="numeros">
        <Cartao valor={n(t.visualizacoes)} rotulo="Visualizações" />
        <Cartao valor={n(t.curtidas)} rotulo="Curtidas" />
        <Cartao valor={n(t.comentarios)} rotulo="Comentários" />
        <Cartao valor={n(t.compartilhamentos)} rotulo="Compartilhamentos" />
      </div>

      <h2>Crescimento</h2>
      {dados.porDia.length === 0 ? (
        <p className="bloco-vazio">Ainda sem visitas no período.</p>
      ) : (
        <div className="bloco grafico">
          {dados.porDia.map((d) => (
            <div
              className="coluna"
              key={String(d.dia)}
              title={`${d.dia}: ${n(d.visitantes)} visitantes, ${n(d.cadastros)} cadastros`}
            >
              <div className="barra" style={{ height: `${(n(d.visitantes) / maxDia) * 100}%` }}>
                <div
                  className="parte-cadastro"
                  style={{ height: `${(n(d.cadastros) / Math.max(1, n(d.visitantes))) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="legenda">
        <span className="ponto visitante" /> visitantes
        <span className="ponto cadastro" /> cadastros
      </p>

      <h2>De onde vieram</h2>
      <p className="nota">
        Contado pela origem que iniciou a cadeia. Quem chegou por um compartilhamento de WhatsApp
        vindo do Instagram conta para o Instagram — foi ele que trouxe a pessoa para dentro.
      </p>
      <Barras
        itens={dados.origemVisitantes.map((o) => ({ nome: o.plataforma, valor: n(o.visitantes) }))}
        vazio="Nenhum visitante ainda."
      />

      {/*
        AS VISITAS QUE FORMARAM O NÚMERO, uma a uma.

        Ele desconfiou do painel em 27/08, e a desconfiança era justificada: 66
        dos acessos eram meus. Pediu para poder abrir um país e ver o que está lá
        dentro antes de decidir em que idioma traduzir a plataforma.

        A folha diz também o que NÃO tem. Ele pediu endereço em cru, operadora,
        ASN e deteção de VPN, e nada disso está guardado: o endereço é reduzido a
        uma faixa de rede e resumido com uma chave do servidor, e a política de
        privacidade publicada em nome dele promete isso às famílias. Um painel
        que esconde os seus próprios limites é o que o pôs a desconfiar.
      */}
      {pais && (
        <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Visitas do país">
          <button
            type="button"
            className="fundo-clicavel"
            aria-label="Fechar"
            onClick={() => definirPais(null)}
          />
          <div className="folha-pessoas folha-visitas">
            <header>
              <h2>{pais.nome}</h2>
              <button
                type="button"
                className="fechar-x"
                aria-label="Fechar"
                onClick={() => definirPais(null)}
              >
                ✕
              </button>
            </header>

            {!pais.dados ? (
              <p className="vazio">Carregando...</p>
            ) : (
              <>
                <p className="nota">
                  {pais.dados.total} {pais.dados.total === 1 ? 'visita' : 'visitas'} de{' '}
                  {pais.dados.redesDistintas}{' '}
                  {pais.dados.redesDistintas === 1 ? 'rede diferente' : 'redes diferentes'}. Se o
                  número de redes for muito menor do que o de visitas, é a mesma origem a repetir.
                </p>
                <ul className="lista-visitas">
                  {pais.dados.visitas.map((v) => (
                    <li key={v.id}>
                      <strong>{new Date(v.primeiraVez).toLocaleString('pt-PT')}</strong>
                      <span>
                        {v.aparelho ?? 'aparelho desconhecido'} · rede {v.rede ?? 'sem registo'} ·{' '}
                        {v.repetida ? 'visita repetida' : 'primeira visita'} · veio de {v.origem}
                        {v.temConta ? ' · tem conta' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="nota rodape-pessoas">
                  Não guardamos o endereço de rede em cru, nem operadora, ASN ou deteção de VPN. O
                  endereço é reduzido a uma faixa e resumido com uma chave do servidor, que é o que
                  a política de privacidade da plataforma promete às famílias. A &quot;rede&quot;
                  acima é esse resumo: serve para distinguir origens, não para identificar alguém.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <h2>Origem dos cadastros</h2>
      <Barras
        itens={dados.origemCadastros.map((o) => ({ nome: o.plataforma, valor: n(o.cadastros) }))}
        vazio="Nenhum cadastro ainda."
      />

      <h2>De onde vêm</h2>
      <Barras
        itens={dados.porPais.map((o) => ({
          nome: o.nome,
          valor: n(o.visitantes),
          chave: o.pais ?? 'SEM_PAIS',
        }))}
        vazio="Ainda sem visitas identificadas."
        aoAbrir={(chave, nome) => void abrirPais(chave, nome)}
      />
      {/* A NOTA NÃO É DECORAÇÃO. Ele vai tomar decisões de divulgação com este
          quadro, e tem de saber o que ele não sabe: o país é fiável, a cidade
          não é, e as visitas antigas ficaram sem origem porque o campo nunca
          chegou a ser preenchido antes de 25/08. Um número sem a sua margem é
          um número que engana. */}
      <p className="nota">
        O país vem do endereço de rede, resolvido dentro do nosso servidor: nenhum endereço sai
        daqui. Cidade e região não aparecem de propósito: no telemóvel o endereço é o da operadora,
        e a cidade que ela devolve é onde está o equipamento dela, não a família. As visitas de
        antes de 25 de agosto aparecem como &quot;Sem identificar&quot;.
      </p>

      {/* Isto é propagação do SANTTIFY: como as pessoas chegam à plataforma.
          O nome dizia Produto Vivo e não tinha nada que ver com ele. */}
      <h2>Propagação</h2>
      <div className="numeros">
        <Cartao valor={n(p.diretos)} rotulo="Vieram das redes" />
        <Cartao valor={n(p.porPartilha)} rotulo="Vieram de partilha" />
        <Cartao valor={`${p.percentualPorPartilha}%`} rotulo="Do crescimento" />
        <Cartao valor={p.usuariosPorUsuario} rotulo="Cada um trouxe" />
      </div>

      <h2>Conteúdos mais acessados</h2>
      {dados.conteudos.length === 0 ? (
        <p className="bloco-vazio">Ainda sem visualizações.</p>
      ) : (
        <ul className="lista">
          {dados.conteudos.map((c) => (
            <li className="bloco linha" key={c.slug}>
              <span>{c.titulo}</span>
              <small>
                {n(c.visualizacoes)} visualizações · {n(c.visitantes)} pessoas
              </small>
            </li>
          ))}
        </ul>
      )}

      {/*
        O SEGUNDO FUNIL. A pessoa já está cá dentro; a pergunta agora é outra.
      */}
      <h2 className="funil">PRODUTO VIVO</h2>
      <p className="nota">
        A proposta apresentada dentro do Santtify. Quem já entrou na plataforma vê o selo, toca por
        curiosidade, conhece a proposta e, se lhe interessar, pede para entrar no grupo ou compra.
        Nenhum destes números é de quem chega: são de quem já cá está.
      </p>
      <div className="numeros">
        <Cartao valor={n(t.cliquesNoPv)} rotulo="Cliques no PV (todas as letras)" />
        {/* O degrau do meio: sem ele não se distingue quem não se interessou de
            quem nunca chegou a ler a proposta. */}
        <Cartao valor={n(t.chegaramAoFimDoPv)} rotulo="Chegaram ao fim" />
        {t.cliquesNoPv > 0 && t.chegaramAoFimDoPv > t.cliquesNoPv && (
          /* Um degrau do meio maior do que o de cima é um funil impossível, e
             não se apresenta a uma empresa sem explicação. Enquanto acontecer,
             o painel di-lo em vez de deixar quem olha tirar a conclusão errada. */
          <p className="nota aviso-funil">
            O número de quem chegou ao fim está acima dos cliques porque há quem abra o Produto Vivo
            pela barra de baixo, sem passar pelo selo de uma letra.
          </p>
        )}
        {/*
          "CLIQUES PARA ENTRAR NO GRUPO", e não "entraram no grupo".

          Dizia que tinham entrado, e nós não sabemos isso: o WhatsApp não conta
          a ninguém quem entrou num grupo. Sabemos que carregaram no botão, e é
          só isso que este número pode prometer. Ele próprio o pediu assim em
          27/08, e tem razão: um número que promete mais do que mede é o que
          rebenta numa reunião com uma empresa.
        */}
        <Cartao valor={n(t.contatosPv)} rotulo="Cliques para entrar no grupo" />
        <Cartao valor={n(t.cliquesEmComprar)} rotulo="Cliques em comprar" />
      </div>
      <p className="nota">
        O PV aparece nas 26 letras e a contagem é a soma de todas. O primeiro número é curiosidade:
        quantas pessoas quiseram saber o que é a tecnologia. O segundo diz quantas leram a proposta
        até ao fim. Os dois últimos são intenção, e são esses que respondem se existem dez, vinte ou
        cinquenta empresas interessadas. &quot;Chegaram ao fim&quot; começou a ser contado hoje: os
        acessos anteriores não têm esse registo e não aparecem aqui.
      </p>

      <h2>Dia Zero</h2>
      <p className="nota">
        A linha de base do lançamento. É contra ela que o crescimento é medido.
      </p>
      <ul className="lista">
        {dados.diaZero.map((d) => (
          <li className="bloco linha" key={d.platform}>
            <span>{d.platform}</span>
            <small>{n(d.followers)} no lançamento</small>
          </li>
        ))}
      </ul>
    </>
  )
}

function Cartao({ valor, rotulo }: { valor: number | string; rotulo: string }) {
  return (
    <div className="numero">
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  )
}

function Barras({
  itens,
  vazio,
  aoAbrir,
}: {
  itens: Array<{ nome: string; valor: number; chave?: string }>
  vazio: string
  /** Quando existe, cada barra passa a ser tocável e abre o que a formou. */
  aoAbrir?: (chave: string, nome: string) => void
}) {
  if (itens.length === 0) return <p className="bloco-vazio">{vazio}</p>
  const max = Math.max(1, ...itens.map((i) => i.valor))
  return (
    <ul className="barras">
      {itens.map((i) => {
        const conteudo = (
          <>
            <span className="rotulo">{i.nome}</span>
            <span className="trilho">
              <span className="preenchimento" style={{ width: `${(i.valor / max) * 100}%` }} />
            </span>
            <strong>{i.valor}</strong>
          </>
        )
        return (
          <li key={i.nome}>
            {aoAbrir && i.chave ? (
              <button
                type="button"
                className="barra-tocavel"
                onClick={() => aoAbrir(i.chave!, i.nome)}
              >
                {conteudo}
              </button>
            ) : (
              conteudo
            )}
          </li>
        )
      })}
    </ul>
  )
}
