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
export function DecoracaoPastel({
  variante = "fundo",
}: {
  variante?: "fundo" | "folha";
}) {
  const folha = variante === "folha";

  return (
    <svg
      className={`decoracao-pastel ${variante}`}
      viewBox={folha ? "0 0 390 300" : "0 0 390 844"}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      {folha ? (
        <>
          {/* Dentro da folha só entram os cantos de cima: o resto do espaço é
              todo do botão verde e do texto. */}
          <ellipse
            cx="34"
            cy="16"
            rx="82"
            ry="44"
            fill="#cfe0f5"
            opacity="0.7"
          />
          <ellipse
            cx="352"
            cy="10"
            rx="76"
            ry="40"
            fill="#f7d9e3"
            opacity="0.75"
          />
          <ellipse
            cx="14"
            cy="292"
            rx="70"
            ry="38"
            fill="#fde8c8"
            opacity="0.7"
          />
          <ellipse
            cx="376"
            cy="288"
            rx="72"
            ry="40"
            fill="#d7edd5"
            opacity="0.7"
          />
          <path
            d="M40 62c0-7 5.5-12.5 12.5-12.5 4.6 0 8.6 2.4 11 6 2.4-3.6 6.4-6 11-6C81.5 49.5 87 55 87 62c0 13-16.5 22.5-23.5 28C56.5 84.5 40 75 40 62z"
            fill="#d64545"
          />
          <path
            d="M330 46l5.5 11.5L348 59l-9 9 2.2 12.4L330 74.5 318.8 80.4 321 68l-9-9 12.5-1.5z"
            fill="#3b7dd8"
          />
          <path
            d="M104 40l3 6.5 6.5 3-6.5 3-3 6.5-3-6.5-6.5-3 6.5-3z"
            fill="#f0b429"
          />
          <path
            d="M290 112l2.4 5.2 5.2 2.4-5.2 2.4-2.4 5.2-2.4-5.2-5.2-2.4 5.2-2.4z"
            fill="#f0b429"
          />
          <circle cx="62" cy="118" r="4" fill="#9fc3e8" />
          <circle cx="322" cy="140" r="3.5" fill="#e9b8c9" />
        </>
      ) : (
        <>
          {/* Manchas nos quatro cantos. O meio da tela é onde vai estar o
              texto, e é por isso que ali não há nada. */}
          <ellipse
            cx="46"
            cy="24"
            rx="104"
            ry="58"
            fill="#cfe0f5"
            opacity="0.7"
          />
          <ellipse
            cx="348"
            cy="8"
            rx="96"
            ry="52"
            fill="#f7d9e3"
            opacity="0.75"
          />
          <ellipse
            cx="8"
            cy="800"
            rx="96"
            ry="66"
            fill="#fde8c8"
            opacity="0.75"
          />
          <ellipse
            cx="384"
            cy="820"
            rx="100"
            ry="62"
            fill="#d7edd5"
            opacity="0.7"
          />
          <ellipse
            cx="195"
            cy="856"
            rx="140"
            ry="48"
            fill="#e8dcf3"
            opacity="0.55"
          />

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
          <path
            d="M96 52l3.4 7.4 7.4 3.4-7.4 3.4L96 74l-3.4-7.8-7.4-3.4 7.4-3.4z"
            fill="#f0b429"
          />
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
  );
}
