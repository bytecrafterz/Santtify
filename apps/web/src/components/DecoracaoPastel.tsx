/**
 * O fundo do desenho que ele mandou: manchas pastel, um coração, uma estrela e
 * uns brilhos.
 *
 * É SVG dentro do código, e não uma imagem, por três razões práticas. Não pede
 * nenhum ficheiro que ele ainda não me enviou. Não pesa no primeiro
 * carregamento, que é feito por telemóvel de criança em rede de casa. E é o
 * mesmo desenho na tela de fundo e dentro da folha de instalação: recortado em
 * duas imagens, deixaria de combinar na primeira alteração.
 *
 * A CAIXA MUDA COM O SÍTIO, e isso não é um detalhe. A primeira versão tinha
 * uma caixa só, esticada para caber; num ecrã de telemóvel, que é muito mais
 * alto do que largo, as manchas cresciam quase o dobro e o coração acabava por
 * trás da palavra "E-mail". Um fundo que passa por trás de letras deixa de ser
 * fundo. Agora a tela usa a proporção de um telemóvel e a folha usa a sua, e
 * em ambas o desenho fica pequeno e encostado às bordas.
 */
export function DecoracaoPastel({ variante = 'fundo' }: { variante?: 'fundo' | 'folha' }) {
  const folha = variante === 'folha'

  return (
    <svg
      className={`decoracao-pastel ${variante}`}
      viewBox={folha ? '0 0 390 160' : '0 0 390 844'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      {folha ? (
        <>
          {/* A FAIXA DE CIMA da folha, e só ela. O desenho vive numa caixa de
              altura fixa presa ao topo, e não esticada pela folha inteira: a
              folha cresce quando mostra o caminho manual, e a esticar com ela
              o coração acabava a meio da frase "COMO INSTALAR NESTE TELEFONE".
              Aqui o desenho fica do mesmo tamanho seja qual for a altura. */}
          <ellipse cx="30" cy="4" rx="84" ry="46" fill="#cfe0f5" opacity="0.7" />
          <ellipse cx="356" cy="0" rx="78" ry="44" fill="#f7d9e3" opacity="0.75" />
          <path
            d="M36 58c0-6.6 5.2-11.8 11.8-11.8 4.3 0 8.1 2.3 10.3 5.7 2.2-3.4 6-5.7 10.3-5.7C75 46.2 80.2 51.4 80.2 58c0 12.2-15.6 21.2-22.1 26.4C51.6 79.2 36 70.2 36 58z"
            fill="#d64545"
          />
          <path
            d="M334 44l5.2 10.9 11.8 1.4-8.5 8.5 2.1 11.8L334 71l-10.6 5.6 2.1-11.8-8.5-8.5 11.8-1.4z"
            fill="#3b7dd8"
          />
          <path d="M92 22l2.8 6.2 6.2 2.8-6.2 2.8L92 40l-2.8-6.2-6.2-2.8 6.2-2.8z" fill="#f0b429" />
          <path
            d="M296 20l2.4 5.2 5.2 2.4-5.2 2.4-2.4 5.2-2.4-5.2-5.2-2.4 5.2-2.4z"
            fill="#f0b429"
          />
          <circle cx="58" cy="24" r="4" fill="#9fc3e8" />
          <circle cx="358" cy="104" r="3.5" fill="#e9b8c9" />
        </>
      ) : (
        <>
          {/* Manchas nos quatro cantos. O meio da tela é onde vai estar o
              texto, e é por isso que ali não há nada. */}
          <ellipse cx="46" cy="24" rx="104" ry="58" fill="#cfe0f5" opacity="0.7" />
          <ellipse cx="348" cy="8" rx="96" ry="52" fill="#f7d9e3" opacity="0.75" />
          <ellipse cx="8" cy="800" rx="96" ry="66" fill="#fde8c8" opacity="0.75" />
          <ellipse cx="384" cy="820" rx="100" ry="62" fill="#d7edd5" opacity="0.7" />
          <ellipse cx="195" cy="856" rx="140" ry="48" fill="#e8dcf3" opacity="0.55" />

          {/* Coração à esquerda e estrela à direita, como no desenho, e ambos
              acima da linha onde começa o formulário. */}
          <path
            d="M22 96c0-8 6-14 14-14 5.2 0 9.7 2.7 12.4 6.8C51.1 84.7 55.6 82 60.8 82c8 0 14 6 14 14 0 14.6-18.6 25.4-26.4 31.6C40.6 121.4 22 110.6 22 96z"
            fill="#d64545"
          />
          <path
            d="M344 78l6.2 13 14 1.7-10.2 10.2 2.5 14-12.5-6.7-12.5 6.7 2.5-14L324 92.7l14-1.7z"
            fill="#3b7dd8"
          />

          {/* Brilhos de quatro pontas. */}
          <path d="M70 40l3.4 7.4 7.4 3.4-7.4 3.4L70 62l-3.4-7.8-7.4-3.4 7.4-3.4z" fill="#f0b429" />
          <path
            d="M300 156l2.6 5.6 5.6 2.6-5.6 2.6-2.6 5.6-2.6-5.6-5.6-2.6 5.6-2.6z"
            fill="#f0b429"
          />
          <circle cx="58" cy="150" r="4.5" fill="#9fc3e8" />
          <circle cx="336" cy="186" r="4" fill="#e9b8c9" />
          <circle cx="30" cy="700" r="5" fill="#c9dfc7" />
          <circle cx="356" cy="662" r="4" fill="#f2d3a8" />
        </>
      )}
    </svg>
  )
}
