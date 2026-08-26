'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { social, type PessoaQueInteragiu } from '@/lib/social'
import { abreviar } from '@/lib/numeros'

/**
 * Quem interagiu com o perfil, com cara e nome.
 *
 * O cliente pediu isto por uma razão comercial certeira: cem curtidas sem
 * ninguém a quem as associar parecem inventadas, e este projeto vive de
 * convencer famílias de que há gente do outro lado.
 *
 * Só entram aqui os actos PÚBLICOS — curtir e comentar. Quem apenas visitou
 * fica no número, sem nome. Não é limite técnico: ver uma página não é uma
 * escolha de aparecer, a política de privacidade publicada promete que a
 * visita fica anónima, e uma lista de quem andou a ver o perfil de uma criança
 * é a espécie de coisa que não se constrói.
 */
export function PainelDePessoas({
  userId,
  projectSlug,
  aoFechar,
}: {
  userId: string
  projectSlug: string
  aoFechar: () => void
}) {
  const [aba, definirAba] = useState<'curtidas' | 'comentarios'>('curtidas')
  const [busca, definirBusca] = useState('')
  const [dados, definirDados] = useState<{
    curtiram: PessoaQueInteragiu[]
    comentaram: PessoaQueInteragiu[]
    visualizacoes: number
  } | null>(null)

  useEffect(() => {
    void social
      .quemInteragiu(userId)
      .then(definirDados)
      .catch(() => definirDados(null))
  }, [userId])

  const lista = (aba === 'curtidas' ? dados?.curtiram : dados?.comentaram) ?? []
  const filtrada = busca
    ? lista.filter((p) =>
        p.displayName.toLocaleLowerCase('pt').includes(busca.toLocaleLowerCase('pt')),
      )
    : lista

  return (
    <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Quem interagiu">
      <button type="button" className="fundo-clicavel" aria-label="Fechar" onClick={aoFechar} />

      <div className="folha-comentarios">
        <button type="button" className="pega" aria-label="Fechar" onClick={aoFechar}>
          <span className="traco" aria-hidden />
        </button>

        <h2>Quem interagiu</h2>

        <div className="abas-pessoas">
          <button
            type="button"
            className={aba === 'curtidas' ? 'aba atual' : 'aba'}
            onClick={() => definirAba('curtidas')}
          >
            Curtidas {dados ? `· ${abreviar(dados.curtiram.length)}` : ''}
          </button>
          <button
            type="button"
            className={aba === 'comentarios' ? 'aba atual' : 'aba'}
            onClick={() => definirAba('comentarios')}
          >
            Comentários {dados ? `· ${abreviar(dados.comentaram.length)}` : ''}
          </button>
        </div>

        {lista.length > 6 && (
          <input
            className="busca-pessoas"
            type="search"
            placeholder="Pesquisar"
            value={busca}
            onChange={(e) => definirBusca(e.target.value)}
          />
        )}

        <ul className="lista-pessoas">
          {/*
            O nome e a cara abrem o perfil, como já abriam nos comentários.

            Aqui não abriam nada, e ele apanhou a diferença em 26/08: "nos
            comentários isso já funciona". Uma lista de pessoas em que tocar no
            nome não faz nada ensina que não há nada para ver, e o perfil das
            outras pessoas é justamente o que ele quer que se visite.
          */}
          {filtrada.map((p) => (
            <li key={p.id}>
              <Link
                className="pessoa-da-lista"
                href={`/${projectSlug}/pessoa/${p.id}`}
                onClick={aoFechar}
              >
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="avatar-comentario" src={p.avatarUrl} alt={p.displayName} />
                ) : (
                  <span className="avatar-comentario vazio" aria-hidden>
                    {p.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <strong>{p.displayName}</strong>
              </Link>
            </li>
          ))}
          {dados && filtrada.length === 0 && (
            <li className="nota">
              {busca ? 'Ninguém com esse nome.' : 'Ainda ninguém — seja a primeira pessoa.'}
            </li>
          )}
          {!dados && <li className="nota">A carregar...</li>}
        </ul>

        {dados && (
          <p className="nota rodape-pessoas">
            {abreviar(dados.visualizacoes)} {dados.visualizacoes === 1 ? 'visita' : 'visitas'} ao
            perfil. As visitas são contadas sem identificar quem as fez, como diz a política de
            privacidade.
          </p>
        )}
      </div>
    </div>
  )
}
