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
          projectSlug={projectSlug}
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
  const pv = dados?.produtoVivo

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
                <CartaoDaRaiz
                  key={c.id}
                  cartao={c}
                  rotuloVazio="CARREGAR INTRODUÇÃO"
                  menuAberto={menuAberto === c.id}
                  aoAbrirMenu={() => definirMenuAberto(menuAberto === c.id ? null : c.id)}
                  aoEditar={() => {
                    definirMenuAberto(null)
                    definirAEditar(c)
                  }}
                  aoMudar={recarregar}
                  aoFecharMenu={() => definirMenuAberto(null)}
                />
              ))
            ) : (
              <p className="nota">Ainda não há introdução.</p>
            )}
            <p className="nota dica-duplicar">↓ Duplicar cria outra INTRODUÇÃO abaixo</p>
          </li>

          {/* 4. PRODUTO VIVO — multiplicável, como a introdução.
              Ele pediu em 25/08 um modelo vazio para preencher e duplicar
              quantas vezes quisesse. É o mesmo cartão dos áudios: foto, som,
              título, texto e os quatro indicadores. O texto institucional que
              lá estava saiu — era longo e não dizia o que aquilo é. */}
          <li className="vagao" id="produto-vivo">
            <div className="cabeca-raiz">
              <strong>PRODUTO VIVO</strong>
              {pv && (
                <button
                  type="button"
                  className="tres-pontos"
                  aria-label="Opções do Produto Vivo"
                  onClick={() => definirMenuAberto(menuAberto === 'pv' ? null : 'pv')}
                >
                  ⋯
                </button>
              )}
              {menuAberto === 'pv' && pv && (
                <div className="menu-quadrado" role="menu">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={async () => {
                      definirMenuAberto(null)
                      definirOcupado(true)
                      try {
                        await admin.duplicarIntroducao(pv.contentId)
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

            {pv?.cartoes.map((c) => (
              <CartaoDaRaiz
                key={c.id}
                cartao={c}
                rotuloVazio="CARREGAR PRODUTO VIVO"
                menuAberto={menuAberto === c.id}
                aoAbrirMenu={() => definirMenuAberto(menuAberto === c.id ? null : c.id)}
                aoEditar={() => {
                  definirMenuAberto(null)
                  definirAEditar(c)
                }}
                aoMudar={recarregar}
                aoFecharMenu={() => definirMenuAberto(null)}
              />
            ))}
            <p className="nota dica-duplicar">↓ Duplicar cria outra publicação abaixo</p>
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

/**
 * Um cartão da raiz — introdução ou Produto Vivo — com o seu menu.
 *
 * UM SÓ COMPONENTE PARA OS DOIS. A introdução e o Produto Vivo comportam-se
 * exactamente da mesma maneira: multiplicam-se, tiram-se do ar, apagam-se.
 * Escrever a mesma coisa duas vezes é como este projecto arranjou três filas de
 * indicadores diferentes, uma delas sem botões nenhuns.
 */
function CartaoDaRaiz({
  cartao,
  rotuloVazio,
  menuAberto,
  aoAbrirMenu,
  aoEditar,
  aoMudar,
  aoFecharMenu,
}: {
  cartao: CartaoAdmin
  rotuloVazio: string
  menuAberto: boolean
  aoAbrirMenu: () => void
  aoEditar: () => void
  aoMudar: () => Promise<void>
  aoFecharMenu: () => void
}) {
  return (
    <div className="bloco-raiz com-menu">
      <button type="button" className="tres-pontos" aria-label="Opções" onClick={aoAbrirMenu}>
        ⋯
      </button>

      {menuAberto && (
        <div className="menu-quadrado" role="menu">
          <button type="button" onClick={aoEditar}>
            ✎ Editar
          </button>
          {cartao.estado === 'PUBLICADO' ? (
            <button
              type="button"
              onClick={async () => {
                aoFecharMenu()
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
                aoFecharMenu()
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
              aoFecharMenu()
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

      <button type="button" className="area-clicavel" onClick={aoEditar}>
        {cartao.imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-raiz" src={cartao.imagem} alt="" />
        ) : (
          <div className="lugar-raiz">{rotuloVazio}</div>
        )}
        <span className="linha-audio-raiz">▶ {cartao.audio?.title ?? 'Sem áudio'}</span>
        <span className="estado-quadrado">
          {cartao.estado === 'PUBLICADO' ? 'PRONTO' : 'RASCUNHO'}
        </span>
      </button>
    </div>
  )
}
