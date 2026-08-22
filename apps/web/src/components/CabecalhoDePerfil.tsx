'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { PerfilAnfitriao } from '@/lib/api'
import { social, type EstadoDaFaixa } from '@/lib/social'
import { ErroDeApi } from '@/lib/auth'
import { PainelDeComentarios } from './PainelDeComentarios'
import { PainelDePessoas } from './PainelDePessoas'
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
}: {
  projectSlug: string
  projectId: string
  perfisCriados: number
  /** O rosto do projeto: o mesmo para toda a gente que chega. */
  anfitriao: PerfilAnfitriao | null
}) {
  const { usuario } = useAuth()
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
  const [aviso, definirAviso] = useState<string | null>(null)
  /** Trava contra toque repetido: dois pedidos cruzados deixam o coração
   *  a dizer uma coisa e o número outra. */
  const [aCurtir, definirACurtir] = useState(false)
  const [aberto, definirAberto] = useState(false)
  const inicioDoToque = useRef<number | null>(null)

  useEffect(() => {
    if (!anfitriao) return
    void social.estadoDoPerfil(anfitriao.id).then(definirEstado).catch(() => {})
  }, [anfitriao])

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
  const souOAnfitriao = Boolean(usuario && anfitriao && usuario.id === anfitriao.id)
  const nome = anfitriao?.displayName ?? 'Escreva seu nome aqui'
  const descricao = anfitriao?.bio ?? 'Faça o seu descritivo pessoal'

  async function curtir() {
    if (aCurtir) return
    if (!anfitriao) return
    if (!usuario) {
      definirAviso('Entre na sua conta para curtir.')
      return
    }
    definirACurtir(true)
    try {
      const r = await social.curtirPerfil(anfitriao.id)
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
    if (!anfitriao) return
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
        props: { acao: 'partilhar_perfil', perfilId: anfitriao.id },
      })
      definirEstado((x) => ({ ...x, compartilhamentos: x.compartilhamentos + 1 }))
    } catch {
      // Falhar a contar não desfaz uma partilha que já aconteceu.
    }
  }




  return (
    <>
      <div className={aberto ? 'perfil-capa sangria com-painel' : 'perfil-capa sangria'}>
        {anfitriao?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-capa" src={anfitriao.avatarUrl} alt={nome} />
        ) : (
          <div className="foto-capa capa-vazia">
            <span aria-hidden>📷</span>
            <span>Coloque sua foto aqui</span>
          </div>
        )}

        <Link className="selo-pv-capa" href={`/${projectSlug}/produto-vivo`}>
          PV
        </Link>

        {/* Só nome e selo sobre a foto, numa linha, com sombra própria. */}
        <div className="nome-no-retrato">
          <h1 title={nome}>
            {nome}
            {anfitriao && (
              <span className="verificado" aria-label="Perfil confirmado">
                ✓
              </span>
            )}
          </h1>
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

        <div
          className="painel-perfil"
          role="region"
          aria-label="Informações do perfil"
        >
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
            {anfitriao?.guardianName && (
              <p className="responsavel-perfil">{anfitriao.guardianName}</p>
            )}
            <p className="bio-perfil">{descricao}</p>
            {anfitriao?.createdAt && (
              <p className="nota">
                Na plataforma desde{' '}
                {new Date(anfitriao.createdAt).toLocaleDateString('pt-PT', {
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

        <button
          type="button"
          className={estado.curtidoPorMim ? 'indicador-grande activo' : 'indicador-grande'}
          onClick={curtir}
          disabled={souOAnfitriao}
          title={souOAnfitriao ? 'Este é o seu perfil' : 'Curtir'}
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

        <button type="button" className="indicador-grande" onClick={partilhar} aria-label="Partilhar">
          <span className="simbolo">
            <SetaGrande />
          </span>
          <strong>{abreviar(estado.compartilhamentos)}</strong>
        </button>
      </div>

      {aviso && <p className="nota">{aviso}</p>}

      {pessoasAbertas && anfitriao && (
        <PainelDePessoas userId={anfitriao.id} aoFechar={() => definirPessoasAbertas(false)} />
      )}

      {comentariosAbertos && (
        <PainelDeComentarios
          projectSlug={projectSlug}
          titulo={nome}
          comentarios={estado.lista}
          usuarioId={usuario?.id ?? null}
          avatarUrl={usuario ? (anfitriao?.avatarUrl ?? null) : null}
          aoFechar={() => definirComentariosAbertos(false)}
          aoComentar={async (t, parentId) => {
            if (!anfitriao) return
            const novo = await social.comentarNoPerfil(anfitriao.id, projectId, t, parentId)
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

      <div className="linha-acoes">
        <BotaoDenunciar
          projectId={projectId}
          targetType="PROFILE"
          targetId={anfitriao?.id ?? ''}
          podeBloquear={Boolean(anfitriao?.id)}
        />

        <span className="nota-monitor">
          {anfitriao?.guardianName
            ? 'Perfil acompanhado por um adulto'
            : 'Descreva quem monitora este perfil'}
        </span>

        <Link
          className="botao-acao"
          href={souOAnfitriao ? `/${projectSlug}/perfil` : `/${projectSlug}/instalar`}
        >
          👤 {souOAnfitriao ? 'EDITAR MEU PERFIL' : 'CRIAR MEU PERFIL'}
        </Link>

        <span className="pilula-contador" title="Perfis criados">
          👥 {abreviar(perfisCriados)}
        </span>
      </div>
    </>
  )
}
