'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { admin, painelDeCartoes, ROTULO_DO_ESTADO, type EstadoDoProjeto, type MeuProjeto } from '@/lib/admin'
import { ErroDeApi } from '@/lib/auth'
import { plural } from '@/lib/unidade'
import { IconeDoPainel } from './IconesDoPainel'
import { LinkDeCompra } from './LinkDeCompra'

const EXPLICACAO_DO_ESTADO: Record<EstadoDoProjeto, string> = {
  PUBLICADO: 'Aparece na página inicial do site, para toda a gente.',
  RASCUNHO: 'Escondido da página inicial. O endereço continua a abrir e os QR Codes continuam a funcionar.',
  ARQUIVADO: 'A página do projeto deixa de abrir no site. Nada é apagado.',
}

/**
 * AS CONFIGURAÇÕES DE UM PROJETO, num sítio só (03/10).
 *
 * Estavam espalhadas: a imagem, o mostrar e a quantidade de blocos em
 * "Projetos da página inicial", o link de compra no meio da lista longa, e o
 * nome e a descrição em lado nenhum. Ficam aqui, dentro do projeto, que é onde
 * ele as procura.
 */
export function ConfiguracoesDoProjeto({ projectSlug }: { projectSlug: string }) {
  const [projeto, definirProjeto] = useState<MeuProjeto | null>(null)
  const [linkDeCompra, definirLinkDeCompra] = useState<string | null | undefined>(undefined)
  const [nome, definirNome] = useState('')
  const [descricao, definirDescricao] = useState('')
  const [blocos, definirBlocos] = useState('')
  const [ocupado, definirOcupado] = useState<string | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)

  const usar = (p: MeuProjeto) => {
    definirProjeto(p)
    definirNome(p.nome)
    definirDescricao(p.descricao ?? '')
    definirBlocos(String(p.casas))
  }

  const recarregar = async () => {
    const lista = await admin.meusProjetos()
    const este = lista.find((p) => p.slug === projectSlug)
    if (!este) throw new Error('Este projeto não existe.')
    usar(este)
  }

  useEffect(() => {
    recarregar().catch((e) => definirErro(e instanceof Error ? e.message : 'Não foi possível carregar.'))
    admin
      .listar(projectSlug)
      .then((d) => definirLinkDeCompra(d.project.checkoutUrl ?? null))
      .catch(() => definirLinkDeCompra(undefined))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSlug])

  const fazer = async (chave: string, accao: () => Promise<void>, feito?: string) => {
    definirOcupado(chave)
    definirErro(null)
    definirAviso(null)
    try {
      await accao()
      if (feito) definirAviso(feito)
    } catch (e) {
      definirErro(e instanceof ErroDeApi || e instanceof Error ? e.message : 'Não foi possível guardar.')
    } finally {
      definirOcupado(null)
    }
  }

  if (!projeto) {
    return (
      <div className="cp">
        <Link className="adm-voltar" href={`/${projectSlug}/admin`}>
          <IconeDoPainel nome="voltar" tamanho={18} /> Projeto
        </Link>
        {erro ? <p className="erro">{erro}</p> : <p className="vazio">Carregando...</p>}
      </div>
    )
  }

  const unidade = projeto.unidade ?? 'Bloco'
  const textoMudou = nome.trim() !== projeto.nome || (descricao.trim() || null) !== (projeto.descricao ?? null)
  const numeroDeBlocos = Number(blocos)
  const blocosValidos = Number.isInteger(numeroDeBlocos) && numeroDeBlocos >= 0 && numeroDeBlocos <= 200

  return (
    <div className="cp">
      <Link className="adm-voltar" href={`/${projectSlug}/admin`}>
        <IconeDoPainel nome="voltar" tamanho={18} /> {projeto.nome}
      </Link>
      <header className="mp-cabecalho">
        <h1>Configurações do projeto</h1>
        <p>{projeto.nome}</p>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {aviso && <p className="pp-aviso ok">{aviso}</p>}

      <section className="cp-bloco">
        <h2>Nome e descrição</h2>
        <label className="np-campo">
          <span>Nome do projeto</span>
          <input type="text" value={nome} maxLength={120} onChange={(e) => definirNome(e.target.value)} />
        </label>
        <label className="np-campo">
          <span>Descrição curta</span>
          <textarea
            value={descricao}
            rows={2}
            maxLength={400}
            placeholder="Ex.: As grandes histórias da Bíblia contadas para crianças."
            onChange={(e) => definirDescricao(e.target.value)}
          />
        </label>
        <p className="cp-nota">
          Endereço: <strong>santtify.com/{projeto.slug}</strong> — não muda, porque está dentro dos QR Codes
          impressos.
        </p>
        <button
          type="button"
          className="pp-botao primario"
          disabled={!textoMudou || !nome.trim() || ocupado !== null}
          onClick={() =>
            fazer(
              'texto',
              async () => usar(await admin.actualizarProjeto(projectSlug, { nome: nome.trim(), descricao: descricao.trim() || null })),
              'Nome e descrição guardados.',
            )
          }
        >
          {ocupado === 'texto' ? 'Guardando...' : 'Guardar'}
        </button>
      </section>

      <section className="cp-bloco">
        <h2>Estado</h2>
        <div className="cp-estados" role="radiogroup" aria-label="Estado do projeto">
          {(['PUBLICADO', 'RASCUNHO', 'ARQUIVADO'] as const).map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={projeto.estado === e}
              className={`cp-estado${projeto.estado === e ? ' escolhido' : ''}`}
              disabled={ocupado !== null}
              onClick={() => {
                if (projeto.estado === e) return
                if (
                  e === 'ARQUIVADO' &&
                  !window.confirm(`Arquivar "${projeto.nome}"? A página do projeto deixa de abrir no site.`)
                ) {
                  return
                }
                void fazer(
                  'estado',
                  async () => usar(await admin.actualizarProjeto(projectSlug, { estado: e })),
                  `O projeto ficou: ${ROTULO_DO_ESTADO[e]}.`,
                )
              }}
            >
              <span className={`mp-estado ${e.toLowerCase()}`}>{ROTULO_DO_ESTADO[e]}</span>
              <small>{EXPLICACAO_DO_ESTADO[e]}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="cp-bloco">
        <h2>Imagem do projeto</h2>
        <div className="cp-imagem">
          <span className="pp-capa">
            {projeto.capa ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="mp-capa-fundo" src={projeto.capa} alt="" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="mp-capa-arte" src={projeto.capa} alt="" />
              </>
            ) : (
              <span className="mp-sem-capa">
                <IconeDoPainel nome="imagem" tamanho={30} />
                <small>Sem imagem</small>
              </span>
            )}
          </span>
          <div>
            <p className="cp-nota">
              A imagem que representa o projeto na página inicial e aqui no painel. Use uma imagem deitada, com
              pelo menos 1200 pixels de largura: ela aparece inteira, sem cortes.
            </p>
            <label className="pp-botao">
              <IconeDoPainel nome="imagem" tamanho={18} />
              {ocupado === 'imagem' ? 'Enviando...' : projeto.capa ? 'Trocar imagem' : 'Enviar imagem'}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={ocupado !== null}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  e.target.value = ''
                  if (!arquivo) return
                  void fazer(
                    'imagem',
                    async () => {
                      const asset = await admin.enviarArquivo(arquivo)
                      await painelDeCartoes.guardarCartaoDoCarrossel(projectSlug, { coverUrl: asset.url })
                      await recarregar()
                    },
                    'Imagem guardada.',
                  )
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {projeto.sequencia !== 'LETRAS' && (
        <section className="cp-bloco">
          <h2>Quantidade de {plural(unidade).toLowerCase()}</h2>
          <p className="cp-nota">
            Aumentar cria os que faltam. Diminuir não apaga nada: os que sobram saem da página e voltam se você
            aumentar de novo.
          </p>
          <div className="cp-linha">
            <input
              type="number"
              min={0}
              max={200}
              value={blocos}
              aria-label={`Quantidade de ${plural(unidade).toLowerCase()}`}
              onChange={(e) => definirBlocos(e.target.value)}
            />
            <button
              type="button"
              className="pp-botao primario"
              disabled={!blocosValidos || numeroDeBlocos === projeto.casas || ocupado !== null}
              onClick={() =>
                fazer(
                  'blocos',
                  async () => {
                    await painelDeCartoes.definirBlocos(projectSlug, numeroDeBlocos)
                    await recarregar()
                  },
                  `O projeto ficou com ${numeroDeBlocos} ${numeroDeBlocos === 1 ? unidade.toLowerCase() : plural(unidade).toLowerCase()}.`,
                )
              }
            >
              {ocupado === 'blocos' ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </section>
      )}

      <section className="cp-bloco">
        <h2>Link de compra</h2>
        {linkDeCompra === undefined ? (
          <p className="vazio">Carregando...</p>
        ) : (
          <LinkDeCompra
            projectSlug={projectSlug}
            atual={linkDeCompra}
            aoMudar={async () => {
              const d = await admin.listar(projectSlug)
              definirLinkDeCompra(d.project.checkoutUrl ?? null)
            }}
          />
        )}
      </section>
    </div>
  )
}
