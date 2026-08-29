'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { admin, type CartaoAdmin } from '@/lib/admin'
import { CabecalhoFixo } from './CabecalhoFixo'
import { EditorDeCartao } from './EditorDeCartao'
import { CartaoDaRaiz } from './CartaoDaRaiz'
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
              {/* Directo para a edição, como no menu da capa: quem carrega em
                  "Editar perfil" pediu a edição, e não o perfil. */}
              <Link className="editar-raiz" href={`/${projectSlug}/perfil/editar`}>
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
