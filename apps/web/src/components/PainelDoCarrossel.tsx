'use client'

import { useCallback, useEffect, useState } from 'react'
import { abreviarKM } from '@pv/cartoes'
import { painelDeCartoes, type ProjetoNoPainel } from '@/lib/admin'
import { ErroDeApi } from '@/lib/auth'

/**
 * O carrossel, no painel.
 *
 * Duas coisas que o cliente pediu por escrito e que passam a ser dele:
 *
 * 1. ESCOLHER OS DOIS DESTAQUES. Ele disse-o assim: "sou eu quem controla pelo
 *    painel quais são os dois projetos em destaque e posso trocar essas posições
 *    quando quiser". O que sai de um destaque não desaparece — cai para o meio
 *    do carrossel, como ele descreveu.
 *
 * 2. CRIAR PROJETOS com a quantidade de blocos que quiser. Sete, vinte, vinte e
 *    seis. O projeto novo aparece no carrossel sozinho, porque a lista é uma
 *    consulta e não uma lista escrita à mão.
 */
export function PainelDoCarrossel() {
  const [projetos, definirProjetos] = useState<ProjetoNoPainel[]>([])
  const [aCarregar, definirACarregar] = useState(true)
  const [erro, definirErro] = useState<string | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      definirProjetos(await painelDeCartoes.carrossel())
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível carregar.')
    } finally {
      definirACarregar(false)
    }
  }, [])

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

  const esquerda = projetos.find((p) => p.destaque === 'ESQUERDA')
  const direita = projetos.find((p) => p.destaque === 'DIREITA')

  return (
    <div className="painel-cartoes">
      {erro && <p className="cartoes-erro">{erro}</p>}

      <section className="painel-bloco">
        <h2>Os dois destaques</h2>
        <p className="subtitulo">
          São os dois primeiros do carrossel. O projeto que sai de uma posição
          continua no carrossel, mais à frente.
        </p>
        <div className="painel-destaques">
          <div className="painel-destaque">
            <span className="painel-destaque-rotulo">Esquerda</span>
            <strong>{esquerda?.nome ?? '— vazio —'}</strong>
          </div>
          <div className="painel-destaque">
            <span className="painel-destaque-rotulo">Direita</span>
            <strong>{direita?.nome ?? '— vazio —'}</strong>
          </div>
        </div>
      </section>

      <section className="painel-bloco">
        <h2>Projetos ({projetos.length})</h2>
        <ul className="painel-projetos">
          {projetos.map((p) => (
            <li key={p.slug} className="painel-projeto">
              <div className="painel-projeto-nome">
                <strong>
                  {p.nome}
                  {!p.publicado && <span className="painel-selo-falta">rascunho</span>}
                </strong>
                {p.tagline && <span>{p.tagline}</span>}
                <span className="painel-projeto-numeros">
                  👁 {abreviarKM(p.numeros.views)} · ♡ {abreviarKM(p.numeros.likes)} · 💬{' '}
                  {abreviarKM(p.numeros.comments)} · ↗ {abreviarKM(p.numeros.shares)}
                </span>
              </div>

              <div className="painel-projeto-accoes">
                {(['ESQUERDA', 'DIREITA'] as const).map((lado) => (
                  <button
                    key={lado}
                    type="button"
                    className={
                      p.destaque === lado
                        ? 'painel-botao-destaque activo'
                        : 'painel-botao-destaque'
                    }
                    disabled={ocupado !== null}
                    onClick={() =>
                      comErro(`d-${p.slug}`, async () => {
                        definirProjetos(
                          await painelDeCartoes.destacar(
                            p.slug,
                            p.destaque === lado ? null : lado,
                          ),
                        )
                      })
                    }
                  >
                    {lado === 'ESQUERDA' ? '◧ Esquerda' : '◨ Direita'}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <NovoProjeto
        ocupado={ocupado === 'novo'}
        aoCriar={(dados) =>
          comErro('novo', async () => {
            const feito = await painelDeCartoes.criarProjeto(dados)
            await carregar()
            definirErro(
              `✓ "${feito.nome}" criado com ${feito.blocos} blocos. Fica em rascunho até você publicar.`,
            )
          })
        }
      />
    </div>
  )
}

function NovoProjeto({
  ocupado,
  aoCriar,
}: {
  ocupado: boolean
  aoCriar: (dados: { slug: string; nome: string; blocos: number; tagline?: string }) => void
}) {
  const [nome, definirNome] = useState('')
  const [tagline, definirTagline] = useState('')
  const [blocos, definirBlocos] = useState(7)

  /**
   * O endereço sai do nome, e mostra-se antes de criar.
   *
   * É a parte que fica gravada dentro de cada QR Code impresso: mudá-la depois
   * invalida os QR que já foram para o papel. Melhor vê-la agora.
   */
  const slug = nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return (
    <section className="painel-bloco">
      <h2>Criar um projeto novo</h2>
      <p className="subtitulo">
        Você informa o nome e quantos blocos quer. O sistema cria os blocos e o
        projeto entra no carrossel sozinho.
      </p>

      <label className="cartoes-campo">
        <span>Nome do projeto</span>
        <input
          type="text"
          value={nome}
          placeholder="31 Atributos de Deus"
          onChange={(e) => definirNome(e.target.value)}
        />
      </label>

      <label className="cartoes-campo">
        <span>Frase curta (aparece no cartão do carrossel)</span>
        <input
          type="text"
          value={tagline}
          placeholder="Conheça e viva os atributos do nosso Deus"
          onChange={(e) => definirTagline(e.target.value)}
        />
      </label>

      <label className="cartoes-campo">
        <span>Quantos blocos</span>
        <input
          type="number"
          min={1}
          max={200}
          value={blocos}
          onChange={(e) => definirBlocos(Number(e.target.value))}
        />
      </label>

      {slug && (
        <p className="painel-exemplo">
          Endereço: <strong>/{slug}</strong> — fica dentro dos QR Codes impressos, por
          isso não se muda depois.
        </p>
      )}

      <button
        type="button"
        className="cartoes-accao"
        disabled={ocupado || !slug || blocos < 1}
        onClick={() => aoCriar({ slug, nome: nome.trim(), blocos, tagline: tagline.trim() })}
      >
        {ocupado ? 'A criar…' : `Criar projeto com ${blocos} bloco${blocos === 1 ? '' : 's'}`}
      </button>
    </section>
  )
}
