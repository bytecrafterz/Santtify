import type { ReactNode } from 'react'

export type NomeDoIconeDoPainel =
  // As oito áreas do menu, e o sair
  | 'pasta'
  | 'carrinho'
  | 'afiliados'
  | 'conteudo'
  | 'comunidade'
  | 'mensagens'
  | 'analise'
  | 'configuracoes'
  | 'sair'
  // O topo e os cartões de projeto
  | 'sino'
  | 'mais'
  | 'buscar'
  | 'tres-pontos'
  | 'seta'
  | 'voltar'
  | 'site'
  | 'imagem'
  // As ferramentas de um projeto
  | 'sequencia'
  | 'cartoes'
  | 'karaoke'
  | 'categorias'
  | 'produto-vivo'
  | 'carrossel'

const TRACOS: Record<NomeDoIconeDoPainel, ReactNode> = {
  pasta: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  carrinho: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.5-6.8H6.2" />
    </>
  ),
  afiliados: (
    <>
      <circle cx="12" cy="7.5" r="3.2" />
      <path d="M5.5 20c.9-3.7 3.4-5.7 6.5-5.7s5.6 2 6.5 5.7" />
      <circle cx="4.8" cy="10.2" r="2.1" />
      <circle cx="19.2" cy="10.2" r="2.1" />
    </>
  ),
  conteudo: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  comunidade: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.9-3.6 3.4-5.5 6.5-5.5s5.6 1.9 6.5 5.5" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M16.5 14.6c2.5.2 4.3 1.9 5 4.9" />
    </>
  ),
  mensagens: (
    <>
      <path d="M4.5 18.5V7a2.5 2.5 0 0 1 2.5-2.5h10A2.5 2.5 0 0 1 19.5 7v7a2.5 2.5 0 0 1-2.5 2.5H8z" />
      <path d="M8.5 9.5h7M8.5 12.5h4.5" />
    </>
  ),
  analise: <path d="M4 20V13M10 20V8M16 20V4M2.5 20.5h19" />,
  configuracoes: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
    </>
  ),
  sair: (
    <>
      <path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5" />
      <path d="m15 16.5 4.5-4.5L15 7.5M19.5 12H9.5" />
    </>
  ),
  sino: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  'tres-pontos': (
    <>
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  voltar: <path d="M19 12H5M11 6l-6 6 6 6" />,
  site: <path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />,
  imagem: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m4.5 18 5-5 3.5 3.5 2.5-2.5 4 4" />
    </>
  ),
  sequencia: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </>
  ),
  cartoes: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.8 16.5c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13.5h3.5" />
    </>
  ),
  karaoke: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  categorias: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.2 6.2a1.4 1.4 0 0 1-2 0z" />
      <circle cx="8.2" cy="8.2" r="1.5" />
    </>
  ),
  'produto-vivo': <path d="M12 3.5 13.8 9l5.7.2-4.5 3.5 1.6 5.5L12 15l-4.6 3.2L9 12.7 4.5 9.2l5.7-.2z" />,
  carrossel: (
    <>
      <rect x="6" y="5" width="12" height="14" rx="2" />
      <path d="M3 7.5v9M21 7.5v9" />
      <path d="m8.5 15 2.5-3 2 2.2 1.5-1.7 1.5 2.5" />
    </>
  ),
}

/** Os ícones do painel, em traço: tomam a cor do texto à volta. */
export function IconeDoPainel({ nome, tamanho = 22 }: { nome: NomeDoIconeDoPainel; tamanho?: number }) {
  return (
    <svg
      className="adm-icone"
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRACOS[nome]}
    </svg>
  )
}
