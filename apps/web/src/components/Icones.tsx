/**
 * Os quatro ícones dos indicadores, desenhados e não emoji.
 *
 * O cliente reparou em 20/08 que o olho destoava dos outros três: era um emoji
 * do sistema, e emoji muda de forma, de cor e de peso conforme o telemóvel.
 * Ao lado de três símbolos desenhados, um emoji parece sempre colado à pressa.
 *
 * Todos partilham o mesmo traço e a mesma caixa de 24, para assentarem
 * exactamente igual dentro do círculo do trilho.
 */
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconeOlho() {
  return (
    <svg {...base}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}

export function IconeCoracao({ cheio = false }: { cheio?: boolean }) {
  return (
    <svg {...base} fill={cheio ? 'currentColor' : 'none'}>
      <path d="M12 20s-7.2-4.4-7.2-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.2 2.7C19.2 15.6 12 20 12 20Z" />
    </svg>
  )
}

export function IconeComentario() {
  return (
    <svg {...base}>
      <path d="M20 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5Z" />
    </svg>
  )
}

export function IconePartilhar() {
  return (
    <svg {...base}>
      <path d="M4 12v6.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V12" />
      <path d="M12 15V4" />
      <path d="m8 7.5 4-3.5 4 3.5" />
    </svg>
  )
}
