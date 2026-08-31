'use client'

import { CabecalhoFixo } from './CabecalhoFixo'
import { EdicaoDoProdutoVivo } from './EdicaoDoProdutoVivo'
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

  if (aRestaurarSessao) return <p className="vazio">Carregando...</p>

  return (
    <>
      <CabecalhoFixo
        projectSlug={projectSlug}
        onde="Produto Vivo"
        voltarPara={`/${projectSlug}/admin`}
      />

      <div className="raiz-do-projecto">
        <p className="subtitulo">
          A página que as empresas veem. As artes aparecem primeiro e o conteúdo principal, que leva
          o áudio, fica sempre por último.
        </p>

        {/* O aviso do convite do grupo fica: saiu da página pública em 29/08
            porque ali era ruído para quem visita, e o sítio dele é aqui, onde
            ele pode resolver. */}
        {!TEM_GRUPO && (
          <p className="aviso-painel">
            O botão do grupo do WhatsApp não aparece na página pública porque o convite não está
            configurado neste servidor. Envie-me o link do grupo e eu ponho no ar.
          </p>
        )}

        <EdicaoDoProdutoVivo projectSlug={projectSlug} />
      </div>
    </>
  )
}
