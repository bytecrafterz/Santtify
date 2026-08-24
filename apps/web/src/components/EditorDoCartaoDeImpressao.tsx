'use client'

import { useState } from 'react'
import { admin, type CartaoAdmin } from '@/lib/admin'

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
 */
export function EditorDoCartaoDeImpressao({
  cartao,
  letra,
  aoGuardar,
  aoCancelar,
}: {
  cartao: CartaoAdmin
  letra: string
  aoGuardar: () => Promise<void>
  aoCancelar: () => void
}) {
  const [arte, definirArte] = useState(cartao.imagem)
  const [folha, definirFolha] = useState(cartao.folhaA4 ?? null)
  const [link, definirLink] = useState(cartao.linkUpgrade ?? '')
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)

  const falta = [!arte && 'a arte de apresentação', !folha && 'a folha A4'].filter(
    Boolean,
  ) as string[]

  /** A imagem aparece assim que é escolhida, como no editor dos outros cartões. */
  async function enviar(qual: 'arte' | 'folha', arquivo: File) {
    const anterior = qual === 'arte' ? arte : folha
    const local = URL.createObjectURL(arquivo)
    if (qual === 'arte') definirArte(local)
    else definirFolha(local)
    definirOcupado(qual)
    definirErro(null)
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

  return (
    <div className="editor-cartao">
      <div className="topo-editor">
        <button type="button" className="voltar-sequencia" onClick={aoCancelar}>
          ← Quadrados
        </button>
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
          <span className="acao-area">
            {ocupado === 'arte' ? 'A enviar...' : 'Tocar para trocar'}
          </span>
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
          <span className="acao-area">
            {ocupado === 'folha' ? 'A enviar...' : 'Tocar para trocar'}
          </span>
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
        ) : (
          <>PRONTO — o cartão da Letra {letra} aparece no fim da letra assim que guardar</>
        )}
      </p>
    </div>
  )
}
