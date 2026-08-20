/**
 * Os quatro indicadores do cartão, desenhados e coloridos.
 *
 * Emoji não servem aqui. Ele pediu ícones coloridos e fortes, e o emoji é
 * desenhado pelo sistema: no telemóvel dele sai a cores, noutro sai a preto e
 * branco, e num terceiro sai com outra forma. Desenhados, são iguais em toda a
 * parte e a cor é a que ele escolheu.
 *
 * Cada acção tem a sua cor fixa em toda a plataforma — azul para ver, vermelho
 * para curtir, verde para comentar, roxo para partilhar. É o que deixa uma
 * criança reconhecer o botão sem ler.
 */
const caixa = { width: 34, height: 34, viewBox: '0 0 24 24', 'aria-hidden': true } as const

export function OlhoGrande() {
  return (
    <svg {...caixa} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" fill="#2563eb" stroke="none" />
    </svg>
  )
}

export function CoracaoGrande({ cheio = false }: { cheio?: boolean }) {
  return (
    <svg {...caixa} fill={cheio ? '#ef4444' : 'none'} stroke="#ef4444" strokeWidth={2} strokeLinejoin="round">
      <path d="M12 20.5s-7.6-4.7-7.6-9.9A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.6 3c0 5.2-7.6 9.9-7.6 9.9Z" />
    </svg>
  )
}

export function BalaoGrande() {
  return (
    <svg {...caixa} fill="none" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 12.2a7.9 7.9 0 0 1-11.5 7L3.5 21l1.6-5A7.9 7.9 0 1 1 20.5 12.2Z" />
    </svg>
  )
}

export function SetaGrande() {
  return (
    <svg {...caixa} fill="none" stroke="#a855f7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 15.5c1.2-5.4 5.2-8 11-8V4l6.5 6-6.5 6v-3.6c-4.6 0-8.2 1-11 3.1Z" fill="#a855f7" />
    </svg>
  )
}
