'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Bloco } from '@/lib/api'
import { TocadorDeOnda } from './TocadorDeOnda'
import { IndicadoresDaPublicacao, type AlvoSocial } from './IndicadoresDaPublicacao'

/**
 * UMA publicação da letra: foto, áudio, interações, título e texto.
 *
 * É o padrão que ele fixou em 23/08 e mandou como obrigatório. A Letra A deixa
 * de ser um cartão com quatro áudios empilhados por baixo de uma imagem só, e
 * passa a ser cinco publicações independentes — principal, música, explicação,
 * oração e memorização — cada uma com a sua foto, o seu áudio, os seus números,
 * o seu título e o seu texto.
 *
 * A FOTO E O ÁUDIO SÃO UMA PEÇA SÓ, e isso é literal: o tocador encosta ao
 * fundo da imagem, com a mesma largura e sem folga nenhuma entre os dois. Ele
 * escreveu-o em maiúsculas, e tem razão prática — separados, a pessoa lê duas
 * coisas ao lado uma da outra e pergunta-se de qual é o áudio. Colados, são um
 * conteúdo só e não há o que perguntar.
 *
 * A etiqueta (MÚSICA, ORAÇÃO, MEMORIZAÇÃO) vai ACIMA da foto, e não dentro do
 * tocador. Dentro, competia com o tempo e com a onda; acima, é a primeira coisa
 * que se lê e diz logo o que vem a seguir.
 */
export function PublicacaoDaLetra({
  etiqueta,
  imagem,
  bloco,
  titulo,
  texto,
  alvo,
  projectId,
  contentId,
  projectSlug,
  ligacao,
  ancora,
  aoTerminarAudio,
}: {
  etiqueta: string | null
  imagem: string | null
  bloco: Bloco | null
  titulo: string
  texto: string | null
  alvo: AlvoSocial
  projectId: string
  /** A letra a que esta publicação pertence — a contagem de escutas é dela. */
  contentId: string
  projectSlug: string
  ligacao: string
  ancora: string
  aoTerminarAudio?: () => void
}) {
  const [expandido, definirExpandido] = useState(false)
  const precisaVerMais = Boolean(texto && texto.length > 150)

  return (
    <article className="publicacao" id={ancora}>
      {etiqueta && <p className="etiqueta-publicacao">{etiqueta}</p>}

      <div className="peca-visual">
        {imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="foto-publicacao" src={imagem} alt={titulo} />
        ) : (
          /* O LUGAR DA FOTO FICA, mesmo sem foto. Palavras dele, 23/08: "se eu
             colocar somente o áudio, o espaço da imagem continuará visível".
             É o que torna o cartão uma peça e não um conjunto de coisas que
             aparecem quando calha. */
          <div className="lugar-da-foto" aria-hidden>
            {/* Um símbolo, e não texto. O lugar reservado é visto por quem
                visita, e não só por quem publica — escrever ali "falta a foto"
                seria mostrar a nossa lista de tarefas a uma criança. Um
                rectângulo cinzento e vazio lê-se como avaria; com o símbolo,
                lê-se como imagem a caminho, e isso é verdade. */}
            <svg
              viewBox="0 0 24 24"
              width="56"
              height="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="m4 17 4.5-4.5 3.5 3.5 3-2.5L20 17" />
            </svg>
          </div>
        )}
        {bloco && (
          <TocadorDeOnda
            bloco={bloco}
            projectId={projectId}
            contentId={contentId}
            rotulo={null}
            aoTerminar={aoTerminarAudio}
          />
        )}
      </div>

      <IndicadoresDaPublicacao
        alvo={alvo}
        projectId={projectId}
        projectSlug={projectSlug}
        titulo={titulo}
        ligacao={ligacao}
      />

      <h3 className="titulo-publicacao">{titulo}</h3>

      {texto && (
        <p className={expandido ? 'texto-publicacao' : 'texto-publicacao cortado'}>{texto}</p>
      )}
      {precisaVerMais && !expandido && (
        <button type="button" className="ver-mais" onClick={() => definirExpandido(true)}>
          ver mais
        </button>
      )}

      <Link className="selo-pv-rodape" href={`/${projectSlug}/produto-vivo`}>
        <span className="marca-pv" aria-hidden>
          PV
        </span>
        Produto Vivo
      </Link>
    </article>
  )
}
