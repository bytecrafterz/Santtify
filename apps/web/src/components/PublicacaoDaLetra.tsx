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
  categorias,
  aoTerminarAudio,
  somFazParteDaEstrutura = false,
}: {
  etiqueta: string | null
  imagem: string | null
  bloco: Bloco | null
  /**
   * O lugar do som faz parte da estrutura desta peça?
   *
   * Nas LETRAS faz: um cartão tem quatro lugares e eles existem estejam ou não
   * preenchidos, que é a regra dele de 23/08. No PRODUTO VIVO não faz: ali o
   * som é opcional desde 28/08 e uma publicação só com foto é uma foto.
   */
  somFazParteDaEstrutura?: boolean
  titulo: string
  texto: string | null
  alvo: AlvoSocial
  projectId: string
  /** A letra a que esta publicação pertence — a contagem de escutas é dela. */
  contentId: string
  projectSlug: string
  ligacao: string
  ancora: string
  /** As categorias do projeto, para o menu do tocador. */
  categorias?: Array<{ slug: string; name: string }>
  aoTerminarAudio?: () => void
}) {
  const [expandido, definirExpandido] = useState(false)
  const precisaVerMais = Boolean(texto && texto.length > 150)

  return (
    <article className="publicacao" id={ancora}>
      {etiqueta && <p className="etiqueta-publicacao">{etiqueta}</p>}

      <div className="peca-visual">
        {imagem ? (
          /*
            AS MEDIDAS VÃO NO `img`, e a moldura fica cinzenta até a foto chegar.

            Sem elas o navegador não sabe que altura guardar: desenha o tocador
            logo a seguir ao título e só empurra a página quando a imagem
            aparece. Numa rede de telemóvel são segundos a ver o áudio sem a
            foto, e foi assim que ele o descreveu em 01/09: "os áudios abriram
            sem as fotos correspondentes".

            Ele próprio disse qual era a solução certa: "se a imagem ainda
            estiver carregando, é melhor mostrar um loading do que exibir o
            áudio sozinho". O lugar fica guardado com a forma exacta da arte, e
            o que se vê enquanto ela não chega é o mesmo cinzento que já existe
            para os cartões sem foto.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="foto-publicacao"
            src={imagem}
            alt={titulo}
            width={bloco?.arteLargura ?? undefined}
            height={bloco?.arteAltura ?? undefined}
          />
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
        {/*
          O LUGAR DO SOM FICA, MESMO SEM SOM — NAS LETRAS.

          Escrevi aqui, há duas horas, que só haveria tocador onde houvesse
          ficheiro, e estava errado. Ele respondeu com a regra que já me tinha
          dado em 23/08 e que está escrita no servidor, em `content.service`:

            "Se eu colocar somente o áudio, o espaço da imagem continuará
             visível. Se ainda não houver título ou texto, os lugares deles
             permanecerão em branco dentro da mesma estrutura."

          O que é indivisível é a ESTRUTURA. Um cartão de uma letra tem quatro
          lugares e eles existem estejam ou não preenchidos. Esconder o lugar do
          som fez desaparecer parte da peça, e foi por isso que ele perguntou
          como é que um bloco fixo tinha sumido.

          O defeito verdadeiro não era o lugar existir: era ele fingir que
          tocava. Um tocador parado em 00:00 / 00:00 promete um áudio que não
          está lá. Agora o lugar continua, e diz o que é.

          NO PRODUTO VIVO NÃO. Ali o som é opcional desde 28/08, a pedido dele:
          uma publicação só com foto é uma foto, e não uma peça a que falta
          qualquer coisa. Por isso isto é uma decisão de quem monta a página, e
          não deste componente.
        */}
        {bloco?.asset?.url ? (
          <>
            <TocadorDeOnda
              bloco={bloco}
              projectId={projectId}
              contentId={contentId}
              rotulo={null}
              categorias={categorias}
              aoTerminar={aoTerminarAudio}
            />
            {/*
              O MODO KARAOKÊ ACRESCENTA-SE AO TOCADOR, NÃO O SUBSTITUI.

              Condição dele em 13/09: "continuaria existindo a experiência
              atual normalmente". O tocador fica exactamente igual; por baixo,
              na mesma faixa escura, aparece o convite — e só nas faixas em
              que ele publicou a letra sincronizada.
            */}
            {bloco.karaoke && (
              <Link className="entrar-no-karaoke" href={`/${projectSlug}/karaoke/${bloco.id}`}>
                <span className="convite-karaoke">
                  <span aria-hidden>🎤</span> Cantar no Modo Karaokê
                </span>
              </Link>
            )}
          </>
        ) : (
          somFazParteDaEstrutura && (
            <div className="lugar-do-som" role="note">
              <span aria-hidden>🎵</span>
              <span>Áudio ainda não carregado</span>
            </div>
          )
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
