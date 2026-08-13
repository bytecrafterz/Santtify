'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { social, type EstadoSocial } from '@/lib/social'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * Curtir, comentar e compartilhar.
 *
 * Regra que o cliente descreveu e que está implementada aqui: qualquer pessoa
 * VÊ a atividade — números e comentários aparecem sem conta. Para PARTICIPAR é
 * preciso estar cadastrado. Quem chega pelo QR precisa perceber que existe
 * gente ali antes de decidir criar conta; esconder isso mataria a conversão.
 */
export function BarraSocial({
  contentId,
  projectId,
  projectSlug,
  titulo,
}: {
  contentId: string
  projectId: string
  projectSlug: string
  titulo: string
}) {
  const { usuario } = useAuth()
  /**
   * Começa com zeros em vez de `null` para a barra existir já no HTML da
   * primeira renderização. Antes ela só aparecia depois da resposta da API, e
   * numa rede ruim os botões surgiam de repente no meio da leitura — além de
   * empurrar o conteúdo para baixo quando chegavam.
   */
  const [estado, definirEstado] = useState<EstadoSocial>({
    curtidas: 0,
    comentarios: 0,
    compartilhamentos: 0,
    curtidoPorMim: false,
    lista: [],
  })
  const [ocupado, definirOcupado] = useState(false)
  const [aviso, definirAviso] = useState<string | null>(null)
  /** Link gerado, exibido quando não dá para copiar automaticamente. */
  const [linkGerado, definirLinkGerado] = useState<string | null>(null)
  const [caixaAberta, definirCaixaAberta] = useState(false)
  const [recado, definirRecado] = useState('')

  useEffect(() => {
    social.estado(contentId).then(definirEstado).catch(() => {
      // Sem rede a barra continua visível com zeros: melhor que sumir.
    })
  }, [contentId])

  async function curtir() {
    if (!usuario) return definirAviso('entrar')
    definirOcupado(true)
    try {
      const r = await social.curtir(contentId, projectId)
      definirEstado((e) => ({ ...e, curtidoPorMim: r.curtido, curtidas: r.total }))
    } catch {
      /* silencioso: curtida não vale um alerta na cara da criança */
    } finally {
      definirOcupado(false)
    }
  }

  /**
   * Compartilhar: gera o link rastreável e entrega ao sistema do aparelho.
   *
   * O link precisa ser gerado ANTES de abrir a folha de compartilhamento —
   * é ele que carrega a referência de quem compartilhou, e sem isso a
   * propagação vira tráfego anônimo e a cadeia se perde.
   */
  /**
   * Abre a caixa para a pessoa escrever um recado antes de enviar.
   *
   * O cliente pediu isso em 13/08, e o motivo é bom: "olha essa música que
   * estou ouvindo com meu filho" convence muito mais do que um link seco. O
   * recado vai no TEXTO da mensagem; a imagem e o título que aparecem no cartão
   * vêm da própria página, e são duas coisas diferentes que chegam juntas do
   * outro lado.
   */
  function abrirCaixaDeCompartilhar() {
    if (!usuario) return definirAviso('entrar')
    definirRecado('')
    definirCaixaAberta(true)
  }

  async function compartilhar(recadoDaPessoa: string) {
    if (!usuario) return definirAviso('entrar')
    definirCaixaAberta(false)
    definirOcupado(true)
    try {
      const { url } = await social.compartilhar(contentId, projectId, 'WHATSAPP')
      const recado = recadoDaPessoa.trim()
      const titulize = `${titulo} — Jesus Alfabeto Saudável`
      const texto = recado ? `${recado}\n\n${titulize}` : titulize

      // O link JÁ existe no servidor a esta altura. O que vem abaixo é só a
      // forma de entregá-lo à pessoa, e nenhuma dessas formas pode fazer o
      // compartilhamento "falhar" — ele já aconteceu.
      //
      // navigator.share e navigator.clipboard só existem em contexto seguro
      // (HTTPS). Em HTTP os dois são undefined, e a versão anterior estourava
      // aqui e mostrava erro mesmo com o link criado. Por isso o último
      // recurso é mostrar o endereço na tela para copiar à mão.
      let entregue = false
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: titulize, text: texto, url })
          entregue = true
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(recado ? `${texto}\n${url}` : url)
          definirAviso('copiado')
          setTimeout(() => definirAviso(null), 2500)
          entregue = true
        }
      } catch (erroEntrega) {
        // Cancelar a folha de compartilhamento dispara AbortError: não é erro,
        // e nesse caso a pessoa desistiu de propósito.
        if ((erroEntrega as Error)?.name === 'AbortError') entregue = true
      }

      if (!entregue) definirLinkGerado(url)
      definirEstado((e) => ({ ...e, compartilhamentos: e.compartilhamentos + 1 }))
    } catch {
      // Só chega aqui se a API falhou — aí o link realmente não existe.
      definirAviso('erro')
    } finally {
      definirOcupado(false)
    }
  }

  return (
    <>
      <div className="barra-social">
        <button
          type="button"
          onClick={curtir}
          disabled={ocupado}
          aria-pressed={estado.curtidoPorMim}
          className={estado.curtidoPorMim ? 'acao curtido' : 'acao'}
        >
          <span aria-hidden>{estado.curtidoPorMim ? '♥' : '♡'}</span>
          {estado.curtidas}
          <small>curtidas</small>
        </button>

        <a href="#comentarios" className="acao">
          <span aria-hidden>💬</span>
          {estado.comentarios}
          <small>comentários</small>
        </a>

        <button
          type="button"
          onClick={abrirCaixaDeCompartilhar}
          disabled={ocupado}
          className="acao"
        >
          <span aria-hidden>↗</span>
          {estado.compartilhamentos}
          <small>compartilhar</small>
        </button>
      </div>

      {aviso === 'entrar' && (
        <p className="aviso-social">
          <Link href={`/${projectSlug}/entrar`}>Entre na sua conta</Link> para curtir, comentar e
          compartilhar.
        </p>
      )}
      {aviso === 'copiado' && <p className="aviso-social">Link copiado. É só colar e enviar.</p>}
      {aviso === 'erro' && <p className="aviso-social">Não deu para compartilhar agora.</p>}

      {caixaAberta && (
        <div className="bloco caixa-compartilhar">
          <span className="bloco-rotulo">Compartilhar</span>
          <p className="nota">
            Escreva um recado, se quiser. Quem receber vê o seu texto e a imagem desta letra,
            e ao tocar no link abre direto aqui.
          </p>
          <textarea
            value={recado}
            onChange={(e) => definirRecado(e.target.value)}
            placeholder="Olha essa música que estou ouvindo com meu filho"
            rows={3}
            maxLength={300}
            autoFocus
          />
          <div className="publicar-acoes">
            <button
              type="button"
              className="secundario"
              onClick={() => definirCaixaAberta(false)}
            >
              Cancelar
            </button>
            <button type="button" onClick={() => compartilhar(recado)} disabled={ocupado}>
              {ocupado ? 'Preparando...' : 'Compartilhar'}
            </button>
          </div>
        </div>
      )}

      {linkGerado && (
        <div className="aviso-social">
          <p style={{ margin: '0 0 8px' }}>Seu link de compartilhamento:</p>
          <input
            readOnly
            value={linkGerado}
            onFocus={(e) => e.currentTarget.select()}
            className="link-gerado"
          />
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>
            Toque no endereço para selecionar e copiar.
          </p>
        </div>
      )}

      {/* O My Post saiu da interface em 12/08, a pedido do cliente: o MVP fica
          em ver, curtir, comentar e compartilhar, sem publicação própria. O
          componente e a API continuam de pé, sem tela apontando para eles —
          este cliente já mudou de direção quatro vezes, e reconstruir custa
          enquanto deixar parado não custa. Ver docs/PROGRESSO.md. */}

      <Comentarios
        contentId={contentId}
        projectId={projectId}
        projectSlug={projectSlug}
        inicial={estado.lista}
        aoMudarTotal={(n) => definirEstado((e) => ({ ...e, comentarios: n }))}
      />
    </>
  )
}

function Comentarios({
  contentId,
  projectId,
  projectSlug,
  inicial,
  aoMudarTotal,
}: {
  contentId: string
  projectId: string
  projectSlug: string
  inicial: EstadoSocial['lista']
  aoMudarTotal: (n: number) => void
}) {
  const { usuario } = useAuth()
  const [lista, definirLista] = useState(inicial)

  // `inicial` chega vazio no primeiro paint e preenchido quando a API responde.
  useEffect(() => definirLista(inicial), [inicial])
  const [texto, definirTexto] = useState('')
  const [enviando, definirEnviando] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    const corpo = texto.trim()
    if (!corpo) return
    definirEnviando(true)
    definirErro(null)
    try {
      const novo = await social.comentar(contentId, projectId, corpo)
      const atualizada = [...lista, novo]
      definirLista(atualizada)
      aoMudarTotal(atualizada.length)
      definirTexto('')
    } catch (e) {
      definirErro(e instanceof Error ? e.message : 'Não foi possível comentar')
    } finally {
      definirEnviando(false)
    }
  }

  async function remover(id: string) {
    if (!confirm('Apagar este comentário?')) return
    await social.removerComentario(id)
    const atualizada = lista.filter((c) => c.id !== id)
    definirLista(atualizada)
    aoMudarTotal(atualizada.length)
  }

  return (
    <section id="comentarios" className="comentarios">
      <h2>Comentários</h2>

      {lista.length === 0 && <p className="bloco-vazio">Nenhum comentário ainda. Seja o primeiro.</p>}

      <ul className="lista">
        {lista.map((c) => (
          <li className="bloco comentario" key={c.id}>
            <div className="avatar pequeno" aria-hidden>
              {c.user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="corpo-comentario">
              <strong>{c.user.displayName}</strong>
              <p className="bloco-texto">{c.body}</p>
              <small>
                {new Date(c.createdAt).toLocaleDateString('pt-PT', {
                  day: '2-digit',
                  month: 'short',
                })}
                {usuario?.id === c.user.id && (
                  <>
                    {' · '}
                    <button type="button" className="remover" onClick={() => remover(c.id)}>
                      apagar
                    </button>
                  </>
                )}
              </small>
            </div>
          </li>
        ))}
      </ul>

      {usuario ? (
        <form className="formulario-comentario" onSubmit={enviar}>
          <textarea
            value={texto}
            onChange={(e) => definirTexto(e.target.value)}
            placeholder="Escreva um comentário"
            rows={3}
            maxLength={2000}
          />
          {erro && <p className="erro">{erro}</p>}
          <button type="submit" disabled={enviando || !texto.trim()}>
            {enviando ? 'Enviando...' : 'Comentar'}
          </button>
        </form>
      ) : (
        <p className="aviso-social">
          <Link href={`/${projectSlug}/entrar`}>Entre na sua conta</Link> para comentar.
        </p>
      )}
    </section>
  )
}
