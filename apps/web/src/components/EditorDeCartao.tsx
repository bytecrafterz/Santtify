'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useEffect } from 'react'
import { admin, type CartaoAdmin, type CategoriaAdmin } from '@/lib/admin'

/**
 * A terceira tela: o cartão, inteiro, numa página só.
 *
 * A ordem dos campos é a da página pública, e isso é deliberado — foto, áudio,
 * interações, título, descrição. Quem preenche vê o que a criança vai ver, pela
 * mesma ordem, e não uma lista de campos que só depois se descobre como fica.
 *
 * O QUE FALTA ESTÁ SEMPRE À VISTA. Enquanto faltar imagem, som, título ou
 * descrição, o cartão é rascunho e a tira em baixo diz exactamente o que falta.
 * Não há botão de publicar activo com um cartão pela metade, porque publicar
 * meio cartão foi precisamente o que este trabalho todo veio impedir.
 *
 * Os indicadores aparecem apagados e não se tocam: estão aqui porque fazem
 * parte da peça e ele quis vê-los no lugar. Os números são de quem visita.
 */
/**
 * UMA CHAVE POR CARTÃO, e sem ela isto corrompia conteúdo.
 *
 * Quem monta este editor tem de lhe passar `key={cartao.id}`. Sem isso, o
 * React reaproveita a mesma instância quando se passa de um cartão para outro
 * — e um `useState(cartao.titulo)` só lê a propriedade na PRIMEIRA montagem.
 *
 * O que acontecia: ele abria o cartão da Música, voltava, abria o da
 * Memorização, e via o título e o texto da Música. Se guardasse, escrevia o
 * conteúdo de um cartão dentro do outro. Ele descreveu-o em 25/08 — "está
 * puxando conteúdo de outra publicação" — e o problema era pior do que se via:
 * não era só mostrar mal, era gravar mal.
 */
export function EditorDeCartao({
  cartao,
  projectSlug,
  aoGuardar,
  aoMudar,
  aoCancelar,
  somOpcional = false,
}: {
  cartao: CartaoAdmin
  projectSlug: string
  aoGuardar: () => Promise<void>
  /**
   * Actualiza a lista de trás SEM fechar o editor.
   *
   * `aoGuardar` fecha, e é o que se quer ao gravar. Apagar a foto é outra
   * coisa: quem apaga a foto vai a seguir apagar o áudio, e fechar o editor
   * no meio obrigava a reabrir o cartão para cada peça.
   */
  aoMudar?: () => Promise<void>
  aoCancelar: () => void
  /**
   * O áudio deixa de ser obrigatório para o cartão ficar inteiro.
   *
   * É o caso do Produto Vivo, e vem do pedido dele de 28/08: várias imagens
   * primeiro, e só a última com áudio ou vídeo. Com o áudio obrigatório, as
   * imagens que ele quer à frente ficavam todas com o cadeado em PUBLICAR e a
   * dizer "falta o áudio" — ele acrescentava cinco imagens, via cinco
   * cadeados, e concluía que a função não tinha sido feita.
   *
   * Nas letras continua obrigatório. Ali um cartão é imagem, áudio, título e
   * descrição numa peça só, e foi esse o trabalho de 23/08: impedir que meio
   * cartão fosse para o ar. Não é a mesma coisa e não leva a mesma regra.
   */
  somOpcional?: boolean
}) {
  const [titulo, definirTitulo] = useState(cartao.titulo ?? '')
  const [descricao, definirDescricao] = useState(cartao.descricao ?? '')
  const [link, definirLink] = useState(cartao.linkUpgrade ?? '')
  const [imagem, definirImagem] = useState(cartao.imagem)
  const [audio, definirAudio] = useState(cartao.audio)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [categorias, definirCategorias] = useState<CategoriaAdmin[]>([])
  const [categoriaId, definirCategoriaId] = useState(cartao.categoriaId ?? '')

  // As categorias que ele criou no painel. É esta lista que alimenta o filtro
  // do tocador na página, e é por isso que ela está aqui: ele definia a
  // categoria noutro sítio e não percebia porque não aparecia no filtro.
  useEffect(() => {
    void admin
      .categorias(projectSlug)
      .then((r) => definirCategorias(r.categorias))
      .catch(() => {})
  }, [projectSlug])

  /*
    A MESMA RÉGUA DO SERVIDOR, e tem de continuar a ser.

    Isto é a cópia no navegador de `apps/api/src/content/cartao-inteiro.ts`, que
    é quem decide de verdade. Em 28/08 mudei esta e não mudei aquela: o PUBLICAR
    acendeu, ele carregava, e o servidor punha o cartão de volta em rascunho sem
    dizer nada. Quem mexer numa TEM de mexer na outra.

    Existe aqui apenas para o botão poder estar apagado antes de haver pedido
    nenhum. Não é a autoridade; a autoridade está no servidor.
  */
  const falta = [
    !imagem && 'a foto',
    !somOpcional && !audio && 'o áudio',
    !titulo.trim() && 'o título',
    !descricao.trim() && 'a descrição',
  ].filter(Boolean) as string[]

  /**
   * A FOTO APARECE NO INSTANTE EM QUE É ESCOLHIDA, antes de subir.
   *
   * Pergunta dele, em 24/08, e é a pergunta certa: "como vou saber se escolhi a
   * foto certa ou se o upload funcionou?". Não sabia. O envio podia demorar
   * segundos numa rede de telemóvel, e durante esse tempo o quadrado ficava
   * igual ao que estava antes de tocar.
   *
   * O navegador consegue mostrar o ficheiro que está no aparelho sem o enviar
   * a lado nenhum. Mostra-se esse imediatamente, e troca-se pelo do servidor
   * quando ele chegar. Se o envio falhar, a pré-visualização recua — mostrar
   * uma foto que não ficou guardada seria pior do que não mostrar nenhuma.
   */
  async function enviarFoto(arquivo: File) {
    const anterior = imagem
    const local = URL.createObjectURL(arquivo)
    definirImagem(local)
    definirOcupado('foto')
    definirErro(null)
    try {
      const r = await admin.porFotoNoCartao(cartao.id, arquivo)
      definirImagem(r.imagem ?? local)
    } catch {
      definirImagem(anterior)
      definirErro('Não foi possível enviar a foto. Tente outra vez.')
    } finally {
      // O endereço local ocupa memória até ser libertado, e quem preenche 26
      // letras troca dezenas de fotografias sem fechar a página.
      URL.revokeObjectURL(local)
      definirOcupado(null)
    }
  }

  async function enviarAudio(arquivo: File) {
    definirOcupado('audio')
    definirErro(null)
    try {
      const r = await admin.porAudioNoCartao(cartao.id, arquivo)
      // Se o servidor não devolver o áudio resolvido, fica ao menos o nome do
      // ficheiro que ela escolheu: é o suficiente para reconhecer o engano.
      definirAudio(r.audio ?? { id: '', url: '', title: arquivo.name, durationMs: null })
    } catch {
      definirErro('Não foi possível enviar o áudio. Tente outra vez.')
    } finally {
      definirOcupado(null)
    }
  }

  /**
   * APAGAR A FOTO OU O SOM, UM DE CADA VEZ.
   *
   * Pedido dele em 05/09, e o problema que descreve é real: "coloquei uma foto
   * genérica, um áudio genérico e um texto qualquer; agora quero retirar esse
   * conteúdo de teste, mas não consigo apagar individualmente a foto e o
   * áudio". Trocar sempre foi possível; tirar não era. Quem punha uma foto por
   * engano ficava com ela para sempre, ou apagava o cartão inteiro.
   *
   * APAGA JÁ, sem esperar pelo SALVAR. É uma remoção, e uma remoção que fica à
   * espera de outro botão é a maneira mais fácil de alguém sair da página a
   * pensar que apagou. É também o que faz o pedido dele seguinte acontecer:
   * "depois de excluir, aquela foto também deve desaparecer imediatamente da
   * página pública" — quem trata disso é o `chamar`, que manda o site esquecer
   * o que tinha guardado a cada escrita do painel.
   *
   * O CARTÃO NÃO SAI DA PÁGINA POR PERDER UMA PEÇA, e é isso que ele quer:
   * "não quero ter que tirar o cartão inteiro do ar simplesmente porque preciso
   * remover ou substituir uma foto". É também a regra dele de 23/08, escrita ao
   * contrário do que eu li da primeira vez: "se eu colocar somente o áudio, o
   * espaço da imagem continuará visível". O que fica indivisível é a estrutura,
   * não o momento. No painel volta a rascunho e o PUBLICAR fica trancado até
   * estar completo — na página, o lugar da foto fica vazio e o resto continua.
   *
   * SÓ SE FOR A ÚLTIMA PEÇA é que o cartão desaparece, porque deixa de haver o
   * que mostrar. É o único caso que vale a pena avisar antes, e o aviso diz
   * exactamente isso em vez de prometer o que não acontece.
   */
  async function apagarPeca(qual: 'foto' | 'audio') {
    const nome = qual === 'foto' ? 'a foto' : 'o áudio'
    /* A mesma conta que o servidor faz para decidir se ainda há cartão para
       desenhar: sobra alguma coisa, foto ou som? */
    const ficaVazio = qual === 'foto' ? !audio : !imagem
    const aviso = ficaVazio
      ? `Apagar ${nome}? Sem foto nem áudio, o cartão deixa de aparecer na página.`
      : `Apagar ${nome}? Some já da página; o resto do cartão fica.`
    if (!window.confirm(aviso)) return

    definirOcupado(qual)
    definirErro(null)
    try {
      await admin.salvarCartao(
        cartao.id,
        qual === 'foto' ? { imageAssetId: null } : { assetId: null },
      )
      if (qual === 'foto') definirImagem(null)
      else definirAudio(null)
      await aoMudar?.()
    } catch {
      definirErro(`Não foi possível apagar ${nome}. Tente outra vez.`)
    } finally {
      definirOcupado(null)
    }
  }

  async function guardar() {
    definirOcupado('guardar')
    definirErro(null)
    try {
      await admin.salvarCartao(cartao.id, { titulo, descricao, linkUpgrade: link })
      await aoGuardar()
    } catch {
      definirErro('Não foi possível guardar.')
      definirOcupado(null)
    }
  }

  return (
    <div className="editor-cartao">
      <div className="topo-editor">
        <button type="button" className="voltar-sequencia" onClick={aoCancelar}>
          ← Quadrados
        </button>
        <span className="etiqueta-interna">{(cartao.nomeInterno ?? 'Cartão').toUpperCase()}</span>
      </div>

      {/* A peça, pela ordem em que a criança a vai ver. */}
      <article className="previa-cartao">
        <label className="area-foto">
          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagem} alt="" />
          ) : (
            <span className="vazio-foto">
              <span aria-hidden>🖼</span>
              FOTO
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void enviarFoto(f)
            }}
          />
          <span className="acao-area">
            {ocupado === 'foto' ? 'A enviar...' : 'Tocar para trocar'}
          </span>
        </label>

        {/*
          A BARRA DO SOM DIZ QUE SE PODE TOCAR NELA, como a foto sempre disse.

          A foto tinha o rótulo "Tocar para trocar" no canto; a barra do som não
          tinha nada. Com um ficheiro lá dentro, mostrava só o nome, e nada na
          tela dizia que aquela barra se abria. Ele apanhou-o em 05/09, e a frase
          é exacta: "consigo retirar o áudio que já estava publicado, mas depois
          não consigo substituí-lo por outro".

          Também sai o ▶ quando não há som. Ao lado de um botão de tocar, o
          "Tocar para escolher o áudio" lê-se como REPRODUZIR e não como TOCAR
          COM O DEDO, que é a palavra a fazer dois trabalhos na mesma frase. Sem
          som, o sinal é um + e a acção está escrita por extenso.
        */}
        <label className="area-audio">
          <span className="play" aria-hidden>
            {audio ? '▶' : '+'}
          </span>
          <span className="faixa-audio">
            {ocupado === 'audio' ? 'A enviar...' : (audio?.title ?? 'ADICIONAR ÁUDIO')}
          </span>
          <span className="acao-area acao-audio">
            {audio ? 'Tocar para trocar' : 'Tocar para escolher'}
          </span>
          {/* Sem `accept` a filtrar tipos: o iPhone entrega ficheiros com o
              tipo em branco e a filtragem deixava o áudio a cinzento, sem
              explicação nenhuma. Foi o que ele apanhou em 21/08. */}
          <input
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void enviarAudio(f)
            }}
          />
        </label>

        {/* FORA DAS ETIQUETAS. Um botão dentro do `<label>` da foto abre o
            selector de ficheiros ao ser carregado, e apagar passaria a ser
            trocar. Ficam numa fila própria, por baixo, e só aparecem quando há
            alguma coisa para apagar. */}
        {(imagem || audio) && (
          <div className="remover-pecas">
            {imagem && (
              <button
                type="button"
                onClick={() => void apagarPeca('foto')}
                disabled={ocupado !== null}
              >
                Excluir foto
              </button>
            )}
            {audio && (
              <button
                type="button"
                onClick={() => void apagarPeca('audio')}
                disabled={ocupado !== null}
              >
                Excluir áudio
              </button>
            )}
            {/* Na mesma fila das peças, e não dentro do cartão: o cartão do
                painel é igual ao público e não ganha botões que lá não há. */}
            {audio?.url && (
              <Link className="atalho-karaoke" href={`/${projectSlug}/admin/karaoke/${cartao.id}`}>
                🎤 Karaokê
              </Link>
            )}
          </div>
        )}

        <div className="indicadores-apagados" aria-hidden>
          <span>👁 0</span>
          <span>♡ 0</span>
          <span>💬 0</span>
          <span>↗ 0</span>
        </div>

        <input
          className="campo-titulo"
          value={titulo}
          onChange={(e) => definirTitulo(e.target.value)}
          placeholder="TÍTULO"
          maxLength={120}
        />
        <textarea
          className="campo-descricao"
          value={descricao}
          onChange={(e) => definirDescricao(e.target.value)}
          placeholder="DESCRIÇÃO"
          rows={4}
          maxLength={4000}
        />

        {/* A CATEGORIA VIVE AQUI, no cartão, e não noutra tela.
            Ele definiu "Música Alegre" e perguntou porque não aparecia no
            filtro do tocador. A categoria estava noutro sítio do painel e o
            filtro nunca a leu — era uma lista de cinco nomes escrita no código.
            Agora escolhe-se aqui e aparece lá. */}
        <label className="campo-upgrade">
          <span>Categoria (aparece no filtro do tocador)</span>
          <select
            value={categoriaId}
            onChange={async (e) => {
              const v = e.target.value
              definirCategoriaId(v)
              try {
                await admin.classificarBloco(cartao.id, v || null)
              } catch {
                definirErro('Não foi possível guardar a categoria.')
              }
            }}
          >
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="campo-upgrade">
          <span>Link de venda (Hotmart, Kiwify ou outro)</span>
          <input
            value={link}
            onChange={(e) => definirLink(e.target.value)}
            placeholder="https://..."
            inputMode="url"
          />
        </label>
      </article>

      {erro && <p className="erro">{erro}</p>}

      <div className="acoes-cartao">
        <button
          type="button"
          className="botao-acao largo"
          onClick={() => void guardar()}
          disabled={ocupado !== null}
        >
          {ocupado === 'guardar' ? 'A guardar...' : 'SALVAR'}
        </button>

        {/* PUBLICAR só acende quando o cartão está inteiro.
            Não é um segundo botão de guardar: é o mesmo gesto com outro nome, e
            o nome muda porque o resultado muda. Guardar um cartão a meio deixa-o
            em rascunho e ninguém o vê; guardar um cartão inteiro põe-no na
            página. Ter os dois nomes à vista, com um deles apagado, diz onde a
            pessoa está sem ela ter de ler nada. */}
        <button
          type="button"
          className="botao-publicar"
          onClick={() => void guardar()}
          disabled={ocupado !== null || falta.length > 0}
          title={falta.length ? `Falta ${falta.join(', ')}` : 'Publicar este cartão'}
        >
          {falta.length > 0 && (
            <span aria-hidden className="cadeado">
              🔒
            </span>
          )}
          PUBLICAR
        </button>
      </div>

      {/* A tira diz o que falta, com os nomes das coisas. "Complete o cartão"
          sozinho obriga a adivinhar qual das quatro coisas é que falta. */}
      <p className={falta.length ? 'tira-estado rascunho' : 'tira-estado pronto'}>
        {falta.length ? (
          <>RASCUNHO — falta {falta.join(', ').replace(/, ([^,]*)$/, ' e $1')}</>
        ) : (
          <>PRONTO — este cartão aparece na página assim que guardar</>
        )}
      </p>
    </div>
  )
}
