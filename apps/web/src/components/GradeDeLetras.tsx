import Link from 'next/link'
import type { ItemIndice, ProgressoDasLetras } from '@/lib/api'

/**
 * "Escolha uma letra": as 26 letras, as abertas e as trancadas.
 *
 * As trancadas ficam à vista de propósito, como o cliente pediu em 19/08.
 * Uma grade que só mostra o que já existe não conta a história do produto;
 * uma grade com vinte e cinco cadeados diz, sem uma palavra, que há muito
 * mais a caminho — e é o cadeado que faz a criança voltar para ver se abriu.
 *
 * A letra é extraída do título e não do slug porque o slug é técnico e o
 * título é o que o cliente escreve no painel.
 */
export function GradeDeLetras({
  projectSlug,
  contents,
  progresso,
}: {
  projectSlug: string
  contents: ItemIndice[]
  progresso: ProgressoDasLetras
}) {
  const porcento = progresso.total ? (progresso.liberadas / progresso.total) * 100 : 0

  return (
    <>
      <h2>Escolha uma letra</h2>
      <p className="subtitulo">Aprenda com fé, saúde, música e diversão</p>

      <div className="progresso-letras">
        <strong>
          {progresso.liberadas} de {progresso.total}
        </strong>
        <span>{progresso.liberadas === 1 ? 'letra liberada' : 'letras liberadas'}</span>
        <span className="trilha" role="presentation">
          <span className="preenchido" style={{ width: `${porcento}%` }} />
        </span>
      </div>

      <div className="grade-letras">
        {contents.map((c) => {
          const letra = c.title.replace(/^Letra\s+/i, '').trim().charAt(0).toUpperCase()

          if (!c.publicado) {
            return (
              <div className="letra-bloco trancada" key={c.id} aria-label={`${c.title}, ainda bloqueada`}>
                {letra}
                <span className="cadeado" aria-hidden>
                  🔒
                </span>
              </div>
            )
          }

          return (
            <Link className="letra-bloco" href={`/${projectSlug}/${c.slug}`} key={c.id}>
              {c.coverUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.coverUrl} alt={c.title} />
                  <span className="nome-curto">{c.subtitle ?? c.title}</span>
                </>
              ) : (
                letra
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
