/**
 * O fundo do desenho que ele mandou: manchas pastel, um coração, uma estrela e
 * uns brilhos.
 *
 * É SVG dentro do código, e não uma imagem, por três razões práticas. Não pede
 * nenhum ficheiro que ele ainda não me enviou. Não pesa no primeiro
 * carregamento, que é feito por telemóvel de criança em rede de casa. E acima
 * de tudo é o mesmo desenho na tela de fundo e dentro da folha de instalação:
 * se fosse imagem, teria de a recortar duas vezes e as duas metades acabariam
 * por deixar de combinar na primeira alteração.
 *
 * Fica atrás de tudo e não recebe toque nenhum.
 */
export function DecoracaoPastel({
  variante = "fundo",
}: {
  variante?: "fundo" | "folha";
}) {
  return (
    <svg
      className={`decoracao-pastel ${variante}`}
      viewBox="0 0 390 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      {/* Manchas. Ficam nos cantos porque o meio da tela é onde vai estar o
          texto, e um fundo que passa por trás de letras deixa de ser fundo. */}
      <ellipse cx="72" cy="34" rx="96" ry="52" fill="#cfe0f5" opacity="0.75" />
      <ellipse cx="316" cy="18" rx="88" ry="46" fill="#f7d9e3" opacity="0.8" />
      <ellipse cx="20" cy="452" rx="86" ry="58" fill="#fde8c8" opacity="0.85" />
      <ellipse cx="352" cy="470" rx="92" ry="56" fill="#d7edd5" opacity="0.8" />
      <ellipse
        cx="196"
        cy="500"
        rx="120"
        ry="44"
        fill="#e8dcf3"
        opacity="0.6"
      />

      {/* Coração à esquerda e estrela à direita, como no desenho. */}
      <path
        d="M46 118c0-9 7-16 16-16 6 0 11 3 14 8 3-5 8-8 14-8 9 0 16 7 16 16 0 17-21 29-30 36-9-7-30-19-30-36z"
        fill="#d64545"
      />
      <path
        d="M330 96l7 15 16 2-12 12 3 16-14-8-14 8 3-16-12-12 16-2z"
        fill="#3b7dd8"
      />

      {/* Brilhos de quatro pontas. */}
      <path d="M108 78l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="#f0b429" />
      <path d="M286 150l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f0b429" />
      <circle cx="72" cy="168" r="5" fill="#9fc3e8" />
      <circle cx="318" cy="200" r="4" fill="#e9b8c9" />
    </svg>
  );
}
