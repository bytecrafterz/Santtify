'use client'

import { useState } from 'react'
import { admin, type CartaoAdmin } from '@/lib/admin'

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
export function EditorDeCartao({
  cartao,
  aoGuardar,
  aoCancelar,
}: {
  cartao: CartaoAdmin
  aoGuardar: () => Promise<void>
  aoCancelar: () => void
}) {
  const [titulo, definirTitulo] = useState(cartao.titulo ?? '')
  const [descricao, definirDescricao] = useState(cartao.descricao ?? '')
  const [link, definirLink] = useState(cartao.linkUpgrade ?? '')
  const [imagem, definirImagem] = useState(cartao.imagem)
  const [audio, definirAudio] = useState(cartao.audio)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  const falta = [
    !imagem && 'a foto',
    !audio && 'o áudio',
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

        <label className="area-audio">
          <span className="play" aria-hidden>
            ▶
          </span>
          <span className="faixa-audio">
            {audio?.title ?? (ocupado === 'audio' ? 'A enviar...' : 'Tocar para escolher o áudio')}
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
