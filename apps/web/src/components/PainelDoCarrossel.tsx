'use client'

import { useCallback, useEffect, useState } from 'react'
import { abreviarKM } from '@pv/cartoes'
import { admin, painelDeCartoes, type ProjetoNoPainel } from '@/lib/admin'
import { ErroDeApi } from '@/lib/auth'

/**
 * Os projetos da página inicial, no painel.
 *
 * Desde 19/09 a página mostra um projeto por linha, só com a imagem e os
 * números — pedido dele depois de ver a primeira versão no ar. O painel segue
 * isso, e passa a tratar de quatro coisas:
 *
 * 1. A IMAGEM HORIZONTAL de cada projeto. Agora é tudo o que a criança vê, por
 *    isso cada linha diz se ela falta.
 * 2. MOSTRAR OU ESCONDER cada projeto. O "31 Atributos de Deus" ainda não está
 *    pronto e não deve aparecer; escondido, continua a abrir pelo endereço e
 *    ele continua a trabalhar nele.
 * 3. A ORDEM, de cima para baixo. Os antigos destaques da esquerda e da direita
 *    deixaram de fazer sentido numa lista com um projeto por linha.
 * 4. CRIAR PROJETOS com a quantidade de blocos que quiser. O projeto novo
 *    entra na lista sozinho, escondido até ele o mostrar.
 */
export function PainelDoCarrossel() {
  const [projetos, definirProjetos] = useState<ProjetoNoPainel[]>([])
  const [aCarregar, definirACarregar] = useState(true)
  const [erro, definirErro] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)
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
    definirAviso(null)
    definirOcupado(chave)
    try {
      await accao()
    } catch (e) {
      definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível concluir.')
    } finally {
      definirOcupado(null)
    }
  }

  const mover = (indice: number, passo: -1 | 1) =>
    comErro(`mover-${indice}`, async () => {
      const ordem = projetos.map((p) => p.slug)
      const destino = indice + passo
      ;[ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]]
      definirProjetos(await painelDeCartoes.ordenarCarrossel(ordem))
    })

  const enviarImagem = (slug: string, arquivo: File) =>
    comErro(`imagem-${slug}`, async () => {
      const asset = await admin.enviarArquivo(arquivo)
      definirProjetos(await painelDeCartoes.guardarCartaoDoCarrossel(slug, { coverUrl: asset.url }))
      if (asset.width && asset.height && asset.width < asset.height) {
        definirAviso(
          'A imagem enviada está em pé. Ela aparece inteira na largura da tela, e em ' +
            'pé fica muito alta no telemóvel. Uma imagem deitada fica melhor.',
        )
      }
    })

  if (aCarregar) return <p className="subtitulo">A carregar…</p>

  const visiveis = projetos.filter((p) => p.publicado).length

  return (
    <div className="painel-cartoes">
      {erro && <p className="cartoes-erro">{erro}</p>}
      {aviso && <p className="sincronizador-aviso">{aviso}</p>}

      <section className="painel-bloco">
        <h2>
          Projetos na página inicial ({visiveis} à mostra de {projetos.length})
        </h2>
        <p className="subtitulo">
          Cada projeto aparece como uma imagem horizontal, com os números por baixo,
          na ordem desta lista. A imagem aparece inteira, sem cortes, na largura
          da tela: use uma imagem deitada, com pelo menos 1200 pixels de largura.
          Sem texto por baixo: a imagem é que mostra o que é o projeto.
        </p>

        <ul className="painel-projetos">
          {projetos.map((p, i) => (
            <li key={p.slug} className="painel-projeto painel-projeto-da-pagina">
              <div className="painel-projeto-miniatura" aria-hidden="true">
                {p.capa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.capa} alt="" />
                ) : (
                  <span>sem imagem</span>
                )}
              </div>

              <div className="painel-projeto-nome">
                <strong>
                  {i + 1}. {p.nome}
                  {!p.publicado && <span className="painel-selo-falta">escondido</span>}
                  {!p.capa && <span className="painel-selo-falta">falta a imagem</span>}
                </strong>
                <span className="painel-projeto-numeros">
                  👁 {abreviarKM(p.numeros.views)} · ♡ {abreviarKM(p.numeros.likes)} · 💬{' '}
                  {abreviarKM(p.numeros.comments)} · ↗ {abreviarKM(p.numeros.shares)}
                </span>
              </div>

              <div className="painel-projeto-accoes">
                <label className="painel-botao-destaque painel-enviar-imagem">
                  {ocupado === `imagem-${p.slug}` ? 'A enviar…' : p.capa ? 'Trocar imagem' : 'Enviar imagem'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={ocupado !== null}
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0]
                      e.target.value = ''
                      if (arquivo) void enviarImagem(p.slug, arquivo)
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={p.publicado ? 'painel-botao-destaque activo' : 'painel-botao-destaque'}
                  aria-pressed={p.publicado}
                  disabled={ocupado !== null}
                  onClick={() =>
                    comErro(`ver-${p.slug}`, async () => {
                      definirProjetos(
                        await painelDeCartoes.guardarCartaoDoCarrossel(p.slug, {
                          publicado: !p.publicado,
                        }),
                      )
                    })
                  }
                >
                  {p.publicado ? '✓ À mostra' : 'Mostrar'}
                </button>
                <button
                  type="button"
                  className="painel-botao-destaque"
                  aria-label={`Subir ${p.nome}`}
                  disabled={ocupado !== null || i === 0}
                  onClick={() => void mover(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="painel-botao-destaque"
                  aria-label={`Descer ${p.nome}`}
                  disabled={ocupado !== null || i === projetos.length - 1}
                  onClick={() => void mover(i, 1)}
                >
                  ↓
                </button>
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
            definirAviso(
              `✓ "${feito.nome}" criado com ${feito.blocos} blocos. Fica escondido até você carregar em Mostrar.`,
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
  aoCriar: (dados: { slug: string; nome: string; blocos: number }) => void
}) {
  const [nome, definirNome] = useState('')
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
        Você informa o nome e quantos blocos quer. O sistema cria os blocos, e o
        projeto entra na lista acima, escondido até você o mostrar.
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
        onClick={() => aoCriar({ slug, nome: nome.trim(), blocos })}
      >
        {ocupado ? 'A criar…' : `Criar projeto com ${blocos} bloco${blocos === 1 ? '' : 's'}`}
      </button>
    </section>
  )
}
