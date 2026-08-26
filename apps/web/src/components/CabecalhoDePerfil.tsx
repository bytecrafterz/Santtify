'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { PerfilAnfitriao } from '@/lib/api'
import { social, type EstadoDaFaixa } from '@/lib/social'
import { ErroDeApi } from '@/lib/auth'
import { PainelDeComentarios } from './PainelDeComentarios'
import { PainelDePessoas } from './PainelDePessoas'
import { ListaDePessoas } from './ListaDePessoas'
import { rastrear } from '@/lib/track'
import { useAuth } from './ProvedorDeAuth'
import { abreviar } from '@/lib/numeros'
import { BotaoDenunciar } from './BotaoDenunciar'
import { OlhoGrande, CoracaoGrande, BalaoGrande, SetaGrande } from './IconesGrandes'

/**
 * O cartão de perfil no topo da página.
 *
 * SOBRE A FOTO FICA SÓ O ESSENCIAL — nome, selo de confirmação e os quatro
 * indicadores. A descrição saiu dali em 19/08, depois de o cliente mostrar o
 * resultado no telemóvel dele: um texto de quatro linhas sobre um retrato
 * cobria a cara do pai e do filho e não se lia nem o texto nem a fotografia.
 * O erro foi meu, e foi de premissa: escrevi o véu a contar com uma linha de
 * descrição, e a descrição real tem quatro.
 *
 * A descrição passa para um painel que sobe de baixo, com fundo branco e
 * texto escuro. Fechado, mostra só uma pega — a fotografia fica limpa. É o
 * padrão que qualquer pessoa já usou noutras aplicações, e por isso não
 * precisa de instruções.
 */
export function CabecalhoDePerfil({
  projectSlug,
  projectId,
  perfisCriados,
  anfitriao,
  donoEhOUtilizador = false,
  pessoa,
}: {
  projectSlug: string
  projectId: string
  perfisCriados: number
  /** O rosto do projeto: o mesmo para toda a gente que chega. */
  anfitriao: PerfilAnfitriao | null
  /** Em /perfil, o dono é quem entrou, e não o anfitrião. */
  donoEhOUtilizador?: boolean
  /**
   * O perfil de OUTRA pessoa, quando se está a ver o dela.
   *
   * Existe para haver um único componente de perfil em toda a plataforma. Havia
   * três desenhos diferentes da mesma coisa — o anfitrião, quem entra, e os
   * outros — e o dos outros ficava sempre para trás: o escudo por baixo em vez
   * de sobre a foto, e a descrição aberta em vez de recolhida. Ele apanhou as
   * duas em 25/08 e pediu o óbvio: a mesma estrutura em todos.
   */
  pessoa?: PerfilAnfitriao | null
}) {
  const { usuario } = useAuth()

  /**
   * DE QUEM É ESTE PERFIL.
   *
   * Normalmente é o anfitrião — o rosto do projeto, igual para toda a gente que
   * chega. Mas em /perfil é o de quem entrou, e a estrutura tem de ser a mesma:
   * foto, escudo, três pontos, os quatro indicadores.
   *
   * Ele pediu-o em 25/08, depois de uma pessoa real se registar e não conseguir
   * encontrar nem editar o próprio perfil: "tudo o que existe no meu perfil deve
   * existir nos outros perfis também".
   */
  const dono = pessoa
    ? pessoa
    : donoEhOUtilizador && usuario
      ? {
          id: usuario.id,
          displayName: usuario.displayName,
          avatarUrl: usuario.avatarUrl,
          bio: null,
          guardianName: null,
          createdAt: usuario.createdAt,
        }
      : anfitriao
  const [estado, definirEstado] = useState<EstadoDaFaixa>({
    visualizacoes: 0,
    curtidas: 0,
    comentarios: 0,
    compartilhamentos: 0,
    curtidoPorMim: false,
    lista: [],
  })
  const [comentariosAbertos, definirComentariosAbertos] = useState(false)
  const [pessoasAbertas, definirPessoasAbertas] = useState(false)
  const [opcoesAbertas, definirOpcoesAbertas] = useState(false)
  const [pessoasDoProjeto, definirPessoasDoProjeto] = useState(false)
  const [aviso, definirAviso] = useState<string | null>(null)
  /** Trava contra toque repetido: dois pedidos cruzados deixam o coração
   *  a dizer uma coisa e o número outra. */
  const [aCurtir, definirACurtir] = useState(false)
  const [aberto, definirAberto] = useState(false)
  const inicioDoToque = useRef<number | null>(null)

  /**
   * Relê SEMPRE que a sessão muda, e não só quando o perfil aparece.
   *
   * O access token só vive em memória, e ao abrir a página ele ainda não
   * existe: é preciso trocar o refresh guardado por um novo, e isso demora.
   * Esta leitura acontecia uma vez, nesse instante — sem token — e o servidor
   * respondia como responde a um visitante: "ninguém curtiu isto, muito menos
   * tu". O coração ficava vazio mesmo tendo sido a própria pessoa a enchê-lo.
   *
   * Com `usuario?.id` na lista, a leitura repete-se assim que a sessão entra.
   */
  useEffect(() => {
    if (!dono) return
    void social
      .estadoDoPerfil(dono.id)
      .then(definirEstado)
      .catch(() => {})
  }, [dono, usuario?.id])

  // Escape fecha, como em qualquer painel. Sem isto, quem abre sem querer no
  // computador fica sem saída óbvia.
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') definirAberto(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  function aoTocarInicio(e: React.TouchEvent) {
    inicioDoToque.current = e.touches[0]?.clientY ?? null
  }

  /**
   * Arrastar para cima abre, para baixo fecha.
   *
   * O limiar de 24 pixels existe porque um toque nunca é perfeitamente parado:
   * sem ele, tocar na pega registaria um arrasto minúsculo e o painel abriria
   * e fecharia no mesmo gesto.
   */
  function aoTocarFim(e: React.TouchEvent) {
    const inicio = inicioDoToque.current
    inicioDoToque.current = null
    if (inicio === null) return
    const delta = inicio - (e.changedTouches[0]?.clientY ?? inicio)
    if (delta > 24) definirAberto(true)
    else if (delta < -24) definirAberto(false)
  }

  const temConta = Boolean(usuario)
  // O dono do perfil edita-o; quem chega de fora é convidado a criar o seu.
  const souOAnfitriao = Boolean(usuario && dono && usuario.id === dono.id)
  const nome = dono?.displayName ?? 'Escreva seu nome aqui'
  const descricao = dono?.bio ?? 'Faça o seu descritivo pessoal'

  async function curtir() {
    if (aCurtir) return
    if (!dono) return
    if (!usuario) {
      definirAviso('Entre na sua conta para curtir.')
      return
    }
    definirACurtir(true)
    try {
      const r = await social.curtirPerfil(dono.id)
      definirEstado((x) => ({ ...x, curtidoPorMim: r.curtido, curtidas: r.total }))
      definirAviso(null)
    } catch (e) {
      // Dizer o motivo verdadeiro. O servidor recusa curtir o próprio perfil e
      // explica-o; a mensagem genérica transformava uma regra compreensível
      // numa avaria, e o cliente passou a achar que o botão estava partido.
      definirAviso(e instanceof ErroDeApi ? e.message : 'Não foi possível curtir agora.')
    } finally {
      definirACurtir(false)
    }
  }

  async function partilhar() {
    if (!dono) return
    const url = window.location.origin + window.location.pathname

    // Conta depois, e só se a partilha for concluída: cancelar não é partilhar.
    try {
      if (navigator.share) {
        await navigator.share({ title: nome, url })
      } else {
        await navigator.clipboard?.writeText(url)
        definirAviso('Link copiado.')
      }
    } catch {
      return
    }

    try {
      await rastrear({
        projectId,
        type: 'CUSTOM',
        props: { acao: 'partilhar_perfil', perfilId: dono.id },
      })
      definirEstado((x) => ({ ...x, compartilhamentos: x.compartilhamentos + 1 }))
    } catch {
      // Falhar a contar não desfaz uma partilha que já aconteceu.
    }
  }

  return (
    <>
      <div className={aberto ? 'perfil-capa sangria com-painel' : 'perfil-capa sangria'}>
        {dono?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-capa" src={dono.avatarUrl} alt={nome} />
        ) : (
          <div className="foto-capa capa-vazia">
            <span aria-hidden>📷</span>
            <span>Coloque sua foto aqui</span>
          </div>
        )}

        {/* SOBRE A FOTO, SÓ DOIS CONTROLOS: o escudo à esquerda e os três
            pontos à direita. Lista dele, de 24/08, e é a mesma regra que ele já
            tinha usado nos cartões — uma fotografia limpa, com o que se pode
            fazer nos cantos. O selo PV saiu daqui: passou a ser um dos acessos
            da barra de baixo, e não precisava de estar nos dois sítios. */}
        <div className="controlos-da-capa">
          <span className="canto-esquerdo">
            <BotaoDenunciar
              projectId={projectId}
              targetType="PROFILE"
              targetId={dono?.id ?? ''}
              podeBloquear={Boolean(dono?.id)}
            />
          </span>

          <button
            type="button"
            className="canto-direito tres-pontos-capa"
            aria-label="Opções do perfil"
            aria-expanded={opcoesAbertas}
            onClick={() => definirOpcoesAbertas((v) => !v)}
          >
            ⋮
          </button>

          {opcoesAbertas && (
            <div className="menu-da-capa" role="menu">
              {souOAnfitriao ? (
                <Link href={`/${projectSlug}/perfil`}>✎ Editar perfil</Link>
              ) : temConta ? (
                <Link href={`/${projectSlug}/perfil`}>👤 O meu perfil</Link>
              ) : (
                <Link href={`/${projectSlug}/instalar`}>👤 Criar o meu perfil</Link>
              )}
              {/* Tocar no número abre a lista. Ele pediu-o em 25/08 e tem
                  razão: um número de perfis sem ninguém por trás não diz nada
                  a quem chega. */}
              <button
                type="button"
                className="linha-menu-capa"
                onClick={() => {
                  definirOpcoesAbertas(false)
                  definirPessoasDoProjeto(true)
                }}
              >
                👥 {abreviar(perfisCriados)} perfis criados
              </button>
            </div>
          )}
        </div>

        {/*
          Só o nome sobre a foto.

          Havia aqui um sinal azul de confirmado, e ele mandou-o tirar em 27/08
          com uma razão que se percebe: nada era verificado, o sinal aparecia a
          quem fosse dono do perfil e mais nada. Um selo de confiança que não
          verifica coisa nenhuma é pior do que não existir, porque ensina a
          confiar nele. Quando houver mesmo verificação, volta.
        */}
        <div className="nome-no-retrato">
          <h1 title={nome}>{nome}</h1>
        </div>

        {/* Véu para fechar tocando fora. Só existe com o painel aberto, senão
            comeria os toques na própria fotografia. */}
        {aberto && (
          <button
            type="button"
            className="veu-do-painel"
            aria-label="Fechar informações"
            onClick={() => definirAberto(false)}
          />
        )}

        <div className="painel-perfil" role="region" aria-label="Informações do perfil">
          <button
            type="button"
            className="pega"
            aria-expanded={aberto}
            aria-label={aberto ? 'Fechar informações do perfil' : 'Abrir informações do perfil'}
            onClick={() => definirAberto((v) => !v)}
            onTouchStart={aoTocarInicio}
            onTouchEnd={aoTocarFim}
          >
            <span className="traco" aria-hidden />
            <span className="seta" aria-hidden>
              {aberto ? '▾' : '▴'}
            </span>
          </button>

          <div className="conteudo-painel" aria-hidden={!aberto}>
            <h2>{nome}</h2>
            {dono?.guardianName && <p className="responsavel-perfil">{dono.guardianName}</p>}
            <p className="bio-perfil">{descricao}</p>
            {dono?.createdAt && (
              <p className="nota">
                Na plataforma desde{' '}
                {new Date(dono.createdAt).toLocaleDateString('pt-PT', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Fora da fotografia, no mesmo formato dos cartões que ele aprovou:
          imagem limpa, e os quatro indicadores organizados por baixo. */}
      <div className="indicadores-publicacao">
        {/* O olho é só contagem. Ele foi claro em 22/08: ver mostra o número,
            curtir mostra quem curtiu. Eu tinha posto a lista no olho porque o
            coração já tinha outra função — mas isso obriga a pessoa a
            adivinhar, e adivinhar num botão é o mesmo que ele não existir. */}
        <span className="indicador-grande">
          <span className="simbolo">
            <OlhoGrande />
          </span>
          <strong>{abreviar(estado.visualizacoes)}</strong>
        </span>

        {/* CURTIR O PRÓPRIO PERFIL PASSA A SER PERMITIDO.
            Eu tinha-o proibido por uma ideia minha de bom gosto — ninguém curte
            a sua própria fotografia — e o resultado foi ele tocar no coração do
            seu perfil dezenas de vezes sem nada acontecer e sem explicação
            nenhuma. Já me tinha acontecido o mesmo em 21/08 com o curtir dos
            conteúdos, e voltei a fazê-lo aqui. A regra é dele, e o botão é
            dele. */}
        <button
          type="button"
          className={estado.curtidoPorMim ? 'indicador-grande activo' : 'indicador-grande'}
          onClick={curtir}
          title="Curtir"
          aria-pressed={estado.curtidoPorMim}
          aria-label="Curtir"
        >
          <span className="simbolo">
            <CoracaoGrande cheio={estado.curtidoPorMim} />
          </span>
          <strong
            onClick={(ev) => {
              // Tocar no NÚMERO mostra quem curtiu; tocar no coração curte.
              // São duas intenções diferentes no mesmo sítio, e separá-las
              // pelo alvo do toque é o que as redes sociais fazem.
              ev.stopPropagation()
              definirPessoasAbertas(true)
            }}
          >
            {abreviar(estado.curtidas)}
          </strong>
        </button>

        <button
          type="button"
          className="indicador-grande"
          onClick={() => definirComentariosAbertos((v) => !v)}
          aria-label="Comentários"
        >
          <span className="simbolo">
            <BalaoGrande />
          </span>
          <strong>{abreviar(estado.comentarios)}</strong>
        </button>

        <button
          type="button"
          className="indicador-grande"
          onClick={partilhar}
          aria-label="Partilhar"
        >
          <span className="simbolo">
            <SetaGrande />
          </span>
          <strong>{abreviar(estado.compartilhamentos)}</strong>
        </button>
      </div>

      {aviso && <p className="nota">{aviso}</p>}

      {pessoasDoProjeto && (
        <ListaDePessoas projectSlug={projectSlug} aoFechar={() => definirPessoasDoProjeto(false)} />
      )}

      {pessoasAbertas && dono && (
        <PainelDePessoas userId={dono.id} aoFechar={() => definirPessoasAbertas(false)} />
      )}

      {comentariosAbertos && (
        <PainelDeComentarios
          projectSlug={projectSlug}
          titulo={nome}
          comentarios={estado.lista}
          usuarioId={usuario?.id ?? null}
          avatarUrl={usuario ? (dono?.avatarUrl ?? null) : null}
          aoFechar={() => definirComentariosAbertos(false)}
          aoComentar={async (t, parentId) => {
            if (!dono) return
            const novo = await social.comentarNoPerfil(dono.id, projectId, t, parentId)
            definirEstado((x) => ({
              ...x,
              comentarios: x.comentarios + 1,
              lista: [novo, ...x.lista],
            }))
          }}
          aoApagar={async (id) => {
            await social.apagarComentario(id)
            definirEstado((x) => ({
              ...x,
              comentarios: Math.max(0, x.comentarios - 1),
              lista: x.lista.filter((c) => c.id !== id),
            }))
          }}
          aoActualizar={(c) =>
            definirEstado((x) => ({
              ...x,
              lista: x.lista.map((y) => (y.id === c.id ? c : y)),
            }))
          }
        />
      )}

      {/* CRIAR CONTA, À VISTA, PARA QUEM AINDA NÃO TEM.
          Ele mandou o link a amigos e vários não encontraram onde se registar.
          Tinha razão e a culpa é minha: em 24/08 arrumei essa entrada dentro dos
          três pontos, e quem chega de fora não abre um menu à procura de uma
          coisa que não sabe que existe.

          Só aparece a quem não entrou, e desaparece sozinho depois do cadastro —
          foi exactamente o que ele pediu. */}
      {!temConta && (
        <div className="convite-a-criar-conta">
          <p className="titulo-convite">Ainda não tem uma conta?</p>
          <p className="nota">
            Crie o seu perfil para curtir, comentar e fazer parte da nossa comunidade.
          </p>
          <Link className="botao-acao largo" href={`/${projectSlug}/cadastrar`}>
            👤 CRIAR MEU PERFIL
          </Link>
        </div>
      )}

      {/* A FILA DE BAIXO SAIU INTEIRA, a pedido dele em 24/08.
          "Editar meu perfil" subiu para os três pontos, sobre a fotografia.
          "Perfil acompanhado por um adulto" já está dentro do painel do
          perfil, e repetido aqui era a mesma frase duas vezes no mesmo ecrã.
          O escudo subiu para o canto esquerdo da capa, e a contagem de perfis
          passou para dentro do menu — onde se vai ver, e não onde se tropeça. */}
    </>
  )
}
