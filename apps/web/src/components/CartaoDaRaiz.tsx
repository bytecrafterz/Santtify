'use client'

import { admin, type CartaoAdmin } from '@/lib/admin'

/**
 * Um cartão da raiz — introdução ou Produto Vivo — com o seu menu.
 *
 * UM SÓ COMPONENTE PARA OS DOIS. A introdução e o Produto Vivo comportam-se
 * exactamente da mesma maneira: multiplicam-se, tiram-se do ar, apagam-se.
 * Escrever a mesma coisa duas vezes é como este projecto arranjou três filas de
 * indicadores diferentes, uma delas sem botões nenhuns.
 *
 * Em ficheiro próprio desde 28/08, quando o Produto Vivo passou a ter página
 * separada da do perfil. Enquanto vivia dentro do EstruturaRaiz, a página nova
 * teria de o copiar — e copiado é exactamente como ele deixa de ser um só.
 */
export function CartaoDaRaiz({
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
          {/* DUPLICAR POR CARTÃO, e não só a secção inteira.
              O único duplicar que havia estava no topo e criava outro PRODUTO
              VIVO completo — foi isso a "duplicidade no painel" de que ele se
              queixou em 27/08. Ele queria mais uma imagem dentro do mesmo, e
              era esta a porta que faltava. */}
          <button
            type="button"
            onClick={async () => {
              aoFecharMenu()
              try {
                await admin.duplicarCartao(cartao.id)
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Não foi possível duplicar.')
              }
              await aoMudar()
            }}
          >
            ⧉ Duplicar
          </button>
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
        {/* SÓ DIZ DO ÁUDIO QUANDO HÁ ÁUDIO.
            Dizia "Sem áudio" nas publicações que não têm, e no Produto Vivo
            isso é ruído: uma publicação só com a foto é uma foto, e não uma
            publicação a que falta qualquer coisa. Ele pediu-o em 29/08 com
            estas palavras: "não precisa aparecer foto sem áudio nem qualquer
            aviso semelhante. É simplesmente uma foto." */}
        {cartao.audio && <span className="linha-audio-raiz">▶ {cartao.audio.title}</span>}
        <span className="estado-quadrado">
          {cartao.estado === 'PUBLICADO' ? 'PRONTO' : 'RASCUNHO'}
        </span>
      </button>
    </div>
  )
}
