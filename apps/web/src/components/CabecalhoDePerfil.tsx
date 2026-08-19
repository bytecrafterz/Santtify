'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { auth, type PerfilResposta } from '@/lib/auth'
import { useAuth } from './ProvedorDeAuth'
import { abreviar } from '@/lib/numeros'

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
  perfisCriados,
}: {
  projectSlug: string
  perfisCriados: number
}) {
  const { usuario, carregando } = useAuth()
  const [perfil, definirPerfil] = useState<PerfilResposta | null>(null)
  const [aberto, definirAberto] = useState(false)
  const inicioDoToque = useRef<number | null>(null)

  useEffect(() => {
    if (carregando || !usuario) {
      definirPerfil(null)
      return
    }
    void auth.perfil().then(definirPerfil).catch(() => definirPerfil(null))
  }, [usuario, carregando])

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
  const e = perfil?.estatisticas
  const nome = perfil?.user.displayName ?? usuario?.displayName ?? 'Escreva seu nome aqui'
  const descricao = perfil?.user.bio ?? 'Faça o seu descritivo pessoal'

  return (
    <>
      <div className={aberto ? 'perfil-capa com-painel' : 'perfil-capa'}>
        {perfil?.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-capa" src={perfil.user.avatarUrl} alt={nome} />
        ) : (
          <div className="foto-capa capa-vazia">
            <span aria-hidden>📷</span>
            <span>Coloque sua foto aqui</span>
          </div>
        )}

        <span className="selo-pv-capa" aria-hidden>
          PV
        </span>

        {/* Só nome e selo sobre a foto, numa linha, com sombra própria. */}
        <div className="faixa-nome">
          <h1 title={nome}>
            {nome}
            {temConta && (
              <span className="verificado" aria-label="Perfil confirmado">
                ✓
              </span>
            )}
          </h1>
        </div>

        <div className="trilho">
          <span className="indicador contagem">
            <span className="bolha" aria-hidden>
              👁
            </span>
            {abreviar(e?.conteudosVistos ?? 0)}
          </span>
          <span className="indicador contagem">
            <span className="bolha" aria-hidden>
              ♥
            </span>
            {abreviar(e?.curtidas ?? 0)}
          </span>
          <span className="indicador contagem">
            <span className="bolha" aria-hidden>
              💬
            </span>
            {abreviar(e?.comentarios ?? 0)}
          </span>
          <span className="indicador contagem">
            <span className="bolha" aria-hidden>
              ↗
            </span>
            {abreviar(e?.compartilhamentos ?? 0)}
          </span>
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
            {perfil?.user.guardianName && (
              <p className="responsavel-perfil">{perfil.user.guardianName}</p>
            )}
            <p className="bio-perfil">{descricao}</p>
            {perfil?.user.createdAt && (
              <p className="nota">
                Na plataforma desde{' '}
                {new Date(perfil.user.createdAt).toLocaleDateString('pt-PT', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="linha-acoes">
        <span className="escudo" title="Segurança e denúncia" aria-hidden>
          🛡
        </span>

        <span className="nota-monitor">
          {perfil?.user.guardianName
            ? 'Perfil acompanhado por um adulto'
            : 'Descreva quem monitora este perfil'}
        </span>

        <Link
          className="botao-acao"
          href={temConta ? `/${projectSlug}/perfil` : `/${projectSlug}/cadastrar`}
        >
          👤 {temConta ? 'EDITAR MEU PERFIL' : 'CRIAR MEU PERFIL'}
        </Link>

        <span className="pilula-contador" title="Perfis criados">
          👥 {abreviar(perfisCriados)}
        </span>
      </div>
    </>
  )
}
