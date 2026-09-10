'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { A4_MM } from '@pv/cartoes'
import { painelDeCartoes, type ModeloAdmin, type PrecoAdmin } from '@/lib/admin'
import { ErroDeApi } from '@/lib/auth'

/**
 * Os modelos de cartão, no painel.
 *
 * ESTE ECRÃ É ONDE O NÚMERO MAIS IMPORTANTE DE TODA A FUNCIONALIDADE É
 * ESCRITO: as medidas da moldura da foto, em milímetros. É delas que sai a
 * verificação de qualidade. Sem elas a validação recusaria fotografias boas e
 * aprovaria fotografias más, e nos dois casos só se saberia na gráfica.
 *
 * Por isso as medidas aparecem em campos normais, com a folha desenhada ao lado
 * a mostrar onde ficam. Um número que se escreve às cegas escreve-se errado.
 *
 * E é por existir este ecrã que um oitavo modelo não precisa de programação
 * nenhuma: entra por aqui, como os sete entraram.
 */
export function PainelDeModelosDeCartao({ projectSlug }: { projectSlug: string }) {
  const [modelos, definirModelos] = useState<ModeloAdmin[]>([])
  const [preco, definirPreco] = useState<PrecoAdmin | null>(null)
  const [aCarregar, definirACarregar] = useState(true)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [aberto, definirAberto] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        painelDeCartoes.modelos(projectSlug),
        painelDeCartoes.preco(projectSlug),
      ])
      definirModelos(m)
      definirPreco(p)
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível carregar.')
    } finally {
      definirACarregar(false)
    }
  }, [projectSlug])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const comErro = async (chave: string, accao: () => Promise<void>) => {
    definirErro(null)
    definirOcupado(chave)
    try {
      await accao()
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível concluir.')
    } finally {
      definirOcupado(null)
    }
  }

  if (aCarregar) return <p className="subtitulo">A carregar…</p>

  const semArte = modelos.filter((m) => m.aviso).length

  return (
    <div className="painel-cartoes">
      {erro && <p className="cartoes-erro">{erro}</p>}

      {preco && (
        <TabelaDePreco
          preco={preco}
          ocupado={ocupado === 'preco'}
          aoGuardar={(dados) =>
            comErro('preco', async () => {
              definirPreco(await painelDeCartoes.guardarPreco(projectSlug, dados))
            })
          }
        />
      )}

      <section className="painel-bloco">
        <header className="painel-bloco-topo">
          <h2>Modelos de cartão ({modelos.length})</h2>
          <button
            type="button"
            className="cartoes-accao-secundaria painel-botao-curto"
            disabled={ocupado !== null}
            onClick={() =>
              comErro('novo', async () => {
                await painelDeCartoes.criarModelo(projectSlug, {})
                await carregar()
              })
            }
          >
            + Novo modelo
          </button>
        </header>

        {semArte > 0 && (
          <p className="painel-aviso">
            {semArte === 1
              ? '1 modelo ainda não tem arte carregada.'
              : `${semArte} modelos ainda não têm arte carregada.`}{' '}
            Sem arte, o PDF desse modelo não é gerado.
          </p>
        )}

        <ul className="painel-modelos">
          {modelos.map((m) => (
            <li key={m.id} className={m.ativo ? 'painel-modelo' : 'painel-modelo inactivo'}>
              <button
                type="button"
                className="painel-modelo-topo"
                onClick={() => definirAberto(aberto === m.id ? null : m.id)}
                aria-expanded={aberto === m.id}
              >
                <span className="painel-modelo-dia">Dia {m.dia}</span>
                <span className="painel-modelo-nome">{m.nome}</span>
                <span className={m.aviso ? 'painel-selo-falta' : 'painel-selo-pronto'}>
                  {m.aviso ? 'sem arte' : 'pronto'}
                </span>
                <span aria-hidden="true">{aberto === m.id ? '▾' : '▸'}</span>
              </button>

              {aberto === m.id && (
                <EditorDoModelo
                  modelo={m}
                  ocupado={ocupado}
                  aoGuardar={(dados) =>
                    comErro(`m-${m.id}`, async () => {
                      await painelDeCartoes.actualizarModelo(m.id, dados)
                      await carregar()
                    })
                  }
                  aoEnviarArte={(f) =>
                    comErro(`arte-${m.id}`, async () => {
                      const r = await painelDeCartoes.enviarArte(m.id, f)
                      if (r.aviso) definirErro(r.aviso)
                      await carregar()
                    })
                  }
                  aoRemover={() =>
                    comErro(`rm-${m.id}`, async () => {
                      await painelDeCartoes.removerModelo(m.id)
                      definirAberto(null)
                      await carregar()
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function TabelaDePreco({
  preco,
  ocupado,
  aoGuardar,
}: {
  preco: PrecoAdmin
  ocupado: boolean
  aoGuardar: (dados: Partial<PrecoAdmin>) => void
}) {
  const [reais, definirReais] = useState((preco.precoUnitarioCent / 100).toFixed(2))
  const [desconto, definirDesconto] = useState(String(preco.descontoPercentagem))
  const [aPartirDe, definirAPartirDe] = useState(String(preco.descontoAPartirDe))

  return (
    <section className="painel-bloco">
      <h2>Preço e desconto</h2>
      <p className="subtitulo">
        Vale para todos os conjuntos deste projeto. Muda aqui, sem programação.
      </p>

      <div className="painel-campos">
        <label className="cartoes-campo">
          <span>Preço por conjunto (R$)</span>
          <input
            type="text"
            inputMode="decimal"
            value={reais}
            onChange={(e) => definirReais(e.target.value)}
          />
        </label>
        <label className="cartoes-campo">
          <span>Desconto (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={desconto}
            onChange={(e) => definirDesconto(e.target.value)}
          />
        </label>
        <label className="cartoes-campo">
          <span>A partir de quantos conjuntos</span>
          <input
            type="number"
            min={1}
            value={aPartirDe}
            onChange={(e) => definirAPartirDe(e.target.value)}
          />
        </label>
      </div>

      <p className="painel-exemplo">
        {(() => {
          const cent = Math.round(Number(reais.replace(',', '.')) * 100) || 0
          const pct = Number(desconto) || 0
          const a = Number(aPartirDe) || 2
          const dois = cent * 2
          return `Exemplo: 1 conjunto = ${(cent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · ` +
            `${a} conjuntos = ${((dois - (2 >= a ? (dois * pct) / 100 : 0)) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
        })()}
      </p>

      <button
        type="button"
        className="cartoes-accao"
        disabled={ocupado}
        onClick={() =>
          aoGuardar({
            precoUnitarioCent: Math.round(Number(reais.replace(',', '.')) * 100),
            descontoPercentagem: Number(desconto),
            descontoAPartirDe: Number(aPartirDe),
          })
        }
      >
        {ocupado ? 'A guardar…' : 'Guardar preço'}
      </button>
    </section>
  )
}

/**
 * As medidas de um modelo, com a folha desenhada ao lado.
 *
 * O desenho não é enfeite: é a única forma de perceber, sem imprimir, que 92mm
 * de altura põem a moldura a meio da folha e não em cima. Quem escreve o número
 * vê onde ele cai.
 */
function EditorDoModelo({
  modelo,
  ocupado,
  aoGuardar,
  aoEnviarArte,
  aoRemover,
}: {
  modelo: ModeloAdmin
  ocupado: string | null
  aoGuardar: (dados: Partial<ModeloAdmin>) => void
  aoEnviarArte: (f: File) => void
  aoRemover: () => void
}) {
  const [campos, definirCampos] = useState<ModeloAdmin>(modelo)
  const [aConfirmar, definirAConfirmar] = useState(false)
  const ficheiro = useRef<HTMLInputElement | null>(null)

  useEffect(() => definirCampos(modelo), [modelo])

  const num = (chave: keyof ModeloAdmin, rotulo: string, max: number) => (
    <label className="cartoes-campo" key={chave}>
      <span>
        {rotulo} <em>mm</em>
      </span>
      <input
        type="number"
        step="0.5"
        min={0}
        max={max}
        value={String(campos[chave] ?? '')}
        onChange={(e) =>
          definirCampos({ ...campos, [chave]: Number(e.target.value) } as ModeloAdmin)
        }
      />
    </label>
  )

  return (
    <div className="painel-modelo-corpo">
      <div className="painel-modelo-grelha">
        <div>
          <label className="cartoes-campo">
            <span>Nome do modelo</span>
            <input
              type="text"
              value={campos.nome}
              onChange={(e) => definirCampos({ ...campos, nome: e.target.value })}
            />
          </label>

          <h3 className="painel-subtitulo">Moldura da foto</h3>
          <div className="painel-campos">
            {num('fotoX', 'Da esquerda', A4_MM.largura)}
            {num('fotoY', 'Do topo', A4_MM.altura)}
            {num('fotoLargura', 'Largura', A4_MM.largura)}
            {num('fotoAltura', 'Altura', A4_MM.altura)}
          </div>
          <label className="cartoes-campo">
            <span>Formato</span>
            <select
              value={campos.fotoFormato}
              onChange={(e) =>
                definirCampos({
                  ...campos,
                  fotoFormato: e.target.value as ModeloAdmin['fotoFormato'],
                })
              }
            >
              <option value="ELIPSE">Oval</option>
              <option value="CIRCULO">Círculo</option>
              <option value="RETANGULO">Retângulo</option>
            </select>
          </label>

          <p className="painel-exemplo">
            Uma foto precisa de{' '}
            <strong>{Math.ceil((campos.fotoLargura / 25.4) * 300)}</strong> ×{' '}
            <strong>{Math.ceil((campos.fotoAltura / 25.4) * 300)}</strong> pixels para
            imprimir a 300 dpi neste tamanho.
          </p>

          <h3 className="painel-subtitulo">Caixa do nome</h3>
          <div className="painel-campos">
            {num('nomeX', 'Da esquerda', A4_MM.largura)}
            {num('nomeY', 'Do topo', A4_MM.altura)}
            {num('nomeLargura', 'Largura', A4_MM.largura)}
            {num('nomeAltura', 'Altura', A4_MM.altura)}
          </div>
          <div className="painel-campos">
            <label className="cartoes-campo">
              <span>Cor do nome</span>
              <input
                type="color"
                value={campos.nomeCorHex}
                onChange={(e) => definirCampos({ ...campos, nomeCorHex: e.target.value })}
              />
            </label>
            <label className="cartoes-campo">
              <span>Maiúsculas</span>
              <input
                type="checkbox"
                checked={campos.nomeMaiusculas}
                onChange={(e) => definirCampos({ ...campos, nomeMaiusculas: e.target.checked })}
              />
            </label>
          </div>
        </div>

        <div className="painel-modelo-folha">
          <FolhaDeReferencia modelo={campos} />
          <input
            ref={ficheiro}
            type="file"
            accept="image/*"
            className="apenas-leitor-de-ecra"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) aoEnviarArte(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="cartoes-accao-secundaria"
            disabled={ocupado !== null}
            onClick={() => ficheiro.current?.click()}
          >
            {ocupado === `arte-${modelo.id}`
              ? 'A enviar…'
              : modelo.arteUrl
                ? 'Trocar arte'
                : 'Enviar arte'}
          </button>
          <p className="painel-exemplo">A arte precisa de 2480px de largura para os 300 dpi.</p>
        </div>
      </div>

      <div className="painel-modelo-accoes">
        <button
          type="button"
          className="cartoes-accao"
          disabled={ocupado !== null}
          onClick={() => aoGuardar(campos)}
        >
          {ocupado === `m-${modelo.id}` ? 'A guardar…' : 'Guardar medidas'}
        </button>
        <label className="painel-activo">
          <input
            type="checkbox"
            checked={campos.ativo}
            onChange={(e) => aoGuardar({ ativo: e.target.checked })}
          />
          <span>Ativo (aparece para quem compra)</span>
        </label>
        {aConfirmar ? (
          <span className="painel-confirmar">
            Apagar {modelo.nome}?
            <button type="button" className="painel-perigo" onClick={aoRemover}>
              Sim, apagar
            </button>
            <button type="button" className="cartoes-ligacao" onClick={() => definirAConfirmar(false)}>
              Não
            </button>
          </span>
        ) : (
          <button type="button" className="cartoes-ligacao" onClick={() => definirAConfirmar(true)}>
            Apagar este modelo
          </button>
        )}
      </div>
    </div>
  )
}

/** A folha A4 com a moldura e a caixa do nome onde os números as põem. */
function FolhaDeReferencia({ modelo }: { modelo: ModeloAdmin }) {
  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  return (
    <div className="painel-folha">
      {modelo.arteUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={modelo.arteUrl} alt="" />
      )}
      <span
        className={
          modelo.fotoFormato === 'RETANGULO' ? 'painel-marca-foto recta' : 'painel-marca-foto'
        }
        style={{
          left: pct(modelo.fotoX, A4_MM.largura),
          top: pct(modelo.fotoY, A4_MM.altura),
          width: pct(modelo.fotoLargura, A4_MM.largura),
          height: pct(modelo.fotoAltura, A4_MM.altura),
        }}
      />
      <span
        className="painel-marca-nome"
        style={{
          left: pct(modelo.nomeX, A4_MM.largura),
          top: pct(modelo.nomeY, A4_MM.altura),
          width: pct(modelo.nomeLargura, A4_MM.largura),
          height: pct(modelo.nomeAltura, A4_MM.altura),
        }}
      >
        NOME
      </span>
    </div>
  )
}
