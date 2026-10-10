'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { admin, painelDeCartoes, type CartaoAdmin, type VagaoAdmin } from '@/lib/admin'
import { artigoDefinido, capitalizar } from '@/lib/unidade'
import { CabecalhoFixo } from './CabecalhoFixo'
import { useAuth } from './ProvedorDeAuth'
import { EditorDeCartao } from './EditorDeCartao'
import { EditorDoCartaoDeImpressao } from './EditorDoCartaoDeImpressao'
import { QrDaLetra } from './QrDaLetra'
import { DuplicarPara } from './DuplicarPara'
import { Voltar } from './Voltar'

/**
 * O painel do alfabeto, nas três telas que ele desenhou em 23/08.
 *
 * A comparação é dele e é boa: a composição de um comboio. A Letra A é o
 * primeiro vagão, a B o segundo, e a linha que os liga não se interrompe até à
 * Z. Cada vagão leva quatro cartões que são dele e de mais ninguém.
 *
 * AS TRÊS TELAS VIVEM NA MESMA PÁGINA, e isso é a pedido dele: "ao salvar,
 * volta automaticamente aos quatro quadrados e marca aquele como concluído".
 * Se fossem três endereços, guardar um cartão obrigaria a uma volta ao
 * servidor e a pessoa perdia o sítio onde estava a meio de preencher 26 letras.
 */
type Onde =
  /**
   * A sequência lembra-se de onde ele estava.
   *
   * "Estou trabalhando na letra R, entro para editar e depois volto. O sistema
   * me joga novamente para a letra A." Ele tem razão e isto não é conforto: são
   * 26 letras, quatro cartões cada, e voltar ao topo a cada gravação é descer a
   * lista dezenas de vezes num dia de trabalho.
   */
  | { tela: 'sequencia'; casa?: string }
  | { tela: 'quadrados'; casa: string }
  | { tela: 'cartao'; casa: string; cartaoId: string }

/** As quatro casas nascem sempre, mesmo quando a letra ainda está vazia. */
const CASAS = ['Explicação', 'Música', 'Repetição do versículo', 'Oração']

/** Uma cor por casa, para se reconhecer o quadrado sem ler. */
const CORES = ['#2563eb', '#7c3aed', '#ea580c', '#7c3aed']

export function SequenciaDoAlfabeto({ projectSlug }: { projectSlug: string }) {
  const [vagoes, definirVagoes] = useState<VagaoAdmin[]>([])
  /** "Letra", "Dia", "Atributo" — vem do projeto. Ver `Project.unidade`. */
  const [unidade, definirUnidade] = useState('Letra')
  const [onde, definirOnde] = useState<Onde>({ tela: 'sequencia' })
  /** A introdução do projeto, que passou a viver no topo desta sequência (30/09). */
  const [introducao, definirIntroducao] = useState<{ contentId: string; cartoes: CartaoAdmin[] } | null>(
    null,
  )
  const [projeto, definirProjeto] = useState<{
    nome: string
    letras: boolean
    blocos: number
    primeiro: number
  } | null>(null)
  /** O que está a ser criado agora, para o "A criar..." aparecer no sítio em que ele tocou. */
  const [aCriar, definirACriar] = useState<string | null>(null)
  const [carregando, definirCarregando] = useState(true)
  const [erro, definirErro] = useState<string | null>(null)
  const [menuAberto, definirMenuAberto] = useState<string | null>(null)
  /**
   * Duplicar demorava sem dizer nada.
   *
   * Ele escreveu em 31/08 que a função "simplesmente não está funcionando".
   * Fui ver e ela funciona: o servidor responde 201 e a cópia fica criada. O
   * que não havia era sinal nenhum. Carrega-se, o menu fecha, e durante alguns
   * segundos o ecrã fica igual enquanto a cópia é criada e a lista recarrega.
   * Com oito cartões na letra, a cópia nasce no meio da lista e passa
   * despercebida.
   *
   * É a mesma queixa que ele já me tinha feito do botão PUBLICAR em 29/08, e eu
   * corrigi só naquele botão em vez de perceber que era um padrão meu.
   */
  const [aDuplicar, definirADuplicar] = useState<string | null>(null)
  const [copiaNova, definirCopiaNova] = useState<string | null>(null)
  /** O quadrado a duplicar para outro dia, com a casa de onde sai (10/10). */
  const [aDuplicarPara, definirADuplicarPara] = useState<{ cartao: CartaoAdmin; casa: string } | null>(null)
  /** "Música copiada para o Dia 2": dito por um instante, em baixo. */
  const [feito, definirFeito] = useState<string | null>(null)
  const [aCriarImpressao, definirACriarImpressao] = useState(false)
  /**
   * Que casa está a ser criada agora: 1 a 4, ou 0 para um cartão solto.
   *
   * `null` quando não há nenhuma. Guarda o número e não um booleano para o
   * "A criar..." aparecer no quadrado em que ele tocou, e não nos quatro.
   */
  const [aCriarCasa, definirACriarCasa] = useState<number | null>(null)
  const { usuario, carregando: aRestaurarSessao } = useAuth()

  /**
   * Voltar de uma letra devolve a lista NAQUELA letra, e não no princípio.
   *
   * `block: 'center'` e não 'start': encostar a letra ao topo esconde-a por
   * baixo do cabeçalho fixo, e ele ficava a olhar para a letra seguinte
   * convencido de que o sítio se tinha perdido na mesma.
   *
   * Sem animação de propósito. Ver a lista a correr sozinha do A até ao R faz
   * parecer que a página se enganou e se corrigiu; aparecer já no sítio certo é
   * o que se espera de voltar.
   */
  useEffect(() => {
    if (onde.tela !== 'sequencia' || !onde.casa) return
    document.getElementById(`vagao-${onde.casa}`)?.scrollIntoView({ block: 'center' })
  }, [onde])
  /** A ordem enquanto ele mexe, antes de gravar. Nula = a do servidor. */
  const [ordem, definirOrdem] = useState<string[] | null>(null)
  const [aGravarOrdem, definirAGravarOrdem] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const [r, raiz] = await Promise.all([
        admin.alfabeto(projectSlug),
        admin.estruturaRaiz(projectSlug).catch(() => null),
      ])
      definirVagoes(r.vagoes)
      definirProjeto({
        nome: r.project?.name ?? '',
        letras: r.project?.sequencia === 'LETRAS' || r.vagoes.some((v) => v.letra !== null),
        blocos: r.project?.blocos ?? r.vagoes.length,
        primeiro: r.project?.primeiroNumero ?? 1,
      })
      definirIntroducao(
        raiz?.introducao
          ? { contentId: raiz.introducao.contentId, cartoes: raiz.introducao.cartoes }
          : null,
      )
      /*
        COMO SE CHAMA UMA CASA NESTE PROJETO.

        O `rotulo` de cada vagão já vem do servidor com o nome certo, mas os
        textos em volta — o que se diz no topo, o fim da composição, o aviso de
        que a casa precisa de conteúdo — estavam escritos a falar de letras. Num
        projeto de sete dias isso é o painel a falar de outro projeto, e foi o
        que ele encontrou em 21/09 ao tentar publicar no Minha Identidade.
      */
      definirUnidade(r.project?.unidade ?? 'Letra')
      definirErro(null)
    } catch {
      definirErro('Não foi possível carregar as casas deste projeto.')
    } finally {
      definirCarregando(false)
    }
  }, [projectSlug])

  /**
   * Espera pela sessão antes de perguntar.
   *
   * O access token só vive em memória: ao abrir a página ele ainda não existe,
   * e é preciso trocar o refresh guardado por um novo. Sem esta espera, o
   * painel perguntava ao servidor sem credencial nenhuma, levava um 401 e
   * mostrava "não foi possível carregar o alfabeto" a um administrador com a
   * sessão perfeitamente válida. É a terceira vez esta semana que esta corrida
   * me apanha, sempre com outra cara.
   */
  useEffect(() => {
    if (aRestaurarSessao) return
    void recarregar()
  }, [recarregar, aRestaurarSessao, usuario?.id])

  /*
    VOLTAR É UM PASSO ATRÁS, E NÃO O PAINEL (30/09).

    "O botão Voltar também precisa voltar somente para a tela anterior. Hoje,
    quando estou postando dentro de um bloco e volto, ele me joga lá para o
    início novamente." O Voltar do topo do cartão e dos quadrados era um link
    para o painel, e o gesto de voltar do telemóvel saía da página.

    Cada ecrã passa a ser uma entrada no histórico do navegador: o Voltar do
    topo, o do ecrã e o gesto do telemóvel fazem todos o mesmo, um passo
    atrás. E a sequência guarda a casa de onde se saiu, para voltar a ela.
  */
  const ir = useCallback((novo: Onde) => {
    window.history.pushState({ ...(window.history.state ?? {}), painelDoProjeto: novo }, '')
    definirOnde(novo)
  }, [])
  const voltar = useCallback(() => window.history.back(), [])
  /** Da sequência para dentro: primeiro guarda a casa, para o voltar a trazer até ela. */
  const entrar = (casa: string, novo: Onde) => {
    window.history.replaceState(
      { ...(window.history.state ?? {}), painelDoProjeto: { tela: 'sequencia', casa } },
      '',
    )
    ir(novo)
  }
  useEffect(() => {
    // Recarregar a página a meio de um cartão volta ao mesmo cartão.
    const guardado = window.history.state?.painelDoProjeto as Onde | undefined
    if (guardado) definirOnde(guardado)
    const aoVoltar = (e: PopStateEvent) =>
      definirOnde((e.state?.painelDoProjeto as Onde | undefined) ?? { tela: 'sequencia' })
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  const vagao = 'casa' in onde ? vagoes.find((v) => v.casa === onde.casa) : undefined

  /*
    O DIÁLOGO DE DUPLICAR, o mesmo na sequência e nos quadrados (10/10).

    Acabado, recarrega, diz o que fez, e acende o quadrado de destino — saber
    que foi copiado não chega, é preciso ver ONDE (a mesma regra da cópia).
  */
  const dialogoDeDuplicar = aDuplicarPara ? (
    <DuplicarPara
      cartao={aDuplicarPara.cartao}
      casaDeOrigem={aDuplicarPara.casa}
      vagoes={vagoes}
      unidade={unidade}
      aoFechar={() => definirADuplicarPara(null)}
      aoConcluir={async ({ vagao: destino, id, nome: nomeDoDestino }) => {
        definirADuplicarPara(null)
        await recarregar()
        definirCopiaNova(id)
        definirFeito(`${nomeDoDestino}: copiado para ${destino.rotulo}.`)
        requestAnimationFrame(() => {
          const alvo =
            document.getElementById(`quadrado-${id}`) ?? document.getElementById(`ladrilho-${id}`)
          alvo?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        })
        setTimeout(() => {
          definirCopiaNova(null)
          definirFeito(null)
        }, 4500)
      }}
    />
  ) : null
  const avisoDeFeito = feito ? (
    <p className="dp-feito" role="status">
      ✓ {feito}
    </p>
  ) : null

  // ── Tela 3: o cartão ──────────────────────────────────────────────
  // Da introdução: o mesmo editor, com a introdução como sítio de onde se veio.
  if (onde.tela === 'cartao' && onde.casa === 'introducao') {
    const cartao = introducao?.cartoes.find((c) => c.id === onde.cartaoId)
    if (cartao) {
      return (
        <>
          <CabecalhoFixo projectSlug={projectSlug} onde="Introdução" aoVoltar={voltar} />
          <EditorDeCartao
            key={cartao.id}
            cartao={cartao}
            projectSlug={projectSlug}
            aoGuardar={async () => {
              await recarregar()
              voltar()
            }}
            aoMudar={recarregar}
            aoCancelar={voltar}
          />
        </>
      )
    }
  }
  if (onde.tela === 'cartao' && vagao) {
    const cartao = vagao.cartoes.find((c) => c.id === onde.cartaoId)
    if (cartao?.papel === 'IMPRESSAO') {
      // Outro editor, porque tem outros campos e outra régua: arte de
      // apresentação e folha A4, sem áudio nem descrição.
      return (
        <>
          <CabecalhoFixo
            projectSlug={projectSlug}
            onde={vagao.rotulo}
            aoVoltar={voltar}
          />
          <EditorDoCartaoDeImpressao
            key={cartao.id}
            cartao={cartao}
            letra={vagao.letra ?? String(vagao.numero ?? '')}
            unidade={unidade}
            projectSlug={projectSlug}
            contentSlug={vagao.slug}
            aoApagar={async () => {
              await recarregar()
              voltar()
            }}
            aoGuardar={async () => {
              await recarregar()
              voltar()
            }}
            aoCancelar={voltar}
          />
        </>
      )
    }
    if (cartao) {
      return (
        <>
          <CabecalhoFixo
            projectSlug={projectSlug}
            onde={vagao.rotulo}
            aoVoltar={voltar}
          />
          <EditorDeCartao
            key={cartao.id}
            cartao={cartao}
            projectSlug={projectSlug}
            aoGuardar={async () => {
              await recarregar()
              // Volta ao ecrã de onde veio — a sequência, ou os quadrados.
              voltar()
            }}
            aoMudar={recarregar}
            aoCancelar={voltar}
          />
        </>
      )
    }
  }

  // ── Tela 2: os quatro quadrados ───────────────────────────────────
  if (onde.tela === 'quadrados' && vagao) {
    const impressao = vagao.cartoes.find((c) => c.papel === 'IMPRESSAO')
    const doVagao = vagao.cartoes.filter((c) => c.papel === 'CARTAO')
    // A ordem em que ele os está a arrumar agora, se já mexeu; senão a do
    // servidor, que já vem pelas casas e depois pelas cópias.
    const lista = ordem
      ? (ordem.map((id) => doVagao.find((c) => c.id === id)).filter(Boolean) as typeof doVagao)
      : doVagao

    /*
      As casas de 1 a 4 que ainda não têm cartão.

      Lida dos cartões que existem e não de uma contagem: uma publicação pode
      ter a casa 1 e a 3 e faltar-lhe a 2, se ele esvaziou uma pelo meio. O que
      interessa é qual falta, não quantas.

      ── E NEM TODAS AS PUBLICAÇÕES QUERAM AS QUATRO ──────────────────────

      Medido na base dele antes de escrever isto: 164 cartões têm casa e 79 não
      têm. A Letra B tem as quatro casas e cinco cópias por cima; a LETRA A tem
      quatro cartões e NENHUM deles tem casa — foi montada de outra maneira, com
      publicações soltas.

      Se isto olhasse só para as casas em falta, a Letra A abria com quatro
      cartões lá dentro e quatro botões a oferecer criar Explicação, Música,
      Repetição do versículo e Oração. Ele tocava, ficava com oito, e eu tinha-
      lhe dado um botão que estraga o que já estava feito.

      Por isso a oferta só aparece a quem está VAZIA (a publicação nova, que é o
      caso dele) ou a quem JÁ USA as casas e tem alguma em falta. Uma publicação
      feita só de cartões soltos fica como está.
    */
    /*
      ── E NOS PROJETOS NUMERADOS, NENHUMA ──────────────────────────────────

      "Por favor retire este design de baixo. Só quero como os 2 design dos
      primeiros" — 25/09, sobre o Dia 2 do Minha Identidade. Os quadrados
      tracejados de "Repetição do versículo" e "Oração" eram as casas fixas do
      alfabeto, oferecidas a um projeto que não as tem. Ali cada cartão entra
      por "Acrescentar cartão", e a função dele — Explicação, Música,
      Memorização, Oração, Música alegre — escolhe-se na categoria, dentro do
      próprio cartão. As letras ficam como estavam: é nelas que as quatro
      casas vivem.
    */
    const usaCasas =
      vagao.letra !== null && (doVagao.length === 0 || doVagao.some((c) => c.slot !== null))
    const casasPorPreencher = usaCasas
      ? CASAS.map((nome, i) => ({ casa: i + 1, nome })).filter(
          ({ casa }) => !doVagao.some((c) => c.slot === casa),
        )
      : []

    function mover(i: number, direccao: -1 | 1) {
      const j = i + direccao
      if (j < 0 || j >= lista.length) return
      const nova = lista.map((c) => c.id)
      ;[nova[i], nova[j]] = [nova[j], nova[i]]
      definirOrdem(nova)
    }

    return (
      <>
        <CabecalhoFixo
          projectSlug={projectSlug}
          onde={vagao.rotulo}
          aoVoltar={voltar}
        />
        {dialogoDeDuplicar}
        {avisoDeFeito}
        <div className="painel-quadrados">
          {/*
            Dizia "← Alfabeto" num projeto de sete dias — o nome de outro
            projeto — e era a última seta feita com o carácter "←", que cada
            telemóvel desenha à sua maneira. Escapou à passagem de 22/09 porque
            este ecrã só se vê com sessão iniciada.
          */}
          <Voltar aoClicar={voltar} emLinha>
            Voltar
          </Voltar>
          <h1>Conteúdos: {vagao.rotulo}</h1>
          <p className="nota">Toque para editar • Toque nos três pontos para ver opções</p>

          {/*
            A IMAGEM DA CASA NÃO TINHA PORTA NENHUMA.

            Os quatro quadrados são os cartões DE DENTRO da casa. A imagem da
            própria casa — a que aparece na grelha do site e no topo da página —
            vive no editor do conteúdo, e nenhum ecrã do painel ligava para lá.
            Só se chegava escrevendo o endereço à mão.

            Ele perguntou hoje, olhando para a grelha, "como é que mudo estas
            imagens?". A resposta certa não é um endereço: é este botão.
          */}
          {vagao.slug && (
            <Link className="bloco linha atalho-alfabeto" href={`/${projectSlug}/admin/${vagao.slug}`}>
              <span>{`Imagem e título d${artigoDefinido(unidade)} ${vagao.rotulo}`}</span>
              <small>a arte que aparece na grelha do site, o título, o subtítulo e o QR Code</small>
            </Link>
          )}

          <div className="grade-quadrados">
            {lista.map((c, i) => (
              <Quadrado
                key={c.id}
                cartao={c}
                numero={i + 1}
                cor={CORES[(c.slot ?? i + 1) - 1] ?? CORES[0]}
                menuAberto={menuAberto === c.id}
                aoAbrirMenu={() => definirMenuAberto(menuAberto === c.id ? null : c.id)}
                aoEditar={() => {
                  definirMenuAberto(null)
                  ir({ tela: 'cartao', casa: vagao.casa, cartaoId: c.id })
                }}
                aDuplicar={aDuplicar === c.id}
                acabadaDeCriar={copiaNova === c.id}
                aoDuplicarPara={() => {
                  definirMenuAberto(null)
                  definirADuplicarPara({ cartao: c, casa: vagao.casa })
                }}
                aoDuplicar={async () => {
                  /*
                    O MENU FICA ABERTO ENQUANTO DUPLICA.

                    Fechava-o na primeira linha, e com ele desaparecia o botão
                    que devia dizer "A duplicar...". Ou seja: pus o aviso e
                    tirei-o do ecrã no mesmo gesto. Medido — o rótulo nunca
                    chegou a ser visto uma única vez.

                    Fecha no fim, quando já há uma cópia acesa para onde olhar.
                  */
                  definirADuplicar(c.id)
                  definirErro(null)
                  try {
                    const copia = await admin.duplicarCartao(c.id)
                    await recarregar()
                    definirCopiaNova(copia.id)
                    // Levar a pessoa até à cópia e acendê-la por um instante:
                    // saber que foi criada não chega, é preciso ver ONDE.
                    requestAnimationFrame(() => {
                      document
                        .getElementById(`quadrado-${copia.id}`)
                        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                    })
                    definirMenuAberto(null)
                    setTimeout(() => definirCopiaNova(null), 4000)
                  } catch (e) {
                    definirMenuAberto(null)
                    definirErro(
                      e instanceof Error ? e.message : 'Não foi possível duplicar este cartão.',
                    )
                  } finally {
                    definirADuplicar(null)
                  }
                }}
                aoApagar={async () => {
                  definirMenuAberto(null)
                  const nome = c.titulo || c.nomeInterno || 'este cartão'
                  const aviso =
                    c.slot === null
                      ? `Remover a cópia "${nome}"? Ela desaparece.`
                      : `Esvaziar "${nome}"? O quadrado fica, só o conteúdo sai.`
                  if (!confirm(aviso)) return
                  await admin.apagarCartaoDeVez(c.id)
                  await recarregar()
                }}
                /* Só o quarto quadrado cria o cartão de impressão, e só uma vez. */
                aoTirarDoAr={async () => {
                  definirMenuAberto(null)
                  await admin.tirarCartaoDoAr(c.id)
                  await recarregar()
                }}
                aoPorNoAr={async () => {
                  definirMenuAberto(null)
                  try {
                    await admin.porCartaoNoAr(c.id)
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Não foi possível pôr no ar.')
                  }
                  await recarregar()
                }}
                aoSubir={i > 0 ? () => mover(i, -1) : undefined}
                aoDescer={i < lista.length - 1 ? () => mover(i, 1) : undefined}
                aoCriarImpressao={
                  c.slot === 4 && !impressao && vagao.contentId
                    ? async () => {
                        definirMenuAberto(null)
                        await admin.criarCartaoDeImpressao(vagao.contentId!)
                        await recarregar()
                      }
                    : undefined
                }
              />
            ))}
          </div>

          {/* SALVAR ORDEM só aparece depois de ele mexer em alguma coisa.
              Um botão de gravar sempre à vista, sem nada por gravar, ensina a
              pessoa a ignorá-lo — e no dia em que houver mesmo alterações por
              gravar, ela ignora-o também. */}
          {ordem && (
            <button
              type="button"
              className="botao-acao largo salvar-ordem"
              disabled={aGravarOrdem || !vagao.contentId}
              onClick={async () => {
                if (!vagao.contentId) return
                definirAGravarOrdem(true)
                try {
                  await admin.ordenarCartoes(vagao.contentId, ordem)
                  definirOrdem(null)
                  await recarregar()
                } finally {
                  definirAGravarOrdem(false)
                }
              }}
            >
              {aGravarOrdem ? 'A guardar...' : 'SALVAR ORDEM'}
            </button>
          )}

          {/*
            AS ACÇÕES SÃO QUADRADOS COMO OS OUTROS.

            "Coloca o restante de baixo igual o de cima" — 25/09. Acrescentar e
            o cartão de impressão eram faixas tracejadas a toda a largura, com
            outro tamanho, outra letra e outra borda: pareciam de outro ecrã.
            Agora assentam na mesma grelha de duas colunas, com a mesma caixa,
            e só o sinal verde diz que ali se cria em vez de se editar.
          */}
          <div className="grade-quadrados grade-acoes">
            {/*
              AS CASAS QUE AINDA NÃO EXISTEM, e a porta para as criar.

              Este ecrã desenhava só os cartões que já existiam. No alfabeto isso
              nunca se notou, porque as quatro casas de cada letra vieram do seed.
              Nos projetos que ele cria no painel não vêm de lado nenhum: os sete
              dias do Minha Identidade têm zero blocos, e abrir um deles dava um
              ecrã vazio, sem nada em que tocar.

              Ele apanhou-o em 22/09, no dia seguinte a eu lhe ter dito que o
              painel estava pronto para publicar: "você ainda não fez a estrutura
              para postar fotos e áudio". Estava tudo feito menos isto — o editor,
              o envio da foto e do áudio, o publicar, o duplicar. Faltava a porta.

              Abre o editor logo a seguir a criar. Criar e ficar no mesmo sítio
              seria pedir-lhe que procurasse o que acabou de pedir — é a mesma
              razão que está escrita no botão do cartão de impressão.
            */}
            {vagao.contentId &&
              casasPorPreencher.length > 0 &&
              casasPorPreencher.map(({ casa, nome }) => (
                <button
                  key={casa}
                  type="button"
                  className="quadrado-impressao criar"
                  disabled={aCriarCasa !== null}
                  onClick={async () => {
                    definirACriarCasa(casa)
                    try {
                      const novo = await admin.acrescentarCartao(vagao.contentId!, casa)
                      await recarregar()
                      ir({ tela: 'cartao', casa: vagao.casa, cartaoId: novo.id })
                    } catch (e) {
                      definirErro(
                        e instanceof Error ? e.message : 'Não foi possível criar este quadrado.',
                      )
                    } finally {
                      definirACriarCasa(null)
                    }
                  }}
                >
                  <span className="icone" aria-hidden>
                    +
                  </span>
                  <span className="nome">{nome.toUpperCase()}</span>
                  <span className="estado">
                    {aCriarCasa === casa ? 'A criar...' : 'ainda não existe — toque para criar'}
                  </span>
                </button>
              ))}

            {/*
              ACRESCENTAR ALÉM DAS QUATRO.

              "Assim consigo acrescentar músicas, explicações, versículos, orações
              ou outros conteúdos sem ficar limitado aos quatro iniciais" — 21/09.

              Não aparece nas letras: uma letra tem quatro casas fixas e é dessa
              forma repetida que a composição das 26 vive. O servidor recusa na
              mesma; isto é só não mostrar um botão que ia dar erro.
            */}
            {vagao.contentId && vagao.letra === null && (
              <button
                type="button"
                className="quadrado-impressao criar"
                disabled={aCriarCasa !== null}
                onClick={async () => {
                  definirACriarCasa(0)
                  try {
                    const novo = await admin.acrescentarCartao(vagao.contentId!)
                    await recarregar()
                    ir({ tela: 'cartao', casa: vagao.casa, cartaoId: novo.id })
                  } catch (e) {
                    definirErro(
                      e instanceof Error ? e.message : 'Não foi possível acrescentar o cartão.',
                    )
                  } finally {
                    definirACriarCasa(null)
                  }
                }}
              >
                <span className="icone" aria-hidden>
                  +
                </span>
                <span className="nome">ACRESCENTAR CARTÃO</span>
                <span className="estado">
                  {aCriarCasa === 0 ? 'A criar...' : 'foto, áudio, título e texto numa peça só'}
                </span>
              </button>
            )}

            {impressao ? (
              <button
                type="button"
                className="quadrado-impressao pronto"
                onClick={() =>
                  ir({ tela: 'cartao', casa: vagao.casa, cartaoId: impressao.id })
                }
              >
                <span className="icone" aria-hidden>
                  🖨
                </span>
                <span className="nome">CARTÃO PARA IMPRESSÃO</span>
                <span className="estado">
                  {impressao.estado === 'PUBLICADO' ? 'pronto' : 'rascunho'}
                </span>
              </button>
            ) : (
              /*
                UM BOTÃO, E NÃO UM AVISO A DIZER ONDE FICA O BOTÃO.

                Isto era um texto morto: "Criado a partir do quarto quadrado". O
                caminho existia mesmo, dentro do menu de três pontinhos do quarto
                quadrado, e ninguém o encontrava. Ele foi à Letra C em 26/08 e
                escreveu que não havia "um caminho claro para colocar o cartão de
                impressão e gerar o PDF". Tinha razão: havia um letreiro a apontar
                para uma porta escondida.
              */
              <button
                type="button"
                className="quadrado-impressao criar"
                disabled={!vagao.contentId || aCriarImpressao}
                onClick={async () => {
                  if (!vagao.contentId) return
                  definirACriarImpressao(true)
                  try {
                    const novo = await admin.criarCartaoDeImpressao(vagao.contentId)
                    await recarregar()
                    // Abre já o editor: criar e ficar no mesmo sítio seria pedir-lhe
                    // que descobrisse o passo seguinte sozinho outra vez.
                    ir({ tela: 'cartao', casa: vagao.casa, cartaoId: novo.id })
                  } finally {
                    definirACriarImpressao(false)
                  }
                }}
              >
                <span className="icone" aria-hidden>
                  🖨
                </span>
                <span className="nome">CRIAR CARTÃO PARA IMPRESSÃO</span>
                <span className="estado">
                  {!vagao.contentId
                    ? `${capitalizar(artigoDefinido(unidade))} ${unidade.toLowerCase()} precisa de ter conteúdo primeiro`
                    : aCriarImpressao
                      ? 'A criar...'
                      : 'Arte, folha A4 e PDF para a gráfica'}
                </span>
              </button>
            )}
          </div>

          {/*
            O QR NO FIM, E NÃO NO MEIO (24/09).

            Estava entre os cartões que já existem e as casas que ainda faltam
            criar — e empurrava essas casas para baixo de si. Ele fotografou o
            Dia 1 com o botão verde do SVG em cima e MÚSICA, REPETIÇÃO e ORAÇÃO
            por baixo, e escreveu "não quero que apareça isso abaixo".

            A razão é simples e eu tinha-a escrito ao contrário: este ecrã é
            para PREENCHER a casa. Os quadrados, os que faltam e o cartão de
            impressão são o trabalho, e vêm todos seguidos. O QR é uma
            ferramenta — leva-se quando está tudo feito, e por isso fica no fim,
            como já ficava no editor de cada conteúdo.

            Continua fora do cartão de impressão: uma casa sem cartão criado
            precisa do QR dela na mesma.
          */}
          <QrDaLetra
            projectSlug={projectSlug}
            contentSlug={vagao.slug}
            letra={vagao.letra ?? String(vagao.numero ?? '')}
            unidade={unidade}
          />
        </div>
      </>
    )
  }

  // ── Tela 1: o projeto inteiro, numa sequência só ──────────────────
  /*
    A INTRODUÇÃO EM CIMA E OS BLOCOS POR BAIXO, NUMA LINHA SÓ (30/09).

    "Eu fui postar agora a introdução de Minha Identidade e Poder em Jesus e
    simplesmente não consegui encontrar a introdução, porque ela está
    separada e chamada de 'raiz'. Está tudo muito fragmentado. Quero
    padronizar como no mockup: Introdução sempre em cima → Bloco 1 → Bloco 2
    → Bloco 3…, tudo junto e na mesma sequência."

    A introdução vivia na Estrutura raiz e as casas aqui: dois ecrãs para uma
    página só. Agora são uma sequência numerada, como no desenho dele, com os
    cartões de cada etapa à vista, e um toque num cartão abre-o logo — os
    quatro quadrados deixaram de ser um ecrã no caminho. O que se usa menos
    em cada casa (a ordem, a arte da casa, o cartão de impressão, o QR) fica
    nos três pontos.
  */
  const nome = projeto?.nome ?? ''
  const ultimo = projeto ? projeto.primeiro + projeto.blocos - 1 : 0
  const desvio = introducao ? 2 : 1

  /** Cria um cartão e abre-o logo: criar e ficar parado seria obrigá-lo a procurar o que pediu. */
  async function criarEAbrir(chave: string, casa: string, criar: () => Promise<{ id: string }>) {
    definirACriar(chave)
    definirErro(null)
    try {
      const novo = await criar()
      await recarregar()
      entrar(casa, { tela: 'cartao', casa, cartaoId: novo.id })
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível criar o cartão.')
    } finally {
      definirACriar(null)
    }
  }

  /** O bloco seguinte da sequência: Dia 16 depois do Dia 15. */
  async function adicionarBloco() {
    if (!projeto) return
    definirACriar('bloco')
    definirErro(null)
    try {
      await painelDeCartoes.definirBlocos(projectSlug, projeto.blocos + 1)
      await recarregar()
      requestAnimationFrame(() =>
        document
          .getElementById(`vagao-${ultimo + 1}`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      )
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível acrescentar o bloco.')
    } finally {
      definirACriar(null)
    }
  }

  return (
    <>
      <CabecalhoFixo
        projectSlug={projectSlug}
        onde={nome || 'Conteúdo do projeto'}
        voltarPara={`/${projectSlug}/admin`}
        rotuloDeVolta="Painel"
      />
      {dialogoDeDuplicar}
      {avisoDeFeito}
      <div className="editor-projeto">
        <div className="ep-topo">
          <h1>{nome}</h1>
          <span className="ep-selo">Em edição</span>
          <Link className="ep-config" href={`/${projectSlug}/admin/carrossel`}>
            <IconeEngrenagem />
            Configurações do projeto
          </Link>
        </div>

        {erro && !aRestaurarSessao && <p className="erro">{erro}</p>}
        {(carregando || aRestaurarSessao) && <p className="nota">A carregar...</p>}

        <ol className="ep-linha">
          {introducao && (
            <li id="vagao-introducao" className="ep-etapa">
              <span className="ep-passo" style={{ background: COR_DA_INTRODUCAO }}>
                1
              </span>
              <section className="ep-bloco">
                <header className="ep-cabeca">
                  <span className="ep-marca" style={{ background: COR_DA_INTRODUCAO }}>
                    1
                  </span>
                  <span className="ep-titulo">
                    <strong>INTRODUÇÃO</strong>
                    <small>{resumoDaIntroducao(introducao.cartoes)}</small>
                  </span>
                  <button
                    type="button"
                    className="ep-duplicar"
                    style={{ '--cor': COR_DA_INTRODUCAO } as CSSProperties}
                    disabled={aCriar !== null}
                    onClick={() =>
                      void criarEAbrir('introducao', 'introducao', () =>
                        admin.duplicarIntroducao(introducao.contentId),
                      )
                    }
                  >
                    <IconeDuplicar />
                    {aCriar === 'introducao' ? 'A criar...' : 'Duplicar introdução'}
                  </button>
                </header>
                {introducao.cartoes.length === 0 ? (
                  <p className="nota">Ainda não há introdução.</p>
                ) : (
                  introducao.cartoes.map((c) => (
                    <LinhaDaIntroducao
                      key={c.id}
                      cartao={c}
                      menuAberto={menuAberto === c.id}
                      aoAbrirMenu={() => definirMenuAberto(menuAberto === c.id ? null : c.id)}
                      aoEditar={() => {
                        definirMenuAberto(null)
                        entrar('introducao', { tela: 'cartao', casa: 'introducao', cartaoId: c.id })
                      }}
                      aoMudar={async () => {
                        definirMenuAberto(null)
                        await recarregar()
                      }}
                    />
                  ))
                )}
              </section>
            </li>
          )}

          {vagoes.map((v, i) => {
            const cor = corDaCasa(v.casa)
            const cartoes = v.cartoes.filter((c) => c.papel === 'CARTAO')
            /*
              As letras mostram as quatro casas, mesmo as que ainda não têm
              cartão (tocar cria-o), e depois as publicações dele. Os dias não
              têm casas fixas: mostram os cartões que há, ou um para começar.
            */
            const ladrilhos: Array<{ chave: string; cartao?: CartaoAdmin; casa?: number }> =
              v.letra !== null
                ? [
                    ...CASAS.map((_, k) => {
                      const c = cartoes.find((x) => x.slot === k + 1)
                      return { chave: c?.id ?? `casa-${k + 1}`, cartao: c, casa: k + 1 }
                    }),
                    ...cartoes.filter((c) => c.slot === null).map((c) => ({ chave: c.id, cartao: c })),
                  ]
                : cartoes.length
                  ? cartoes.map((c) => ({ chave: c.id, cartao: c }))
                  : [{ chave: 'novo' }]
            const noAr = cartoes.filter((c) => c.estado === 'PUBLICADO').length
            const resumo =
              v.letra !== null
                ? `${v.prontos} de 4 preenchidos${
                    v.extras > 0
                      ? ` · +${v.extras} ${v.extras === 1 ? 'publicação sua' : 'publicações suas'}`
                      : ''
                  }`
                : cartoes.length
                  ? `${noAr} de ${cartoes.length} no ar`
                  : 'Ainda sem publicações'
            return (
              <li key={v.casa} id={`vagao-${v.casa}`} className="ep-etapa">
                <span className="ep-passo" style={{ background: cor }}>
                  {i + desvio}
                </span>
                <section className="ep-bloco">
                  <header className="ep-cabeca">
                    <span className="ep-marca" style={{ background: cor }}>
                      {v.casa}
                    </span>
                    <span className="ep-titulo">
                      <strong>{v.rotulo.toUpperCase()}</strong>
                      <small>{resumo}</small>
                    </span>
                    {v.contentId && (
                      <button
                        type="button"
                        className="ep-duplicar"
                        style={{ '--cor': cor } as CSSProperties}
                        disabled={aCriar !== null}
                        onClick={() =>
                          void criarEAbrir(`duplicar-${v.casa}`, v.casa, () =>
                            admin.acrescentarCartao(v.contentId!),
                          )
                        }
                      >
                        <IconeDuplicar />
                        {aCriar === `duplicar-${v.casa}`
                          ? 'A criar...'
                          : `Duplicar ${unidade.toLowerCase()} ${v.casa}`}
                      </button>
                    )}
                    <button
                      type="button"
                      className="ep-mais"
                      aria-label={`Mais opções: ${v.rotulo}`}
                      onClick={() => entrar(v.casa, { tela: 'quadrados', casa: v.casa })}
                    >
                      ⋯
                    </button>
                  </header>
                  <div className="ep-cartoes">
                    {ladrilhos.map((l, k) => (
                      <Ladrilho
                        key={l.chave}
                        numero={k + 1}
                        cartao={l.cartao}
                        acabadaDeCriar={Boolean(l.cartao && copiaNova === l.cartao.id)}
                        menuAberto={Boolean(l.cartao && menuAberto === `ladrilho-${l.cartao.id}`)}
                        aoAbrirMenu={() => {
                          if (!l.cartao) return
                          const chave = `ladrilho-${l.cartao.id}`
                          definirMenuAberto(menuAberto === chave ? null : chave)
                        }}
                        aoDuplicarPara={() => {
                          if (!l.cartao) return
                          definirMenuAberto(null)
                          definirADuplicarPara({ cartao: l.cartao, casa: v.casa })
                        }}
                        aCriar={aCriar === `${v.casa}-${l.chave}`}
                        desactivado={!l.cartao && (!v.contentId || aCriar !== null)}
                        aoTocar={() => {
                          if (l.cartao) {
                            entrar(v.casa, { tela: 'cartao', casa: v.casa, cartaoId: l.cartao.id })
                            return
                          }
                          if (!v.contentId) return
                          void criarEAbrir(`${v.casa}-${l.chave}`, v.casa, () =>
                            admin.acrescentarCartao(v.contentId!, l.casa),
                          )
                        }}
                      />
                    ))}
                  </div>
                </section>
              </li>
            )
          })}

          {/* Um bloco a seguir ao último, nos projetos numerados. O alfabeto
              tem sempre 26 letras, e por isso aí não há mais nenhum. */}
          {projeto && !projeto.letras && (
            <li className="ep-etapa">
              <span className="ep-passo ep-passo-mais">+</span>
              <button
                type="button"
                className="ep-adicionar"
                disabled={aCriar !== null}
                onClick={() => void adicionarBloco()}
              >
                <span className="ep-adicionar-mais" aria-hidden>
                  +
                </span>
                <span>
                  <strong>
                    {aCriar === 'bloco'
                      ? 'A criar...'
                      : `Adicionar ${unidade.toLowerCase()} (próximo bloco)`}
                  </strong>
                  <small>{`Seguir sequência: ${unidade} ${ultimo + 1}`}</small>
                </span>
              </button>
            </li>
          )}
        </ol>

        {projeto?.letras && vagoes.length > 0 && (
          <p className="fim-composicao">
            {`CONTINUA ATÉ ${capitalizar(artigoDefinido(unidade))} ${vagoes[vagoes.length - 1].rotulo}`.toUpperCase()}
          </p>
        )}
      </div>
    </>
  )
}

/** A cor da introdução, a primeira etapa: o azul da casa. */
const COR_DA_INTRODUCAO = '#2563eb'

function resumoDaIntroducao(cartoes: CartaoAdmin[]) {
  if (cartoes.length === 0) return 'Ainda sem publicações'
  const noAr = cartoes.filter((c) => c.estado === 'PUBLICADO').length
  return `${noAr} de ${cartoes.length} no ar`
}

/**
 * Um cartão da introdução, como no desenho: a foto à esquerda, o título e a
 * descrição à direita. Um toque abre o editor.
 */
function LinhaDaIntroducao({
  cartao,
  menuAberto,
  aoAbrirMenu,
  aoEditar,
  aoMudar,
}: {
  cartao: CartaoAdmin
  menuAberto: boolean
  aoAbrirMenu: () => void
  aoEditar: () => void
  aoMudar: () => Promise<void>
}) {
  const noAr = cartao.estado === 'PUBLICADO'
  return (
    <div className="ep-intro">
      <button type="button" className="ep-intro-corpo" onClick={aoEditar}>
        <span className="ep-intro-foto">
          {cartao.imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cartao.imagem} alt="" />
          ) : (
            <>
              <IconeImagem />
              <b>FOTO</b>
              <em>Tocar para trocar</em>
            </>
          )}
          <span className={cartao.audio ? 'ep-som tem' : 'ep-som'} aria-hidden>
            <IconeSom />
          </span>
        </span>
        <span className="ep-intro-campos">
          <small>Título</small>
          <span className="ep-campo">{cartao.titulo?.trim() || 'Sem título'}</span>
          <small>Descrição</small>
          <span className="ep-campo varias">{cartao.descricao?.trim() || 'Sem descrição'}</span>
          <span className={noAr ? 'ep-selo-estado pronto' : 'ep-selo-estado'}>
            {noAr ? 'PRONTO' : 'RASCUNHO'}
          </span>
        </span>
      </button>
      <button type="button" className="ep-mais ep-intro-menu" aria-label="Opções deste cartão" onClick={aoAbrirMenu}>
        ⋯
      </button>
      {menuAberto && (
        <div className="menu-quadrado" role="menu">
          <button type="button" onClick={aoEditar}>
            ✎ Editar
          </button>
          {noAr ? (
            <button
              type="button"
              onClick={async () => {
                await admin.tirarCartaoDoAr(cartao.id)
                await aoMudar()
              }}
            >
              🚫 Tirar do ar
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  await admin.porCartaoNoAr(cartao.id)
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Não foi possível pôr no ar.')
                }
                await aoMudar()
              }}
            >
              ⬆ Pôr no ar
            </button>
          )}
          <button
            type="button"
            className="perigo"
            onClick={async () => {
              const nome = cartao.titulo || cartao.audio?.title || 'esta publicação'
              if (!confirm(`Excluir "${nome}"? Isto não se desfaz.`)) return
              await admin.apagarCartaoDeVez(cartao.id)
              await aoMudar()
            }}
          >
            🗑 Excluir
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Um cartão de uma casa, como no desenho: o número, o áudio, a foto (ou
 * "Toque para adicionar") e o estado por baixo. Três estados e não dois —
 * ver a nota que estava no antigo quadradinho: RASCUNHO quando já há alguma
 * coisa, VAZIO só quando não há nada.
 */
/*
  OS TRÊS PONTOS EM CADA QUADRADO (10/10).

  "Cada quadrado (Explicação, Música, Versículo e Oração) deve ter os três
  pontinhos, permitindo duplicar individualmente." Aqui só havia os três
  pontos do dia inteiro, que levavam a outro ecrã. Agora cada quadrado com
  conteúdo tem os seus, no canto, e o menu abre ali mesmo: editar, ou
  duplicar para outro dia. O quadrado continua a ser um botão inteiro para
  abrir — os pontos são um botão ao lado dele, e não dentro.
*/
function Ladrilho({
  numero,
  cartao,
  aCriar,
  desactivado,
  aoTocar,
  menuAberto = false,
  aoAbrirMenu,
  aoDuplicarPara,
  acabadaDeCriar = false,
}: {
  numero: number
  cartao?: CartaoAdmin
  aCriar: boolean
  desactivado: boolean
  aoTocar: () => void
  menuAberto?: boolean
  aoAbrirMenu?: () => void
  aoDuplicarPara?: () => void
  acabadaDeCriar?: boolean
}) {
  const noAr = cartao?.estado === 'PUBLICADO'
  const temAlgo = Boolean(
    cartao && (cartao.imagem || cartao.audio || cartao.titulo?.trim() || noAr),
  )
  const estado = noAr ? 'pronto' : temAlgo ? 'rascunho' : 'vazio'
  return (
    <div
      className={acabadaDeCriar ? 'ep-ladrilho-caixa acabada-de-criar' : 'ep-ladrilho-caixa'}
      id={cartao ? `ladrilho-${cartao.id}` : undefined}
    >
    <button
      type="button"
      className={`ep-ladrilho ${estado}`}
      onClick={aoTocar}
      disabled={desactivado}
      aria-label={`Cartão ${numero}: ${estado === 'pronto' ? 'pronto' : estado === 'rascunho' ? 'rascunho' : 'vazio'}`}
    >
      {cartao?.imagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ep-ladrilho-foto" src={cartao.imagem} alt="" />
      )}
      <span className="ep-num">{numero}</span>
      <span className={cartao?.audio ? 'ep-som tem' : 'ep-som'} aria-hidden>
        <IconeSom />
      </span>
      {!cartao?.imagem && (
        <span className="ep-vazio" aria-hidden>
          <IconeImagem />
          <em>{aCriar ? 'A criar...' : 'Toque para adicionar'}</em>
        </span>
      )}
      <span className="ep-estado">
        {estado === 'pronto' ? 'PRONTO' : estado === 'rascunho' ? 'RASCUNHO' : 'VAZIO'}
      </span>
    </button>
      {cartao && temAlgo && aoAbrirMenu && (
        <button
          type="button"
          className="ep-ladrilho-mais"
          aria-label={`Opções do quadrado ${numero}`}
          aria-expanded={menuAberto}
          onClick={aoAbrirMenu}
        >
          ⋯
        </button>
      )}
      {menuAberto && (
        <div className="menu-quadrado ep-ladrilho-menu" role="menu">
          <button type="button" onClick={aoTocar}>
            ✎ Editar
          </button>
          <button type="button" onClick={aoDuplicarPara}>
            ⧉ Duplicar para…
          </button>
        </div>
      )}
    </div>
  )
}

function IconeImagem() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m21 16-5.2-5.2L6 20" />
    </svg>
  )
}

function IconeSom() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

function IconeDuplicar() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
    </svg>
  )
}

function IconeEngrenagem() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

/** Uma cor por letra, estável: a mesma letra tem sempre a mesma cor. */
/**
 * A cor da bola de cada casa. Seis cores que se repetem, para a composição não
 * ficar uma coluna monocromática.
 *
 * Serve letras ("A") e números ("12"): o que conta é a ordem da casa, e por
 * isso um número com dois dígitos escolhe cor pelo número inteiro e não pelo
 * primeiro algarismo.
 */
function corDaCasa(casa: string) {
  const cores = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#0891b2', '#db2777']
  const numero = Number(casa)
  const posicao = Number.isFinite(numero) && casa.trim() !== '' ? numero - 1 : casa.charCodeAt(0) - 65
  return cores[((posicao % cores.length) + cores.length) % cores.length]
}

function Quadrado({
  cartao,
  numero,
  cor,
  menuAberto,
  aoAbrirMenu,
  aoEditar,
  aDuplicar,
  acabadaDeCriar,
  aoDuplicar,
  aoDuplicarPara,
  aoApagar,
  aoTirarDoAr,
  aoPorNoAr,
  aoSubir,
  aoDescer,
  aoCriarImpressao,
}: {
  cartao: CartaoAdmin
  numero: number
  cor: string
  menuAberto: boolean
  aoAbrirMenu: () => void
  aoEditar: () => void
  aoDuplicar: () => Promise<void>
  /** Duplicar para outro dia e outro quadrado (10/10). */
  aoDuplicarPara: () => void
  /** Este cartão está a ser duplicado agora. */
  aDuplicar: boolean
  /** É a cópia acabada de criar: acende por um instante para se ver onde ficou. */
  acabadaDeCriar: boolean
  aoApagar: () => Promise<void>
  aoTirarDoAr: () => Promise<void>
  aoPorNoAr: () => Promise<void>
  aoSubir?: () => void
  aoDescer?: () => void
  aoCriarImpressao?: () => Promise<void>
}) {
  return (
    <div
      id={`quadrado-${cartao.id}`}
      className={
        (cartao.estado === 'PUBLICADO' ? 'quadrado pronto' : 'quadrado') +
        (acabadaDeCriar ? ' acabada-de-criar' : '')
      }
    >
      <span className="numero" style={{ background: cor }}>
        {numero}
      </span>
      <button type="button" className="tres-pontos" aria-label="Opções" onClick={aoAbrirMenu}>
        ⋯
      </button>

      <button type="button" className="corpo-quadrado" onClick={aoEditar}>
        {cartao.imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cartao.imagem} alt="" aria-hidden />
        ) : (
          <span className="pilha" aria-hidden style={{ color: cor }}>
            ▤
          </span>
        )}
        <span className="nome-quadrado">
          {(cartao.nomeInterno ?? 'Cartão').toUpperCase()}
          {cartao.slot === null && <em> (cópia)</em>}
        </span>
        <span className="estado-quadrado">
          {cartao.estado === 'PUBLICADO' ? 'PRONTO' : 'RASCUNHO'}
        </span>
      </button>

      {/* Setas, e não arrastar. O painel é usado no telemóvel, e arrastar uma
          grelha é justamente o gesto que briga com a rolagem da página — a
          pessoa tenta descer e leva um cartão com ela. */}
      <div className="setas-quadrado">
        <button type="button" aria-label="Mover para trás" onClick={aoSubir} disabled={!aoSubir}>
          ‹
        </button>
        <button
          type="button"
          aria-label="Mover para a frente"
          onClick={aoDescer}
          disabled={!aoDescer}
        >
          ›
        </button>
      </div>

      {menuAberto && (
        <div className="menu-quadrado" role="menu">
          <button type="button" onClick={aoEditar}>
            ✎ Editar
          </button>
          {/* Duplicar escolhe o destino: o dia e o quadrado (10/10). A cópia vazia
              ao lado, que era o que isto fazia, ficou como "Nova cópia aqui". */}
          <button type="button" onClick={aoDuplicarPara}>
            ⧉ Duplicar para…
          </button>
          <button type="button" disabled={aDuplicar} onClick={() => void aoDuplicar()}>
            {aDuplicar ? '＋ A criar...' : '＋ Nova cópia aqui'}
          </button>
          {/* TIRAR DO AR e EXCLUIR são duas acções, e não uma com aviso.
              Tirar do ar é reversível e usa-se com pressa — publicou-se o que
              não devia. Excluir é definitivo e usa-se com calma. Num só botão,
              a pressa da primeira acabaria por levar a segunda pela frente. */}
          {cartao.estado === 'PUBLICADO' ? (
            <button type="button" onClick={() => void aoTirarDoAr()}>
              🚫 Tirar do ar
            </button>
          ) : (
            <button type="button" onClick={() => void aoPorNoAr()}>
              ⬆ Pôr no ar
            </button>
          )}
          <button type="button" className="perigo" onClick={() => void aoApagar()}>
            🗑 {cartao.slot === null ? 'Excluir' : 'Esvaziar'}
          </button>
          {aoCriarImpressao && (
            <button type="button" onClick={() => void aoCriarImpressao()}>
              🖨 Criar cartão
            </button>
          )}
        </div>
      )}
    </div>
  )
}
