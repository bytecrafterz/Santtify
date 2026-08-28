'use client'

import { useCallback, useEffect, useState } from 'react'
import { admin, type CartaoAdmin } from '@/lib/admin'
import { CabecalhoFixo } from './CabecalhoFixo'
import { EditorDeCartao } from './EditorDeCartao'
import { CartaoDaRaiz } from './CartaoDaRaiz'
import { useAuth } from './ProvedorDeAuth'

/**
 * O Produto Vivo, no seu próprio sítio.
 *
 * Vivia dentro da Estrutura raiz, a seguir ao perfil e à introdução, numa
 * página cujo próprio rodapé diz "Perfil + Introdução + Alfabeto = uma única
 * raiz". O Produto Vivo não é nada disso: é a página comercial que as empresas
 * veem, e o alfabeto não tem nada que ver com ela. Ele pediu a separação em
 * 28/08 e tem razão — a entrada no painel já dizia "Produto Vivo" e levava a
 * uma página do perfil, que é a definição de uma coisa arrumada no sítio
 * errado.
 *
 * A ORDEM É A REGRA DELE: as imagens primeiro, e a arte com áudio ou vídeo
 * sempre por último. Quantas imagens quiser. Isto substitui a especificação
 * anterior, das três artes fixas, e é mais simples do que ela.
 *
 * Quem decide a ordem é o servidor, e não este ecrã. A mesma função ordena o
 * que aqui aparece e o que a página pública mostra; se fossem duas, um dia ele
 * arrumava numa ordem e via outra publicada.
 */
export function ProdutoVivoAdmin({ projectSlug }: { projectSlug: string }) {
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
      definirErro('Não foi possível carregar o Produto Vivo.')
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
          onde="Produto Vivo"
          voltarPara={`/${projectSlug}/admin/produto-vivo`}
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

  const pv = dados?.produtoVivo
  const cartoes = pv?.cartoes ?? []
  const comSom = cartoes.filter((c) => c.audio).length

  return (
    <>
      <CabecalhoFixo
        projectSlug={projectSlug}
        onde="Produto Vivo"
        voltarPara={`/${projectSlug}/admin`}
      />

      <div className="raiz-do-projecto">
        {erro && <p className="erro">{erro}</p>}
        {!dados && !erro && <p className="vazio">Carregando...</p>}

        {dados && (
          <>
            <p className="subtitulo">
              A página que as empresas veem. As imagens aparecem primeiro e a arte com áudio ou
              vídeo fica sempre por último, independentemente da ordem em que forem criadas.
            </p>

            <ol className="composicao-raiz">
              <li className="vagao" id="produto-vivo">
                <div className="cabeca-raiz">
                  <strong>IMAGENS</strong>
                  <span className="selo-contagem">
                    {cartoes.length - comSom} {cartoes.length - comSom === 1 ? 'imagem' : 'imagens'}
                  </span>
                </div>

                {cartoes.length === 0 && (
                  <p className="nota">Ainda não há nenhuma publicação. Use o botão abaixo.</p>
                )}

                {cartoes.map((c) => (
                  <CartaoDaRaiz
                    key={c.id}
                    cartao={c}
                    rotuloVazio="CARREGAR IMAGEM"
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

                {/* O botão de acrescentar, e não só o duplicar do menu: duplicar
                    precisa de já existir alguma coisa, e quem apagou tudo ficava
                    sem caminho nenhum para recomeçar. */}
                <button
                  type="button"
                  className="acrescentar-cartao"
                  disabled={ocupado || !pv}
                  onClick={async () => {
                    if (!pv) return
                    definirOcupado(true)
                    try {
                      await admin.acrescentarCartaoDaRaiz(pv.contentId)
                      await recarregar()
                    } catch (e) {
                      definirErro(e instanceof Error ? e.message : 'Não foi possível acrescentar.')
                    } finally {
                      definirOcupado(false)
                    }
                  }}
                >
                  + ACRESCENTAR PUBLICAÇÃO
                </button>
              </li>
            </ol>

            <p className="rodape-raiz">
              {comSom === 0
                ? 'Nenhuma publicação tem áudio ainda. A que receber áudio passa para o fim.'
                : comSom === 1
                  ? 'A publicação com áudio fica sempre no fim da página.'
                  : `${comSom} publicações têm áudio e ficam no fim da página.`}
            </p>
          </>
        )}
      </div>
    </>
  )
}
