'use client'

import { useCallback, useEffect, useState } from 'react'
import { admin, type PedidoDeReposicao } from '@/lib/admin'
import { useAuth } from './ProvedorDeAuth'

/**
 * Quem ficou sem entrar — a lista do responsável.
 *
 * Existe por causa de 23/08: a irmã do cliente não conseguiu recuperar a senha
 * e ele só soube porque ela lhe telefonou. A observação dele é a que manda
 * aqui — se acontecesse a cem desconhecidos, ninguém saberia, e pareceria
 * desinteresse quando era avaria.
 *
 * O NÚMERO GRANDE É DE PESSOAS, e não de pedidos. Alguém que tenta três vezes
 * é uma pessoa em apuros, e não três; contar pedidos faria um problema de uma
 * pessoa parecer três vezes maior do que é, e o inverso também — dez pessoas
 * que tentam uma vez cada valem mais atenção do que uma que tentou dez.
 *
 * Os pedidos de endereços SEM CONTA aparecem à parte e não geram link nenhum.
 * Não são ruído: ou a pessoa escreveu mal, ou pensa que se registou e não se
 * registou. As duas coisas perdem-se em silêncio, e as duas se resolvem
 * falando com ela.
 */
export function AjudaESuporte({ projectSlug }: { projectSlug: string }) {
  const { carregando: aRestaurarSessao } = useAuth()
  const [pedidos, definirPedidos] = useState<PedidoDeReposicao[]>([])
  const [resumo, definirResumo] = useState({ porAtender: 0, pessoasAfectadas: 0, semConta: 0 })
  const [carregando, definirCarregando] = useState(true)
  const [erro, definirErro] = useState<string | null>(null)
  const [links, definirLinks] = useState<Record<string, string>>({})
  const [copiado, definirCopiado] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const r = await admin.pedidosDeReposicao(projectSlug)
      definirPedidos(r.pedidos)
      definirResumo(r.resumo)
      definirErro(null)
    } catch {
      definirErro('Não foi possível carregar os pedidos.')
    } finally {
      definirCarregando(false)
    }
  }, [projectSlug])

  // Espera pela sessão antes de perguntar: o access token só vive em memória e
  // ao abrir a página ainda não existe.
  useEffect(() => {
    if (aRestaurarSessao) return
    void recarregar()
  }, [recarregar, aRestaurarSessao])

  async function atender(p: PedidoDeReposicao) {
    try {
      const r = await admin.atenderPedido(p.id)
      definirLinks((l) => ({ ...l, [p.id]: r.url }))
      await recarregar()
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível gerar o link.')
    }
  }

  async function copiar(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url)
      definirCopiado(id)
      window.setTimeout(() => definirCopiado(null), 2500)
    } catch {
      // Sem área de transferência, o link fica à vista para copiar à mão.
    }
  }

  const porAtender = pedidos.filter((p) => !p.atendidoEm && !p.usedAt)
  const tratados = pedidos.filter((p) => p.atendidoEm || p.usedAt)

  return (
    <section className="ajuda-suporte">
      <div className="resumo-suporte">
        <span className={resumo.pessoasAfectadas ? 'contador alerta' : 'contador'}>
          <strong>{resumo.pessoasAfectadas}</strong>
          <small>{resumo.pessoasAfectadas === 1 ? 'pessoa à espera' : 'pessoas à espera'}</small>
        </span>
        <span className="contador">
          <strong>{resumo.semConta}</strong>
          <small>com e-mail sem conta</small>
        </span>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {(carregando || aRestaurarSessao) && <p className="nota">A carregar...</p>}

      {!carregando && porAtender.length === 0 && (
        <p className="nota-ok">
          Ninguém está à espera. Nos últimos 30 dias não houve pedidos por atender.
        </p>
      )}

      {porAtender.map((p) => (
        <article key={p.id} className="pedido">
          <div className="cabeca-pedido">
            <strong>{p.emailPedido}</strong>
            <small>{new Date(p.createdAt).toLocaleString('pt-PT')}</small>
          </div>

          {p.user ? (
            <>
              <p className="nota">Conta de {p.user.displayName}.</p>
              {links[p.id] ? (
                <div className="link-gerado">
                  {/* O link só se vê UMA vez. Depois de sair desta tela, não
                      há como o voltar a ver — o servidor guarda um resumo, e
                      não o link. Se se perder, gera-se outro. */}
                  <p className="nota">
                    Mande este link à pessoa. Vale 24 horas e serve uma vez só.
                  </p>
                  <code>{links[p.id]}</code>
                  <button
                    type="button"
                    className="botao-acao"
                    onClick={() => void copiar(p.id, links[p.id])}
                  >
                    {copiado === p.id ? '✓ COPIADO' : 'COPIAR LINK'}
                  </button>
                </div>
              ) : (
                <button type="button" className="botao-acao" onClick={() => void atender(p)}>
                  GERAR LINK DE ACESSO
                </button>
              )}
            </>
          ) : (
            <p className="nota">
              Não existe conta com este endereço. Fale com a pessoa: ou escreveu mal, ou ainda não
              se registou.
            </p>
          )}
        </article>
      ))}

      {tratados.length > 0 && (
        <details className="ja-tratados">
          <summary>Já tratados ({tratados.length})</summary>
          <ul>
            {tratados.map((p) => (
              <li key={p.id}>
                <strong>{p.emailPedido}</strong>{' '}
                <small>{p.usedAt ? 'entrou com a senha nova' : 'link gerado, à espera'}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
