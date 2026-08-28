'use client'

import { useCallback, useEffect, useState } from 'react'
import { admin, type CartaoAdmin } from '@/lib/admin'
import { CabecalhoFixo } from './CabecalhoFixo'
import { EditorDeCartao } from './EditorDeCartao'
import { CartaoDaRaiz } from './CartaoDaRaiz'
import { useAuth } from './ProvedorDeAuth'

/**
 * O convite do grupo do Produto Vivo está configurado?
 *
 * Lê-se a mesma variável que a página pública lê. Ler outra coisa qualquer aqui
 * era repetir o erro que criou este defeito: a página lia um nome e o build
 * passava outro, e ninguém deu por isso durante dias porque uma variável que
 * falta é uma string vazia, e não um erro.
 */
const TEM_GRUPO = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(
  process.env.NEXT_PUBLIC_PV_GRUPO_URL ?? '',
)

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
          somOpcional
        />
      </>
    )
  }

  const pv = dados?.produtoVivo
  const cartoes = pv?.cartoes ?? []
  const comSom = cartoes.filter((c) => c.audio).length
  /*
    O QUE ESTÁ NO AR É O QUE A PÁGINA DESENHA, e não o que o estado diz.

    Escrevi este aviso a contar os PUBLICADO e estava errado: a página pública
    mostra qualquer cartão que tenha imagem ou som, rascunho ou não, e é assim
    de propósito desde 23/08, para que tirar do ar seja uma decisão e não um
    efeito secundário de estar por acabar. Com a contagem por estado, o painel
    dizia "nada está no ar" enquanto as imagens dele estavam lá.

    É o mesmo defeito dos comentários de 26/08 com outra roupa: o número vinha
    de um sítio e o ecrã de outro. O número tem de sair de onde sai o desenho.
  */
  const noAr = cartoes.filter((c) => c.imagem || c.audio).length
  const temGrupoConfigurado = TEM_GRUPO

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

            {/*
              O ESTADO DA PÁGINA PÚBLICA, DITO AQUI.

              Um cartão em rascunho não sai na página, e é assim de propósito
              desde 23/08. Mas o painel mostrava-o na mesma sem dizer que ele
              não está no ar, e a diferença entre "está lá" e "está lá em
              rascunho" é a diferença entre a página ter conteúdo e estar vazia.
              Ele abriu a página pública em 28/08 e encontrou-a vazia sem que
              nada, em lado nenhum, lhe dissesse porquê.
            */}
            {cartoes.length > 0 && noAr === 0 && (
              <p className="aviso-painel">
                Nenhuma destas publicações está na página ainda: falta a imagem em todas. Toque numa
                para a carregar.
              </p>
            )}
            {cartoes.length === 0 && (
              <p className="aviso-painel">
                A página pública do Produto Vivo está vazia neste momento. Use ACRESCENTAR
                PUBLICAÇÃO para começar.
              </p>
            )}

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

            {/* O convite do grupo, avisado a quem o pode resolver. Estava
                escrito na página pública, à frente das empresas. */}
            {dados.produtoVivo && !temGrupoConfigurado && (
              <p className="aviso-painel">
                O botão do grupo do WhatsApp não está a aparecer na página pública porque o convite
                não está configurado neste servidor. Envie-me o link do grupo e eu ponho no ar.
              </p>
            )}

            <p className="rodape-raiz">
              {noAr} de {cartoes.length} na página.{' '}
              {comSom === 0
                ? 'O áudio é opcional aqui: a que o receber passa para o fim.'
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
