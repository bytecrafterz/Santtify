'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Quem já se registou, com nome, fotografia e caminho para o perfil.
 *
 * Ele pediu-a em 25/08: tocar em "perfis criados" e ver quem são. Faz sentido —
 * um número sem ninguém por trás não diz nada a quem chega, e é justamente a
 * confiança que uma comunidade infantil tem de mostrar.
 *
 * SÓ O QUE É PÚBLICO: nome, fotografia e data de entrada. Nada de e-mail. Quem
 * se regista numa plataforma para crianças não está a autorizar que o examinem,
 * e o endereço de um menor não entra numa lista aberta.
 *
 * Quem não tem fotografia aparece com a inicial e a nota de que falta. Não é
 * castigo: é a lista onde ele vai ver quem ainda precisa de regularizar, e é aí
 * que a regra de nome verdadeiro e foto real se torna visível em vez de ficar
 * escrita num aviso que ninguém relê.
 */
interface Pessoa {
  id: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
}

export function ListaDePessoas({
  projectSlug,
  aoFechar,
}: {
  projectSlug: string
  aoFechar: () => void
}) {
  const [pessoas, definirPessoas] = useState<Pessoa[]>([])
  const [carregando, definirCarregando] = useState(true)
  const [busca, definirBusca] = useState('')

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/projects/${projectSlug}/people`)
      .then((r) => (r.ok ? r.json() : { pessoas: [] }))
      .then((d) => definirPessoas(d.pessoas ?? []))
      .catch(() => {})
      .finally(() => definirCarregando(false))
  }, [projectSlug])

  const filtradas = busca.trim()
    ? pessoas.filter((p) => p.displayName.toLowerCase().includes(busca.trim().toLowerCase()))
    : pessoas

  return (
    <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Pessoas registadas">
      <button type="button" className="fundo-clicavel" aria-label="Fechar" onClick={aoFechar} />
      <div className="folha-pessoas">
        <header>
          <h2>Pessoas na comunidade</h2>
          <button type="button" className="fechar-x" aria-label="Fechar" onClick={aoFechar}>
            ✕
          </button>
        </header>

        {pessoas.length > 6 && (
          <input
            className="busca-pessoas"
            type="search"
            placeholder="Procurar por nome"
            value={busca}
            onChange={(e) => definirBusca(e.target.value)}
          />
        )}

        {carregando && <p className="nota">A carregar...</p>}
        {!carregando && filtradas.length === 0 && <p className="nota">Ninguém encontrado.</p>}

        <ul className="lista-pessoas">
          {filtradas.map((p) => (
            <li key={p.id}>
              <Link href={`/${projectSlug}/pessoa/${p.id}`} onClick={aoFechar}>
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" />
                ) : (
                  <span className="inicial" aria-hidden>
                    {p.displayName.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="quem">
                  <strong>{p.displayName}</strong>
                  <small>
                    {p.avatarUrl
                      ? `desde ${new Date(p.createdAt).toLocaleDateString('pt-PT')}`
                      : 'ainda sem fotografia'}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
