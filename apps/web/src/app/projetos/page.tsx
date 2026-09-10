import Link from 'next/link'
import type { Metadata } from 'next'
import { abreviarKM } from '@pv/cartoes'
import { projetosDoCarrossel } from '@/lib/carrossel'

export const metadata: Metadata = {
  title: 'Projetos · Santtify',
  description: 'Todos os projetos da Santtify.',
}

/**
 * O "Ver todos" do carrossel.
 *
 * O carrossel mostra dois de cada vez e deixa deslizar; esta página mostra a
 * lista inteira de uma vez, que é o que se quer quando já são muitos. É a mesma
 * consulta — um projeto novo aparece aqui e lá sem tocar em nada.
 */
export default async function PaginaDeProjetos() {
  const projetos = await projetosDoCarrossel()

  return (
    <main className="envoltorio">
      <h1>Projetos</h1>
      <p className="subtitulo">Toque num projeto para entrar.</p>

      {projetos.length === 0 ? (
        <p className="subtitulo">Ainda não há projetos publicados.</p>
      ) : (
        <ul className="lista-de-projetos">
          {projetos.map((p) => (
            <li key={p.slug}>
              <Link href={`/${p.slug}`} className="projeto-em-linha">
                <span className="projeto-em-linha-capa">
                  {p.capa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.capa} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">
                      {p.nome
                        .split(/\s+/)
                        .filter((x) => x.length > 2)
                        .slice(0, 2)
                        .map((x) => x[0]?.toUpperCase() ?? '')
                        .join('')}
                    </span>
                  )}
                </span>
                <span className="projeto-em-linha-corpo">
                  <strong>{p.nome}</strong>
                  {p.tagline && <span>{p.tagline}</span>}
                  <span className="projeto-em-linha-numeros">
                    👁 {abreviarKM(p.numeros.views)} · ♡ {abreviarKM(p.numeros.likes)} · 💬{' '}
                    {abreviarKM(p.numeros.comments)} · ↗ {abreviarKM(p.numeros.shares)}
                  </span>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
