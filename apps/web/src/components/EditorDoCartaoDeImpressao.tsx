'use client'

import { useState } from 'react'
import { admin, type CartaoAdmin } from '@/lib/admin'
import { Voltar } from './Voltar'
import { QrDaLetra } from './QrDaLetra'
import { artigoDefinido } from '@/lib/unidade'

/**
 * O cartão de impressão da letra, no painel.
 *
 * TEM OUTROS CAMPOS E OUTRA RÉGUA, e é por isso que não usa o editor comum.
 * Não tem áudio nem descrição: tem a arte de apresentação, que é o que a
 * pessoa vê na página, e a folha A4, que é o que sai na impressora. Exigir-lhe
 * um som, como se exige aos outros, mantê-lo-ia em rascunho para sempre.
 *
 * A pré-visualização mostra a ordem exacta em que ele vai aparecer na página —
 * arte, folha, botão — porque é a única forma de perceber que a folha A4 é
 * para IMPRIMIR e não para olhar. As duas imagens juntas num formulário sem
 * ordem levam a que se troquem uma pela outra, e aí a criança leva para casa
 * o cartaz em vez da folha.
 *
 * O QR ESTÁ AQUI PORQUE É AQUI QUE ELE PRECISA DELE. Ele escreveu em 26/08 que
 * o QR já devia estar pronto para baixar e enviar ao designer, e tinha razão:
 * era criado com a letra e depois só aparecia noutro ecrã. Uma coisa criada
 * automaticamente que ninguém encontra é o mesmo que não existir.
 */
export function EditorDoCartaoDeImpressao({
  cartao,
  letra,
  unidade = 'Letra',
  projectSlug,
  contentSlug,
  aoGuardar,
  aoApagar,
  aoCancelar,
}: {
  cartao: CartaoAdmin
  letra: string
  /** Como se chama uma casa neste projeto: "Letra", "Dia". Ver `Project.unidade`. */
  unidade?: string
  projectSlug: string
  contentSlug: string | null
  aoGuardar: () => Promise<void>
  aoApagar: () => Promise<void>
  aoCancelar: () => void
}) {
  const [arte, definirArte] = useState(cartao.imagem)
  const [folha, definirFolha] = useState(cartao.folhaA4 ?? null)
  const [link, definirLink] = useState(cartao.linkUpgrade ?? '')
  const [estado, definirEstado] = useState(cartao.estado)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aConfirmar, definirAConfirmar] = useState(false)
  const [aEscolherQual, definirAEscolherQual] = useState(false)

  const falta = [!arte && 'a arte de apresentação', !folha && 'a folha A4'].filter(
    Boolean,
  ) as string[]

  // Sem slug não há endereço público, e sem endereço público não há QR nem PDF.
  // Acontece enquanto a letra ainda não foi criada de verdade.
  const pdf = contentSlug ? admin.urlCartaoPdf(projectSlug, contentSlug) : null
  const pdfParaBaixar = contentSlug ? admin.urlCartaoPdf(projectSlug, contentSlug, true) : null

  /** A imagem aparece assim que é escolhida, como no editor dos outros cartões. */
  async function enviar(qual: 'arte' | 'folha', arquivo: File) {
    const anterior = qual === 'arte' ? arte : folha
    const local = URL.createObjectURL(arquivo)
    if (qual === 'arte') definirArte(local)
    else definirFolha(local)
    definirOcupado(qual)
    definirErro(null)
    definirAEscolherQual(false)
    try {
      const r =
        qual === 'arte'
          ? await admin.porFotoNoCartao(cartao.id, arquivo)
          : await admin.porFolhaA4NoCartao(cartao.id, arquivo)
      if (qual === 'arte') definirArte(r.imagem ?? local)
      else definirFolha(r.folhaA4 ?? local)
    } catch {
      if (qual === 'arte') definirArte(anterior)
      else definirFolha(anterior)
      definirErro('Não foi possível enviar a imagem. Tente outra vez.')
    } finally {
      URL.revokeObjectURL(local)
      definirOcupado(null)
    }
  }

  async function guardar() {
    definirOcupado('guardar')
    definirErro(null)
    try {
      await admin.salvarCartao(cartao.id, { linkUpgrade: link })
      await aoGuardar()
    } catch {
      definirErro('Não foi possível guardar.')
      definirOcupado(null)
    }
  }

  /**
   * Sair do ar não é apagar, e é essa a diferença que o botão único escondia.
   * O cartão fica inteiro, com a arte e a folha, e volta com um toque.
   */
  async function tirarDoAr() {
    definirOcupado('tirar')
    definirErro(null)
    try {
      const r = await admin.tirarCartaoDoAr(cartao.id)
      definirEstado(r.estado as CartaoAdmin['estado'])
    } catch {
      definirErro('Não foi possível tirar do ar.')
    } finally {
      definirOcupado(null)
    }
  }

  async function porNoAr() {
    definirOcupado('publicar')
    definirErro(null)
    try {
      const r = await admin.porCartaoNoAr(cartao.id)
      definirEstado(r.estado as CartaoAdmin['estado'])
    } catch {
      definirErro('Não foi possível pôr no ar.')
    } finally {
      definirOcupado(null)
    }
  }

  /** Não tem volta, e por isso passa por uma pergunta antes. */
  async function apagar() {
    definirOcupado('apagar')
    definirErro(null)
    try {
      await admin.apagarCartaoDeVez(cartao.id)
      await aoApagar()
    } catch {
      definirErro('Não foi possível apagar.')
      definirOcupado(null)
      definirAConfirmar(false)
    }
  }

  return (
    <div className="editor-cartao">
      <div className="topo-editor">
        <Voltar aoClicar={aoCancelar} emLinha>Quadrados</Voltar>

        <span className="etiqueta-interna">CARTÃO PARA IMPRESSÃO</span>
      </div>

      {/* A pré-visualização é a peça, na ordem em que ela vai aparecer. */}
      <article className="previa-cartao">
        <label className="area-foto">
          {arte ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={arte} alt="" />
          ) : (
            <span className="vazio-foto">
              <span aria-hidden>🖼</span>
              ARTE DE APRESENTAÇÃO
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void enviar('arte', f)
            }}
          />
          <span className="acao-area">{ocupado === 'arte' ? 'A enviar...' : 'TROCAR'}</span>
        </label>

        <label className="area-foto folha">
          {folha ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={folha} alt="" />
          ) : (
            <span className="vazio-foto">
              <span aria-hidden>📄</span>
              FOLHA A4 PARA IMPRIMIR
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void enviar('folha', f)
            }}
          />
          <span className="acao-area">{ocupado === 'folha' ? 'A enviar...' : 'TROCAR'}</span>
        </label>

        <div className="faixa-imprimir">
          <span className="botao-imprimir como-sera">🖨 IMPRIMIR GRÁTIS</span>
        </div>

        <div className="indicadores-apagados" aria-hidden>
          <span>👁 0</span>
          <span>♡ 0</span>
          <span>💬 0</span>
          <span>↗ 0</span>
        </div>

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

      <QrDaLetra projectSlug={projectSlug} contentSlug={contentSlug} letra={letra} unidade={unidade} />

      {/*
        Ver o que sai na impressora antes de mandar imprimir. É o mesmo ficheiro
        que a pessoa em casa recebe, gerado no servidor, uma folha A4 e nada mais.
      */}
      {pdf && pdfParaBaixar && folha && (
        <section className="bloco-qr">
          <h3>A FOLHA A4</h3>
          <p className="nota-qr">Uma folha, só o cartão, sem nada do site.</p>
          <div className="linha-acoes">
            <a className="botao-acao" href={pdf} target="_blank" rel="noopener noreferrer">
              🖨 IMPRIMIR
            </a>
            <a
              className="botao-acao"
              href={pdfParaBaixar}
              download={`cartao-${unidade.toLowerCase()}-${letra.toLowerCase()}.pdf`}
            >
              ⬇ BAIXAR PDF
            </a>
          </div>
        </section>
      )}

      {erro && <p className="erro">{erro}</p>}

      {/*
        TROCAR, TIRAR DO AR e DELETAR, separadas, como ele pediu em 26/08.
        Estavam as três atrás do mesmo gesto, e por isso quem só queria corrigir
        uma imagem não tinha como tirar o cartão do ar sem o apagar.
      */}
      <div className="tres-acoes">
        <button
          type="button"
          className="acao-separada"
          onClick={() => definirAEscolherQual((v) => !v)}
          disabled={ocupado !== null}
        >
          TROCAR
        </button>
        {estado === 'PUBLICADO' ? (
          <button
            type="button"
            className="acao-separada"
            onClick={() => void tirarDoAr()}
            disabled={ocupado !== null}
          >
            {ocupado === 'tirar' ? 'A tirar...' : 'TIRAR DO AR'}
          </button>
        ) : (
          <button
            type="button"
            className="acao-separada"
            onClick={() => void porNoAr()}
            disabled={ocupado !== null || falta.length > 0}
            title={falta.length ? `Falta ${falta.join(' e ')}` : 'Pôr o cartão no ar'}
          >
            {ocupado === 'publicar' ? 'A pôr...' : 'PÔR NO AR'}
          </button>
        )}
        <button
          type="button"
          className="acao-separada perigo"
          onClick={() => definirAConfirmar(true)}
          disabled={ocupado !== null}
        >
          DELETAR
        </button>
      </div>

      {aEscolherQual && (
        <p className="nota-qr aviso-trocar">
          Toque na imagem que quer trocar: a arte de apresentação em cima, a folha A4 por baixo.
        </p>
      )}

      {aConfirmar && (
        <div className="confirmar-apagar">
          <p>{`Apagar o cartão de impressão ${artigoDefinido(unidade) === 'a' ? 'da' : 'do'} ${unidade} ${letra}?`} A arte e a folha A4 vão-se embora.</p>
          <div className="linha-acoes">
            <button
              type="button"
              className="botao-acao"
              onClick={() => definirAConfirmar(false)}
              disabled={ocupado === 'apagar'}
            >
              MANTER
            </button>
            <button
              type="button"
              className="acao-separada perigo"
              onClick={() => void apagar()}
              disabled={ocupado === 'apagar'}
            >
              {ocupado === 'apagar' ? 'A apagar...' : 'APAGAR MESMO'}
            </button>
          </div>
        </div>
      )}

      <div className="acoes-cartao">
        <button
          type="button"
          className="botao-acao largo"
          onClick={() => void guardar()}
          disabled={ocupado !== null}
        >
          {ocupado === 'guardar' ? 'A guardar...' : 'SALVAR'}
        </button>

        <button
          type="button"
          className="botao-publicar"
          onClick={() => void guardar()}
          disabled={ocupado !== null || falta.length > 0}
          title={falta.length ? `Falta ${falta.join(' e ')}` : 'Publicar o cartão de impressão'}
        >
          {falta.length > 0 && (
            <span aria-hidden className="cadeado">
              🔒
            </span>
          )}
          PUBLICAR
        </button>
      </div>

      <p className={falta.length ? 'tira-estado rascunho' : 'tira-estado pronto'}>
        {falta.length ? (
          <>RASCUNHO — falta {falta.join(' e ')}</>
        ) : estado === 'PUBLICADO' ? (
          <>{`NO AR — o cartão ${artigoDefinido(unidade) === 'a' ? 'da' : 'do'} ${unidade} ${letra} aparece no fim ${artigoDefinido(unidade) === 'a' ? 'da' : 'do'} ${unidade.toLowerCase()}`}</>
        ) : (
          <>FORA DO AR — está inteiro e guardado, mas ninguém o vê</>
        )}
      </p>
    </div>
  )
}
