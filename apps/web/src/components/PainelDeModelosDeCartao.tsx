'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { A4_MM } from '@pv/cartoes'
import {
  painelDeCartoes,
  type CategoriaAdmin,
  type ModeloAdmin,
  type PrecoAdmin,
} from '@/lib/admin'
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
  const [categorias, definirCategorias] = useState<CategoriaAdmin[]>([])
  const [noutrosProjetos, definirNoutrosProjetos] = useState<
    Array<{ slug: string; name: string; modelos: number }>
  >([])
  const [preco, definirPreco] = useState<PrecoAdmin | null>(null)
  const [aCarregar, definirACarregar] = useState(true)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [aberto, definirAberto] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [m, p, c, onde] = await Promise.all([
        painelDeCartoes.modelos(projectSlug),
        painelDeCartoes.preco(projectSlug),
        painelDeCartoes.categorias(projectSlug),
        painelDeCartoes.onde(),
      ])
      definirModelos(m)
      definirPreco(p)
      definirCategorias(c)
      definirNoutrosProjetos(onde.filter((o) => o.slug !== projectSlug))
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

  return (
    <div className="painel-cartoes">
      {erro && <p className="cartoes-erro">{erro}</p>}

      {/* ESTE PROJETO NÃO TEM CARTÕES, MAS OUTRO TEM.
          Quem chega aqui está à procura de cartões que existem noutro sítio, e
          o ecrã vazio sozinho fá-lo-ia construir um segundo conjunto em vez de
          encontrar o primeiro. Por isso o caminho vem primeiro, antes do preço
          e das categorias. */}
      {modelos.length === 0 && noutrosProjetos.length > 0 && (
        <div className="painel-bloco painel-noutro-projeto">
          <h2>Os cartões estão noutro projeto</h2>
          <p className="subtitulo">
            Este projeto ainda não tem cartões. Para carregar ou trocar a arte, abra:
          </p>
          <ul className="painel-caminhos">
            {noutrosProjetos.map((p) => (
              <li key={p.slug}>
                <Link className="cartoes-accao" href={`/${p.slug}/admin/cartoes`}>
                  {p.name}
                </Link>
                <small>
                  {p.modelos === 1 ? '1 cartão' : `${p.modelos} cartões`}
                </small>
              </li>
            ))}
          </ul>
          <p className="painel-exemplo">
            Se quiser mesmo cartões próprios neste projeto, crie uma categoria em baixo — mas
            serão cartões novos, à parte dos que já existem.
          </p>
        </div>
      )}

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

      <GestaoDeCategorias
        categorias={categorias}
        ocupado={ocupado !== null}
        aEnviar={ocupado}
        aoEnviarCapa={(id, f) =>
          comErro(`capa-${id}`, async () => {
            await painelDeCartoes.enviarCapaDaCategoria(id, f)
            await carregar()
          })
        }
        aoCriar={(dados) =>
          comErro('categoria', async () => {
            await painelDeCartoes.criarCategoria(projectSlug, dados)
            await carregar()
          })
        }
        aoGuardar={(id, dados) =>
          comErro(`cat-${id}`, async () => {
            await painelDeCartoes.actualizarCategoria(id, dados)
            await carregar()
          })
        }
        aoRemover={(id) =>
          comErro(`rmcat-${id}`, async () => {
            await painelDeCartoes.removerCategoria(id)
            await carregar()
          })
        }
      />

      {/* Cala-se quando o aviso de cima já está a dizer para NÃO criar aqui —
          senão o ecrã manda fazer e não fazer a mesma coisa, com dois
          centímetros entre as duas frases. */}
      {categorias.length === 0 && noutrosProjetos.length === 0 && (
        <p className="painel-aviso">Crie uma categoria para começar a cadastrar cartões.</p>
      )}

      {/* Uma secção por categoria. O "+ Novo cartão" de cada uma cria o cartão
          DENTRO dela — é assim que os Adultos começam no Dia 1 e não no Dia 8. */}
      {categorias.map((categoria) => {
        const daCategoria = modelos.filter((m) => m.categoriaId === categoria.id)
        const semArte = daCategoria.filter((m) => m.aviso).length
        return (
          <section key={categoria.id} className="painel-bloco">
            <header className="painel-bloco-topo">
              <h2>
                {categoria.nome} ({daCategoria.length})
                {!categoria.ativo && <span className="painel-selo-falta">desativada</span>}
              </h2>
              <button
                type="button"
                className="cartoes-accao-secundaria painel-botao-curto"
                disabled={ocupado !== null}
                onClick={() =>
                  comErro('novo', async () => {
                    await painelDeCartoes.criarModelo(projectSlug, { categoriaId: categoria.id })
                    await carregar()
                  })
                }
              >
                + Novo cartão
              </button>
            </header>

            {daCategoria.length === 0 && (
              <p className="subtitulo">
                Ainda sem cartões. Enquanto estiver vazia, esta categoria não aparece no site.
              </p>
            )}

            {semArte > 0 && (
              <p className="painel-aviso">
                {semArte === 1
                  ? '1 cartão ainda não tem arte carregada.'
                  : `${semArte} cartões ainda não têm arte carregada.`}{' '}
                Sem arte, o PDF desse cartão não é gerado.
              </p>
            )}

            <ul className="painel-modelos">
              {daCategoria.map((m) => (
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
        )
      })}
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
        É o preço padrão. Uma categoria pode ter o seu próprio preço — veja em Categorias.
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

/**
 * As categorias: Crianças, Adultos, e as que ele criar.
 *
 * O cliente pediu em 11/09 para as poder criar sozinho, sem código. O que faz
 * uma categoria funcionar no site são os dois rótulos — como chamar uma pessoa
 * e várias —, e por isso o painel mostra a frase exacta que vai aparecer.
 * Escrever "casal" e ver "Envie a foto de cada casal" é a forma mais rápida de
 * perceber se ficou bem.
 */
function GestaoDeCategorias({
  categorias,
  ocupado,
  aEnviar,
  aoCriar,
  aoGuardar,
  aoRemover,
  aoEnviarCapa,
}: {
  categorias: CategoriaAdmin[]
  ocupado: boolean
  /** Qual acção está a correr, para o botão do cartaz dizer "A enviar…". */
  aEnviar: string | null
  aoCriar: (dados: Partial<CategoriaAdmin>) => void
  aoGuardar: (id: string, dados: Partial<CategoriaAdmin>) => void
  aoRemover: (id: string) => void
  aoEnviarCapa: (id: string, ficheiro: File) => void
}) {
  const [nome, definirNome] = useState('')
  const [singular, definirSingular] = useState('pessoa')
  const [plural, definirPlural] = useState('pessoas')

  return (
    <section className="painel-bloco">
      <h2>Categorias ({categorias.length})</h2>
      <p className="subtitulo">
        Cada categoria tem os seus próprios cartões. Uma categoria sem cartões
        ativos fica escondida do site até o primeiro cartão entrar.
      </p>

      <ul className="painel-categorias">
        {categorias.map((c) => (
          <LinhaDeCategoria
            key={c.id}
            categoria={c}
            ocupado={ocupado}
            aEnviar={aEnviar === `capa-${c.id}`}
            aoGuardar={(dados) => aoGuardar(c.id, dados)}
            aoRemover={() => aoRemover(c.id)}
            aoEnviarCapa={(f) => aoEnviarCapa(c.id, f)}
          />
        ))}
      </ul>

      <h3 className="painel-subtitulo">Nova categoria</h3>
      <div className="painel-campos">
        <label className="cartoes-campo">
          <span>Nome</span>
          <input
            type="text"
            value={nome}
            placeholder="Adultos"
            onChange={(e) => definirNome(e.target.value)}
          />
        </label>
        <label className="cartoes-campo">
          <span>Singular (ex.: pessoa)</span>
          <input type="text" value={singular} onChange={(e) => definirSingular(e.target.value)} />
        </label>
        <label className="cartoes-campo">
          <span>Plural (ex.: pessoas)</span>
          <input type="text" value={plural} onChange={(e) => definirPlural(e.target.value)} />
        </label>
      </div>
      <p className="painel-exemplo">
        No site vai aparecer: “Envie a foto de cada {singular.trim() || 'pessoa'}” e
        “{maiusculaDe(singular.trim() || 'pessoa')} 1, {maiusculaDe(singular.trim() || 'pessoa')} 2…”.
      </p>
      <button
        type="button"
        className="cartoes-accao"
        disabled={ocupado || !nome.trim()}
        onClick={() => {
          aoCriar({
            nome: nome.trim(),
            rotuloSingular: singular.trim(),
            rotuloPlural: plural.trim(),
          })
          definirNome('')
        }}
      >
        Criar categoria
      </button>
    </section>
  )
}

function maiusculaDe(texto: string): string {
  return texto ? texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1) : texto
}

function LinhaDeCategoria({
  categoria,
  ocupado,
  aEnviar,
  aoGuardar,
  aoRemover,
  aoEnviarCapa,
}: {
  categoria: CategoriaAdmin
  ocupado: boolean
  aEnviar: boolean
  aoGuardar: (dados: Partial<CategoriaAdmin>) => void
  aoRemover: () => void
  aoEnviarCapa: (ficheiro: File) => void
}) {
  const [aberta, definirAberta] = useState(false)
  const cartaz = useRef<HTMLInputElement | null>(null)
  const [nome, definirNome] = useState(categoria.nome)
  const [singular, definirSingular] = useState(categoria.rotuloSingular)
  const [plural, definirPlural] = useState(categoria.rotuloPlural)
  const [reais, definirReais] = useState(
    categoria.precoUnitarioCent == null ? '' : (categoria.precoUnitarioCent / 100).toFixed(2),
  )
  const [desconto, definirDesconto] = useState(
    categoria.descontoPercentagem == null ? '' : String(categoria.descontoPercentagem),
  )

  useEffect(() => {
    definirNome(categoria.nome)
    definirSingular(categoria.rotuloSingular)
    definirPlural(categoria.rotuloPlural)
    definirReais(
      categoria.precoUnitarioCent == null ? '' : (categoria.precoUnitarioCent / 100).toFixed(2),
    )
    definirDesconto(
      categoria.descontoPercentagem == null ? '' : String(categoria.descontoPercentagem),
    )
  }, [categoria])

  /** Em branco volta ao preço do projeto: por isso '' vira null, e nunca 0. */
  const emCentimos = (texto: string): number | null => {
    const t = texto.trim()
    if (!t) return null
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? Math.round(n * 100) : null
  }

  return (
    <li className={aberta ? 'painel-categoria aberta' : 'painel-categoria'}>
      <div className="painel-categoria-topo">
        {/*
          A MINIATURA DIZ DE RELANCE QUAL DELAS JÁ TEM CARTAZ.

          Sem ela é preciso abrir cada categoria para saber se a oferta está no
          ar. Com duas ainda se faz de cabeça; com as que ele vier a criar, não.
          O lugar vazio fica marcado a tracejado — é a mesma linguagem das casas
          por preencher na grade dos dias.
        */}
        {categoria.capaUrl ? (
          <img src={categoria.capaUrl} alt="" className="painel-categoria-miniatura" />
        ) : (
          <span className="painel-categoria-miniatura sem-arte" aria-hidden="true" />
        )}

        <span className="painel-categoria-nome">
          <strong>{categoria.nome}</strong>
          {!categoria.ativo && <span className="painel-selo-falta">desativada</span>}
          <small>
            {categoria.modelos === 1 ? '1 cartão' : `${categoria.modelos} cartões`} ·{' '}
            {categoria.precoUnitarioCent == null
              ? 'preço padrão'
              : (categoria.precoUnitarioCent / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
          </small>
        </span>

        {/*
          UM BOTÃO, E NÃO UMA PALAVRA AZUL ENCOSTADA À MARGEM.

          O que estava aqui era `cartoes-ligacao`: texto azul de 0,88rem no fim
          de uma linha que já dizia o nome, a contagem e o preço. Quem conhece o
          painel de cor não o encontrou à primeira — e é por esta porta que se
          chega à arte da oferta e ao preço de cada categoria.
        */}
        <button
          type="button"
          className="painel-categoria-editar"
          aria-expanded={aberta}
          onClick={() => definirAberta(!aberta)}
        >
          {aberta ? 'Fechar' : 'Editar'}
        </button>
      </div>

      {aberta && (
        <div className="painel-categoria-corpo">
          <div className="painel-campos">
            <label className="cartoes-campo">
              <span>Nome</span>
              <input type="text" value={nome} onChange={(e) => definirNome(e.target.value)} />
            </label>
            <label className="cartoes-campo">
              <span>Singular</span>
              <input type="text" value={singular} onChange={(e) => definirSingular(e.target.value)} />
            </label>
            <label className="cartoes-campo">
              <span>Plural</span>
              <input type="text" value={plural} onChange={(e) => definirPlural(e.target.value)} />
            </label>
          </div>
          <div className="painel-campos">
            <label className="cartoes-campo">
              <span>Preço próprio (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                value={reais}
                placeholder="padrão do projeto"
                onChange={(e) => definirReais(e.target.value)}
              />
            </label>
            <label className="cartoes-campo">
              <span>Desconto próprio (%)</span>
              <input
                type="text"
                inputMode="numeric"
                value={desconto}
                placeholder="padrão do projeto"
                onChange={(e) => definirDesconto(e.target.value)}
              />
            </label>
          </div>
          <p className="painel-exemplo">
            Deixe em branco para usar o preço e o desconto padrão do projeto.
          </p>

          {/*
            O CARTAZ DA OFERTA.

            É a arte que ele mandou em 24/09 com a frase "abaixo viria esta
            arte". Aparece por baixo da grade dos dias, na página do projeto, e
            quem toca nela cai já no editor desta categoria — que é a segunda
            frase dele, "quanto clica ja aparece o cartao para editar".

            Fica aqui, e não num ecrã novo, porque é a mesma decisão de sempre:
            o cartaz vende OS CARTÕES DESTA CATEGORIA, e o preço riscado que ele
            desenhou também se define nesta ficha. Num sítio só.
          */}
          <div className="painel-cartaz">
            <span className="bloco-rotulo">Arte da oferta</span>
            {categoria.capaUrl ? (
              <img src={categoria.capaUrl} alt="" className="painel-cartaz-previa" />
            ) : (
              <p className="painel-exemplo">
                Sem arte, a oferta não aparece na página do projeto.
              </p>
            )}
            <input
              ref={cartaz}
              type="file"
              accept="image/*"
              className="apenas-leitor-de-ecra"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) aoEnviarCapa(f)
                e.target.value = ''
              }}
            />
            <div className="painel-cartaz-accoes">
              <button
                type="button"
                className="cartoes-accao-secundaria"
                disabled={ocupado}
                onClick={() => cartaz.current?.click()}
              >
                {aEnviar ? 'A enviar…' : categoria.capaUrl ? 'Trocar arte' : 'Enviar arte'}
              </button>
              {categoria.capaUrl && (
                <button
                  type="button"
                  className="cartoes-ligacao"
                  disabled={ocupado}
                  onClick={() => aoGuardar({ capaUrl: null })}
                >
                  Tirar do site
                </button>
              )}
            </div>
            <p className="painel-exemplo">
              Aparece por baixo dos dias, na página do projeto. Quem tocar nela vai
              direito ao editor destes cartões.
            </p>
          </div>

          <div className="painel-modelo-accoes">
            <button
              type="button"
              className="cartoes-accao"
              disabled={ocupado || !nome.trim()}
              onClick={() =>
                aoGuardar({
                  nome: nome.trim(),
                  rotuloSingular: singular.trim(),
                  rotuloPlural: plural.trim(),
                  precoUnitarioCent: emCentimos(reais),
                  descontoPercentagem: desconto.trim() ? Number(desconto) : null,
                })
              }
            >
              Guardar
            </button>
            <label className="painel-activo">
              <input
                type="checkbox"
                checked={categoria.ativo}
                onChange={(e) => aoGuardar({ ativo: e.target.checked })}
              />
              <span>Ativa (aparece no site quando tiver cartões)</span>
            </label>
            {categoria.modelos === 0 ? (
              <button type="button" className="painel-perigo" disabled={ocupado} onClick={aoRemover}>
                Apagar categoria
              </button>
            ) : (
              <span className="painel-exemplo">
                Para apagar, remova os cartões primeiro — ou desative.
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
