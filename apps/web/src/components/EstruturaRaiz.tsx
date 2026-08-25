'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { admin, type CartaoAdmin } from '@/lib/admin'
import { CabecalhoFixo } from './CabecalhoFixo'
import { EditorDeCartao } from './EditorDeCartao'
import { useAuth } from './ProvedorDeAuth'

/**
 * A raiz: perfil, introdução e alfabeto, na mesma tela.
 *
 * Desenho dele de 24/08, e a frase que ele pôs no rodapé é a definição:
 * "Perfil + Introdução + Alfabeto = uma única raiz". O que esta tela mostra é
 * que a página não é uma pilha de secções soltas — tem três partes, e duas
 * delas são fixas.
 *
 * FIXO QUER DIZER FIXO. O perfil e o alfabeto não se duplicam nem se apagam,
 * e por isso não têm menu nenhum: um botão que nunca deve ser tocado é um
 * botão que mais cedo ou mais tarde é tocado. A introdução é a única parte
 * multiplicável, e é a única com os três pontos.
 */
export function EstruturaRaiz({ projectSlug }: { projectSlug: string }) {
  const { carregando: aRestaurarSessao } = useAuth()
  const [dados, definirDados] = useState<Awaited<ReturnType<typeof admin.estruturaRaiz>> | null>(
    null,
  )
  const [erro, definirErro] = useState<string | null>(null)
  const [aEditar, definirAEditar] = useState<CartaoAdmin | null>(null)
  const [menuAberto, definirMenuAberto] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      definirDados(await admin.estruturaRaiz(projectSlug))
      definirErro(null)
    } catch {
      definirErro('Não foi possível carregar a estrutura.')
    }
  }, [projectSlug])

  // Espera pela sessão: o access token só vive em memória e ao abrir a página
  // ainda não existe.
  useEffect(() => {
    if (aRestaurarSessao) return
    void recarregar()
  }, [recarregar, aRestaurarSessao])

  if (aEditar) {
    return (
      <>
        <CabecalhoFixo
          projectSlug={projectSlug}
          onde="Introdução"
          voltarPara={`/${projectSlug}/admin`}
        />
        <EditorDeCartao
          key={aEditar.id}
          cartao={aEditar}
          aoGuardar={async () => {
            await recarregar()
            definirAEditar(null)
          }}
          aoCancelar={() => definirAEditar(null)}
        />
      </>
    )
  }

  const intro = dados?.introducao

  return (
    <>
      <CabecalhoFixo
        projectSlug={projectSlug}
        onde="Estrutura raiz"
        voltarPara={`/${projectSlug}/admin`}
      />
      <div className="estrutura-raiz">
        {erro && <p className="erro">{erro}</p>}
        {!dados && !erro && <p className="nota">A carregar...</p>}

        <ol className="composicao">
          {/* 1. PERFIL — fixo */}
          <li className="vagao">
            <div className="cabeca-raiz">
              <strong>PERFIL</strong>
              <span className="selo-fixo">🔒 FIXO</span>
            </div>
            <div className="bloco-raiz">
              {dados?.perfil?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="foto-raiz" src={dados.perfil.avatarUrl} alt="" />
              ) : (
                <div className="lugar-raiz">CARREGAR PERFIL</div>
              )}
              <p className="nome-raiz">{dados?.perfil?.displayName ?? 'Sem perfil definido'}</p>
              <Link className="editar-raiz" href={`/${projectSlug}/perfil`}>
                Editar perfil
              </Link>
            </div>
          </li>

          {/* 2. INTRODUÇÃO — a única parte multiplicável */}
          <li className="vagao">
            <div className="cabeca-raiz">
              <strong>INTRODUÇÃO</strong>
              {intro && (
                <button
                  type="button"
                  className="tres-pontos"
                  aria-label="Opções da introdução"
                  onClick={() => definirMenuAberto(menuAberto === 'intro' ? null : 'intro')}
                >
                  ⋯
                </button>
              )}
              {menuAberto === 'intro' && intro && (
                <div className="menu-quadrado" role="menu">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={async () => {
                      definirMenuAberto(null)
                      definirOcupado(true)
                      try {
                        await admin.duplicarIntroducao(intro.contentId)
                        await recarregar()
                      } finally {
                        definirOcupado(false)
                      }
                    }}
                  >
                    ⧉ Duplicar
                  </button>
                </div>
              )}
            </div>

            {intro?.cartoes.length ? (
              intro.cartoes.map((c) => (
                <div key={c.id} className="bloco-raiz com-menu">
                  {/* Os três pontos em CADA cartão publicado. Foi aqui que ele
                      ficou preso em 25/08: duas memorizações repetidas no topo
                      do perfil e nenhuma forma de mexer em nenhuma delas. */}
                  <button
                    type="button"
                    className="tres-pontos"
                    aria-label="Opções desta introdução"
                    onClick={() => definirMenuAberto(menuAberto === c.id ? null : c.id)}
                  >
                    ⋯
                  </button>

                  {menuAberto === c.id && (
                    <div className="menu-quadrado" role="menu">
                      <button
                        type="button"
                        onClick={() => {
                          definirMenuAberto(null)
                          definirAEditar(c)
                        }}
                      >
                        ✎ Editar
                      </button>
                      {c.estado === 'PUBLICADO' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            definirMenuAberto(null)
                            await admin.tirarCartaoDoAr(c.id)
                            await recarregar()
                          }}
                        >
                          🚫 Tirar do ar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            definirMenuAberto(null)
                            try {
                              await admin.porCartaoNoAr(c.id)
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Não foi possível pôr no ar.')
                            }
                            await recarregar()
                          }}
                        >
                          ⬆ Pôr no ar
                        </button>
                      )}
                      <button
                        type="button"
                        className="perigo"
                        onClick={async () => {
                          definirMenuAberto(null)
                          const nome = c.titulo || c.audio?.title || 'esta introdução'
                          if (!confirm(`Excluir "${nome}"? Isto não se desfaz.`)) return
                          await admin.apagarCartaoDeVez(c.id)
                          await recarregar()
                        }}
                      >
                        🗑 Excluir
                      </button>
                    </div>
                  )}

                  <button type="button" className="area-clicavel" onClick={() => definirAEditar(c)}>
                    {c.imagem ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="foto-raiz" src={c.imagem} alt="" />
                    ) : (
                      <div className="lugar-raiz">CARREGAR INTRODUÇÃO</div>
                    )}
                    <span className="linha-audio-raiz">▶ {c.audio?.title ?? 'Sem áudio'}</span>
                    <span className="estado-quadrado">
                      {c.estado === 'PUBLICADO' ? 'PRONTO' : 'RASCUNHO'}
                    </span>
                  </button>
                </div>
              ))
            ) : (
              <p className="nota">Ainda não há introdução.</p>
            )}
            <p className="nota dica-duplicar">↓ Duplicar cria outra INTRODUÇÃO abaixo</p>
          </li>

          {/* 3. ALFABETO — fixo */}
          <li className="vagao">
            <div className="cabeca-raiz">
              <strong>ALFABETO</strong>
              <span className="selo-fixo">🔒 FIXO</span>
            </div>
            <div className="bloco-raiz">
              <p className="nota">Alfabeto A–Z</p>
              <div className="previa-alfabeto">
                {(dados?.alfabeto.letras ?? []).map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
              <Link className="editar-raiz" href={`/${projectSlug}/admin/alfabeto`}>
                Abrir o alfabeto
              </Link>
            </div>
          </li>
        </ol>

        <p className="rodape-raiz">Perfil + Introdução + Alfabeto = uma única raiz</p>
      </div>
    </>
  )
}
