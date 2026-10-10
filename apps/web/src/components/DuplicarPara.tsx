'use client'

import { useMemo, useState } from 'react'
import { admin, type CartaoAdmin, type VagaoAdmin } from '@/lib/admin'

/** Os nomes das quatro casas, quando o quadrado de destino ainda não existe. */
const CASAS = ['Explicação', 'Música', 'Repetição do versículo', 'Oração']

/** Um destino possível dentro de um dia. */
interface Destino {
  chave: string
  nome: string
  casa?: number
  destinoId?: string
  /** O que lá está será substituído. */
  ocupado: boolean
  /** É o próprio quadrado de onde se parte. */
  proprio: boolean
}

function temConteudo(c: CartaoAdmin) {
  return Boolean(c.imagem || c.audio || c.titulo?.trim() || c.descricao?.trim())
}

function nomeDoCartao(c: CartaoAdmin) {
  return c.nomeInterno?.trim() || c.titulo?.trim() || 'Publicação'
}

/**
 * DUPLICAR UM QUADRADO PARA OUTRO DIA (10/10).
 *
 * "Cada quadrado (Explicação, Música, Versículo e Oração) deve ter os três
 * pontinhos, permitindo duplicar individualmente e escolher o dia e o
 * quadrado de destino. Por exemplo, duplicar a Música do Dia 1 para a Música
 * do Dia 2, sem duplicar o dia inteiro."
 *
 * Dois passos, na ordem em que ele os disse: o dia, e depois o quadrado. O
 * quadrado começa no mesmo do original — Música vai para Música —, que é o
 * caso que ele deu como exemplo. Nos projetos sem as quatro casas (os dias do
 * Minha Identidade são cartões soltos) a escolha é um cartão que lá esteja, ou
 * uma publicação nova no fim do dia.
 *
 * Substituir o que já lá está pede uma palavra antes, aqui mesmo: o aviso
 * aparece por baixo da escolha, e não num `confirm` depois de carregar.
 */
export function DuplicarPara({
  cartao,
  casaDeOrigem,
  vagoes,
  unidade,
  aoConcluir,
  aoFechar,
}: {
  cartao: CartaoAdmin
  /** A casa (o dia, a letra) de onde o cartão sai. */
  casaDeOrigem: string
  vagoes: VagaoAdmin[]
  unidade: string
  aoConcluir: (r: { vagao: VagaoAdmin; id: string; nome: string }) => void
  aoFechar: () => void
}) {
  const comConteudo = vagoes.filter((v) => v.contentId)
  /** O projeto usa as quatro casas se alguma publicação as usa. */
  const usaCasas = vagoes.some((v) => v.cartoes.some((c) => c.slot !== null))
  const origem = comConteudo.findIndex((v) => v.casa === casaDeOrigem)
  // Começa no dia seguinte: duplicar para o mesmo dia é o caso raro.
  const [diaEscolhido, definirDiaEscolhido] = useState(
    comConteudo[origem + 1]?.casa ?? comConteudo[origem]?.casa ?? comConteudo[0]?.casa ?? '',
  )
  const vagao = comConteudo.find((v) => v.casa === diaEscolhido) ?? null

  const destinos = useMemo<Destino[]>(() => {
    if (!vagao) return []
    const lista: Destino[] = []
    if (usaCasas) {
      for (let casa = 1; casa <= CASAS.length; casa++) {
        const ali = vagao.cartoes.find((c) => c.papel === 'CARTAO' && c.slot === casa)
        lista.push({
          chave: `casa-${casa}`,
          nome: (ali && ali.nomeInterno?.trim()) || CASAS[casa - 1],
          casa,
          ocupado: Boolean(ali && temConteudo(ali)),
          proprio: ali?.id === cartao.id,
        })
      }
    }
    for (const c of vagao.cartoes.filter((x) => x.papel === 'CARTAO' && x.slot === null)) {
      lista.push({
        chave: c.id,
        nome: c.titulo?.trim() || nomeDoCartao(c),
        destinoId: c.id,
        ocupado: temConteudo(c),
        proprio: c.id === cartao.id,
      })
    }
    lista.push({ chave: 'nova', nome: `Nova publicação no fim d${unidade === 'Letra' ? 'a' : 'o'} ${vagao.rotulo}`, ocupado: false, proprio: false })
    return lista
  }, [vagao, usaCasas, cartao.id, unidade])

  const preferido = () => {
    if (cartao.slot !== null) {
      const mesma = destinos.find((d) => d.casa === cartao.slot && !d.proprio)
      if (mesma) return mesma.chave
    }
    return destinos.find((d) => d.chave === 'nova')?.chave ?? ''
  }
  const [escolha, definirEscolha] = useState<string | null>(null)
  const chave = escolha && destinos.some((d) => d.chave === escolha) ? escolha : preferido()
  const destino = destinos.find((d) => d.chave === chave) ?? null

  const [ocupado, definirOcupado] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  const nomeDaOrigem = nomeDoCartao(cartao)
  const rotuloDaOrigem = vagoes.find((v) => v.casa === casaDeOrigem)?.rotulo ?? ''

  async function duplicar() {
    if (!vagao?.contentId || !destino || destino.proprio) return
    definirOcupado(true)
    definirErro(null)
    try {
      const r = await admin.copiarCartaoPara(cartao.id, {
        contentId: vagao.contentId,
        ...(destino.casa ? { casa: destino.casa } : {}),
        ...(destino.destinoId ? { destinoId: destino.destinoId } : {}),
      })
      aoConcluir({ vagao, id: r.id, nome: destino.chave === 'nova' ? nomeDaOrigem : destino.nome })
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível duplicar agora.')
    } finally {
      definirOcupado(false)
    }
  }

  return (
    <div className="dp-fundo" role="presentation" onClick={() => !ocupado && aoFechar()}>
      <div
        className="dp-caixa"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dp-titulo">
          Duplicar {nomeDaOrigem}
          {rotuloDaOrigem && <small> d{unidade === 'Letra' ? 'a' : 'o'} {rotuloDaOrigem}</small>}
        </h2>
        {cartao.titulo?.trim() && <p className="dp-origem">“{cartao.titulo.trim()}”</p>}

        <label className="dp-campo">
          <span>1. Para qual {unidade.toLowerCase()}?</span>
          <select
            value={diaEscolhido}
            onChange={(e) => {
              definirDiaEscolhido(e.target.value)
              definirEscolha(null)
            }}
            disabled={ocupado}
          >
            {comConteudo.map((v) => (
              <option key={v.casa} value={v.casa}>
                {v.rotulo}
                {v.casa === casaDeOrigem ? ' (este mesmo)' : ''}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="dp-campo" disabled={ocupado}>
          <legend>2. Para qual quadrado?</legend>
          <div className="dp-opcoes">
            {destinos.map((d) => (
              <label key={d.chave} className={d.chave === chave ? 'dp-opcao escolhida' : 'dp-opcao'}>
                <input
                  type="radio"
                  name="dp-destino"
                  checked={d.chave === chave}
                  disabled={d.proprio}
                  onChange={() => definirEscolha(d.chave)}
                />
                <span>
                  {d.nome}
                  {d.proprio ? <em> — é este</em> : d.ocupado ? <em> — já tem conteúdo</em> : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {destino?.ocupado && !destino.proprio && (
          <p className="dp-aviso">
            {destino.nome} d{unidade === 'Letra' ? 'a' : 'o'} {vagao?.rotulo} já tem conteúdo. Vai ser
            substituído pela cópia.
          </p>
        )}
        <p className="dp-nota">
          Vão juntos a foto, o áudio, o título, a descrição e a letra do karaokê.
          {cartao.estado === 'PUBLICADO' ? ' A cópia já entra no ar.' : ' A cópia fica em rascunho, como o original.'}
        </p>
        {erro && <p className="erro">{erro}</p>}

        <div className="dp-accoes">
          <button type="button" className="secundario" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </button>
          <button
            type="button"
            className="botao-acao"
            onClick={() => void duplicar()}
            disabled={ocupado || !destino || destino.proprio}
          >
            {ocupado ? 'A duplicar...' : destino?.ocupado ? 'Substituir' : 'Duplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
