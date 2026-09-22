'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { admin, type CartaoAdmin } from '@/lib/admin'

/**
 * A publicação do Produto Vivo, inteira, num ecrã só.
 *
 * ISTO SUBSTITUI UM CAMINHO, E NÃO UMA APARÊNCIA. Havia uma lista de quadrados;
 * tocava-se num, abria-se outro ecrã, editava-se ali, voltava-se. Ele descreveu-o
 * quatro vezes e da última sem rodeios: "não quero aquele caminho antigo de
 * Rascunho, abrir outra página, editar". Tinha razão, e o meu erro foi ter feito
 * a regra da ordem em 28/08 e deixado o caminho de edição como estava.
 *
 * A ESTRUTURA É A DO DESENHO QUE ELE MANDOU em 31/08: as artes em cima, uma
 * atrás da outra, e por baixo o conteúdo principal com a capa, o áudio e os
 * textos. As artes são quantas ele quiser — o próprio desenho tem um
 * "acrescentar outra arte" — o que reconcilia isto com o que ele tinha pedido em
 * 28/08, que o número não fosse fixo.
 *
 * NÃO FOI PRECISO MEXER NA BASE DE DADOS. Uma publicação do Produto Vivo já era
 * um conjunto de cartões dentro do mesmo conteúdo: os que só têm imagem são as
 * artes, o que tem som é o conteúdo principal. Faltava o ecrã que os mostra
 * juntos.
 */
export function EdicaoDoProdutoVivo({ projectSlug }: { projectSlug: string }) {
  const [dados, definirDados] = useState<Awaited<ReturnType<typeof admin.estruturaRaiz>> | null>(
    null,
  )
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)
  /**
   * O botão diz em que passo está: parado, a publicar, publicado.
   *
   * Ele carregou em publicar e o botão não mudou de aspecto nenhum: "não sei se
   * o clique funcionou, se está enviando, ou se preciso clicar novamente". Um
   * botão que não responde convida a segunda carregada, e a segunda carregada
   * num botão que publica é um problema de verdade.
   */
  const [passo, definirPasso] = useState<'parado' | 'a publicar' | 'publicado'>('parado')

  const recarregar = useCallback(async () => {
    try {
      definirDados(await admin.estruturaRaiz(projectSlug))
      definirErro(null)
    } catch {
      definirErro('Não foi possível carregar o Produto Vivo.')
    }
  }, [projectSlug])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const pv = dados?.produtoVivo
  /*
    A ORDEM VEM DO SERVIDOR, e não é recalculada aqui.

    A regra "imagens primeiro, som no fim" vive em
    `apps/api/src/content/ordem-do-produto-vivo.ts` e a estrutura já chega
    ordenada por ela. Reescrevê-la aqui era criar a segunda cópia de uma regra,
    e foi assim que em 29/08 o botão PUBLICAR acendeu no ecrã enquanto o
    servidor recusava: duas cópias da mesma regra, uma delas actualizada.
  */
  const cartoes = pv?.cartoes ?? []
  /*
    QUAL DELES É O CONTEÚDO PRINCIPAL.

    À primeira escolhi "o que tem áudio", e estava errado de uma maneira que só
    se vê a usar: enquanto não houvesse áudio nenhum, não havia principal, e
    então o título, o subtítulo e a descrição não apareciam de todo. Ficava um
    ecrã onde só dá para carregar imagens, e a pessoa teria de adivinhar que os
    textos aparecem depois de enviar um som. O desenho dele mostra o contrário:
    o bloco principal está lá desde o início, vazio, à espera da capa e do som.

    A regra certa é a mesma da ordem: o principal é o ÚLTIMO cartão. Quando um
    deles ganha áudio, a ordem do servidor põe-no no fim, e ele passa a ser o
    principal sem ninguém mexer em nada.
  */
  const principal = cartoes.length > 0 ? cartoes[cartoes.length - 1] : null
  const artes = principal ? cartoes.slice(0, -1) : cartoes

  async function comOcupado(chave: string, tarefa: () => Promise<unknown>) {
    definirOcupado(chave)
    definirErro(null)
    try {
      await tarefa()
      await recarregar()
      /*
        E a página pública tem de esquecer o que guardou.

        Ela é desenhada no servidor com `revalidate: 30`, e por isso a
        publicação só aparecia lá meio minuto depois — ele descreveu-o como
        "preciso sair da página e entrar novamente para ela aparecer". É o
        mesmo que aconteceu com a fotografia do perfil em 29/08, e a solução é
        a mesma rota de esquecimento.

        Sem `await`: é limpeza, não faz parte de gravar.
      */
      void fetch('/revalidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug }),
      }).catch(() => {})
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível concluir.')
    } finally {
      definirOcupado(null)
    }
  }

  if (erro && !dados) return <p className="erro">{erro}</p>
  if (!dados || !pv) return <p className="vazio">Carregando...</p>

  return (
    <div className="edicao-pv">
      {erro && <p className="erro">{erro}</p>}
      {aviso && <p className="nota-ok">{aviso}</p>}

      <h2 className="seccao-pv">ARTES (IMAGENS)</h2>

      {artes.length === 0 && (
        <p className="nota">Ainda não há nenhuma arte. Use o botão abaixo para acrescentar.</p>
      )}

      {artes.map((arte, i) => (
        <Arte
          key={arte.id}
          numero={i + 1}
          cartao={arte}
          ocupado={ocupado}
          aoTrocarImagem={(f) =>
            comOcupado(`img-${arte.id}`, () => admin.porFotoNoCartao(arte.id, f))
          }
          aoDuplicar={() => comOcupado(`dup-${arte.id}`, () => admin.duplicarCartao(arte.id))}
          aoApagar={() => comOcupado(`del-${arte.id}`, () => admin.apagarCartaoDeVez(arte.id))}
          aoPorNoAr={() => comOcupado(`ar-${arte.id}`, () => admin.porCartaoNoAr(arte.id))}
        />
      ))}

      <button
        type="button"
        className="acrescentar-cartao"
        disabled={ocupado !== null}
        onClick={() => comOcupado('nova-arte', () => admin.acrescentarCartao(pv.contentId))}
      >
        + Acrescentar outra arte (imagem)
      </button>

      <h2 className="seccao-pv">CONTEÚDO PRINCIPAL</h2>
      <p className="nota">
        A arte com o áudio. Aparece sempre no fim da publicação, por baixo das outras.
      </p>

      {principal ? (
        <ConteudoPrincipal
          cartao={principal}
          ocupado={ocupado}
          aoTrocarCapa={(f) =>
            comOcupado(`capa-${principal.id}`, () => admin.porFotoNoCartao(principal.id, f))
          }
          aoTrocarAudio={(f) =>
            comOcupado(`som-${principal.id}`, () => admin.porAudioNoCartao(principal.id, f))
          }
          passo={passo}
          aoGravar={async (campos) => {
            definirPasso('a publicar')
            await comOcupado(`txt-${principal.id}`, () => admin.salvarCartao(principal.id, campos))
            definirPasso('publicado')
            definirAviso(null)
            // Volta ao normal passado um instante, para o botão poder ser usado
            // outra vez sem recarregar a página.
            setTimeout(() => definirPasso('parado'), 2500)
          }}
        />
      ) : (
        <div className="sem-principal">
          <p className="nota">
            Esta publicação ainda não tem nenhum cartão. Acrescente um acima para começar.
          </p>
        </div>
      )}
    </div>
  )
}

/** Uma arte: a imagem, o número, e o menu de duplicar ou apagar. */
function Arte({
  numero,
  cartao,
  ocupado,
  aoTrocarImagem,
  aoDuplicar,
  aoApagar,
  aoPorNoAr,
}: {
  numero: number
  cartao: CartaoAdmin
  ocupado: string | null
  aoTrocarImagem: (f: File) => void
  aoDuplicar: () => void
  aoApagar: () => void
  aoPorNoAr: () => void
}) {
  const [menu, definirMenu] = useState(false)
  const campo = useRef<HTMLInputElement | null>(null)
  const aTrabalhar = ocupado?.endsWith(cartao.id) ?? false

  return (
    <div className={cartao.foraDoAr ? 'arte-pv fora-do-ar' : 'arte-pv'}>
      <span className="numero-arte">{numero}</span>

      {/*
        UMA ARTE FORA DO AR TEM DE SE VER QUE ESTÁ FORA DO AR.

        Ele publicou três artes e apareceram duas. A que faltava estava marcada
        como tirada do ar no painel antigo, e este ecrã desenhava-a igual às
        outras: ele via três e o público via duas, sem nada que explicasse a
        diferença. O ecrã novo não tem sequer como tirar do ar, por isso o único
        caminho honesto é mostrar quando está e dar um botão para a repor.
      */}
      {cartao.foraDoAr && (
        <div className="marca-fora-do-ar">
          <span>Esta arte não aparece na página</span>
          <button type="button" onClick={aoPorNoAr} disabled={aTrabalhar}>
            Pôr no ar
          </button>
        </div>
      )}

      <button
        type="button"
        className="tres-pontos"
        aria-label={`Opções da arte ${numero}`}
        onClick={() => definirMenu((v) => !v)}
      >
        ⋯
      </button>
      {menu && (
        <div className="menu-quadrado" role="menu">
          <button
            type="button"
            className="perigo"
            onClick={() => {
              definirMenu(false)
              if (confirm('Apagar esta arte? Isto não se desfaz.')) aoApagar()
            }}
          >
            🗑 Deletar
          </button>
          <button
            type="button"
            onClick={() => {
              definirMenu(false)
              aoDuplicar()
            }}
          >
            ⧉ Duplicar
          </button>
        </div>
      )}

      <button
        type="button"
        className="area-da-arte"
        disabled={aTrabalhar}
        onClick={() => campo.current?.click()}
      >
        {cartao.imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cartao.imagem} alt={`Arte ${numero}`} />
        ) : (
          <span className="vazio-arte">
            <span aria-hidden>🖼</span>
            {aTrabalhar ? 'A enviar...' : 'Adicionar imagem'}
          </span>
        )}
      </button>

      <input
        ref={campo}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.heic,.webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) aoTrocarImagem(f)
          // Esvaziar, para a MESMA imagem poder ser escolhida outra vez. Sem
          // isto, trocar e voltar a escolher a mesma não faz nada e o botão
          // parece morto — foi o que aconteceu no enquadrador em 29/08.
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** O conteúdo principal: capa, áudio, e os textos da publicação. */
function ConteudoPrincipal({
  cartao,
  ocupado,
  aoTrocarCapa,
  aoTrocarAudio,
  aoGravar,
  passo,
}: {
  cartao: CartaoAdmin
  ocupado: string | null
  aoTrocarCapa: (f: File) => void
  aoTrocarAudio: (f: File) => void
  aoGravar: (campos: { titulo: string; subtitulo: string; descricao: string }) => void
  passo: 'parado' | 'a publicar' | 'publicado'
}) {
  const [titulo, definirTitulo] = useState(cartao.titulo ?? '')
  const [subtitulo, definirSubtitulo] = useState(cartao.subtitulo ?? '')
  const [descricao, definirDescricao] = useState(cartao.descricao ?? '')
  const capa = useRef<HTMLInputElement | null>(null)
  const som = useRef<HTMLInputElement | null>(null)
  const aTrabalhar = ocupado?.endsWith(cartao.id) ?? false

  /*
    Os campos seguem o cartão quando ele muda por fora — por exemplo depois de
    enviar uma imagem, que recarrega tudo. Sem isto, o que estivesse escrito e
    ainda não gravado desaparecia ao enviar a capa.
  */
  useEffect(() => {
    definirTitulo(cartao.titulo ?? '')
    definirSubtitulo(cartao.subtitulo ?? '')
    definirDescricao(cartao.descricao ?? '')
  }, [cartao.id, cartao.titulo, cartao.subtitulo, cartao.descricao])

  return (
    <>
      <div className="principal-pv">
        <button
          type="button"
          className="capa-principal"
          disabled={aTrabalhar}
          onClick={() => capa.current?.click()}
        >
          {cartao.imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cartao.imagem} alt="Capa do conteúdo principal" />
          ) : (
            <span className="vazio-arte">
              <span aria-hidden>🖼</span>
              Adicionar foto (capa)
            </span>
          )}
        </button>

        <button
          type="button"
          className="linha-audio-pv"
          disabled={aTrabalhar}
          onClick={() => som.current?.click()}
        >
          <span className="tocar" aria-hidden>
            ▶
          </span>
          <span className="nome-do-som">
            {cartao.audio?.title ?? 'Tocar para escolher o áudio'}
          </span>
          <span className="tempo">{cartao.audio ? 'trocar' : '00:00 / 00:00'}</span>
        </button>

        {/* Os indicadores apagados, como no desenho dele: fazem parte da peça
            e os números são de quem visita, não de quem publica. */}
        <div className="indicadores-pv" aria-hidden>
          <span>👁 0</span>
          <span>♡ 0</span>
          <span>💬 0</span>
          <span>↗ 0</span>
        </div>
      </div>

      <input
        ref={capa}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.heic,.webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) aoTrocarCapa(f)
          e.target.value = ''
        }}
      />
      <input
        ref={som}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) aoTrocarAudio(f)
          e.target.value = ''
        }}
      />

      <label className="rotulo-pv" htmlFor="pv-titulo">
        TÍTULO
      </label>
      <input
        id="pv-titulo"
        type="text"
        maxLength={120}
        placeholder="Digite o título"
        value={titulo}
        onChange={(e) => definirTitulo(e.target.value)}
      />

      <label className="rotulo-pv" htmlFor="pv-subtitulo">
        SUBTÍTULO (opcional)
      </label>
      <input
        id="pv-subtitulo"
        type="text"
        maxLength={160}
        placeholder="Digite o subtítulo"
        value={subtitulo}
        onChange={(e) => definirSubtitulo(e.target.value)}
      />

      <label className="rotulo-pv" htmlFor="pv-descricao">
        DESCRIÇÃO
      </label>
      <textarea
        id="pv-descricao"
        rows={6}
        maxLength={4000}
        placeholder="Digite a descrição..."
        value={descricao}
        onChange={(e) => definirDescricao(e.target.value)}
      />

      <button
        type="button"
        className={`guardar-publicacao passo-${passo.replace(' ', '-')}`}
        disabled={passo !== 'parado'}
        onClick={() => aoGravar({ titulo, subtitulo, descricao })}
      >
        {passo === 'a publicar'
          ? 'PUBLICANDO...'
          : passo === 'publicado'
            ? 'PUBLICADO ✓'
            : 'Salvar publicação'}
      </button>
    </>
  )
}
