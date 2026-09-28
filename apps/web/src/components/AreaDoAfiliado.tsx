'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/ProvedorDeAuth'
import { ErroDeApi } from '@/lib/auth'
import { diaEHora, fraccao, percentagem, reais } from '@/lib/dinheiro'
import {
  NOME_DO_ESTADO,
  afiliados,
  linkDoWhatsapp,
  type PainelDoAfiliado,
  type VendaDoAfiliado,
} from '@/lib/afiliados'

/** Os ícones da área, em traço, como os do mockup. */
function Simbolo({ nome }: { nome: 'moedas' | 'seta' | 'carrinho' | 'barras' | 'link' | 'copiar' | 'carteira' | 'relogio' | 'cadeado' | 'recibo' | 'whatsapp' }) {
  const tracos: Record<string, React.ReactNode> = {
    moedas: (
      <>
        <ellipse cx="12" cy="6" rx="7" ry="2.8" />
        <path d="M5 6v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 10v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4M5 14v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4" />
      </>
    ),
    seta: <path d="M6 18 18 6M9 6h9v9" />,
    carrinho: (
      <>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.5-6.8H6.2" />
      </>
    ),
    barras: <path d="M5 20v-6M10 20V9M15 20v-9M20 20V4" />,
    link: (
      <>
        <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
        <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
      </>
    ),
    copiar: (
      <>
        <rect x="8" y="8" width="12.5" height="12.5" rx="2.5" />
        <path d="M16 8V5.5A2 2 0 0 0 14 3.5H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8" />
      </>
    ),
    carteira: (
      <>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
        <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
        <path d="M16 13.5h2" />
      </>
    ),
    relogio: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    cadeado: (
      <>
        <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" />
      </>
    ),
    recibo: (
      <>
        <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21 6 19.4z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    whatsapp: (
      <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6zM9.2 8.4c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.2-.1.4 0 .6.7 1.2 1.6 2 2.8 2.6.2.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.3.3.6-.1.8-.9 1.6-1.8 1.7-2.8.2-6.2-2.9-6.6-5.6-.1-.9.3-1.5.5-1.7z" />
    ),
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tracos[nome]}
    </svg>
  )
}

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    const feito = document.execCommand('copy')
    campo.remove()
    return feito
  }
}

export function LinhaDeVenda({ venda }: { venda: VendaDoAfiliado }) {
  return (
    <li className="af-venda">
      <span className="af-venda-icone" aria-hidden="true">
        <Simbolo nome="recibo" />
      </span>
      <div className="af-venda-quem">
        <strong>{venda.comprador ?? 'Cliente'}</strong>
        <small>{diaEHora(venda.em)}</small>
      </div>
      <div className="af-venda-valor">
        <strong>{reais(venda.valorCent)}</strong>
        <small>Comissão: {reais(venda.comissaoCent)}</small>
      </div>
      <span className={`af-selo e-${venda.estado.toLowerCase()}`} title={venda.estado === 'PENDENTE' ? `Disponível em ${new Date(venda.liberaEm).toLocaleDateString('pt-BR')}` : undefined}>
        {NOME_DO_ESTADO[venda.estado]}
      </span>
    </li>
  )
}

/** Os números curtos (cliques, vendas) grandes; o dinheiro do tamanho que couber. */
function tamanho(texto: string): string {
  return texto.length <= 5 ? 'curto' : ''
}

/**
 * O coração da área: números, link, saldos. É o mesmo no perfil e na página
 * inteira do afiliado — dois sítios a desenhar a mesma coisa acabam sempre
 * diferentes.
 */
export function ResumoDoAfiliado({ painel }: { painel: PainelDoAfiliado }) {
  const [copia, definirCopia] = useState<'parado' | 'feito' | 'selecionado'>('parado')
  const a = painel.afiliado
  if (!a) return null
  const m = a.metricas

  return (
    <>
      {painel.estado === 'SUSPENSO' && (
        <p className="af-aviso">
          Sua área de afiliado está suspensa{a.motivoDaSuspensao ? `: ${a.motivoDaSuspensao}` : ''}. O link continua abrindo a loja,
          mas as vendas não geram comissão. Fale com o suporte.
        </p>
      )}
      {a.novidades && (
        <p className="af-novidade">
          Desde a sua última visita:{' '}
          {[
            a.novidades.vendas > 0 ? `${a.novidades.vendas} venda${a.novidades.vendas === 1 ? '' : 's'} nova${a.novidades.vendas === 1 ? '' : 's'}` : '',
            a.novidades.disponivelCent > 0 ? `${reais(a.novidades.disponivelCent)} ficaram disponíveis` : '',
          ]
            .filter(Boolean)
            .join(' e ')}
          .
        </p>
      )}

      <div className="af-metricas">
        {(
          [
            ['verde', 'seta', m.cliques.toLocaleString('pt-BR'), 'Cliques'],
            ['azul', 'carrinho', m.vendas.toLocaleString('pt-BR'), 'Vendas'],
            ['ambar', 'moedas', reais(m.geradaCent), 'Comissões'],
            ['roxo', 'barras', fraccao(m.conversao), 'Conversão'],
          ] as const
        ).map(([cor, icone, valor, rotulo]) => (
          <div key={rotulo} className={`af-metrica ${cor}`}>
            <Simbolo nome={icone} />
            <strong className={tamanho(valor)}>{valor}</strong>
            <span>{rotulo}</span>
          </div>
        ))}
      </div>

      <p className="af-rotulo">
        <Simbolo nome="link" /> Meu link de afiliado
      </p>
      <div className="af-link">
        <input id="af-link-campo" readOnly value={a.link} onFocus={(e) => e.currentTarget.select()} aria-label="Meu link de afiliado" />
        <button
          type="button"
          className="af-copiar"
          onClick={async () => {
            if (await copiarTexto(a.link)) {
              definirCopia('feito')
            } else {
              // Sem permissão para copiar (alguns navegadores dentro de apps):
              // deixa o link selecionado, para copiar com o dedo.
              const campo = document.getElementById('af-link-campo') as HTMLInputElement | null
              campo?.focus()
              campo?.select()
              definirCopia('selecionado')
            }
            setTimeout(() => definirCopia('parado'), 2200)
          }}
        >
          <Simbolo nome="copiar" /> {copia === 'feito' ? 'Copiado!' : copia === 'selecionado' ? 'Selecionado' : 'Copiar'}
        </button>
      </div>
      <a className="af-whatsapp" href={linkDoWhatsapp(a.mensagemDoWhatsapp)} target="_blank" rel="noopener noreferrer">
        <Simbolo nome="whatsapp" /> Compartilhar no WhatsApp
      </a>

      <div className="af-saldos">
        <div className="af-saldo verde">
          <Simbolo nome="carteira" />
          <div>
            <strong>{reais(m.aPagarCent)}</strong>
            <span>Saldo disponível</span>
          </div>
        </div>
        <div className="af-saldo ambar">
          <Simbolo nome="relogio" />
          <div>
            <strong>{reais(m.pendenteCent)}</strong>
            <span>Pendente ({painel.regras.diasDeCarencia} dias)</span>
          </div>
        </div>
        <div className="af-saldo roxo">
          <Simbolo nome="barras" />
          <div>
            <strong>{reais(m.recebidoCent)}</strong>
            <span>Total recebido</span>
          </div>
        </div>
      </div>
      {m.aDescontarCent > 0 && (
        <p className="af-nota">
          {reais(m.aDescontarCent)} de vendas reembolsadas depois de pagas serão descontados do próximo pagamento.
        </p>
      )}
      {a.proximaLiberacao && (
        <p className="af-nota">
          Próxima liberação: {reais(a.proximaLiberacao.valorCent)} em {new Date(a.proximaLiberacao.em).toLocaleDateString('pt-BR')}.
        </p>
      )}
    </>
  )
}

/**
 * A ÁREA "AFILIADO" DO PERFIL — o mockup do cliente de 25/09.
 *
 * Bloqueada até à primeira compra confirmada, e liberada sozinha quando o
 * Mercado Pago a confirma: ninguém aprova ninguém. Só aparece no perfil da
 * própria pessoa — as vendas e o saldo de alguém não são para os outros verem.
 */
export function AreaDoAfiliado({ projectSlug, pessoaId }: { projectSlug: string; pessoaId: string }) {
  const { usuario } = useAuth()
  const meu = !!usuario && usuario.id === pessoaId
  const [painel, definirPainel] = useState<PainelDoAfiliado | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [aberta, definirAberta] = useState(true)

  useEffect(() => {
    if (!meu) return
    try {
      if (localStorage.getItem('pv-afiliado-fechado') === '1') definirAberta(false)
    } catch {
      /* sem armazenamento: fica aberta */
    }
    afiliados
      .painel()
      .then((p) => {
        definirPainel(p)
        // As novidades mostram-se uma vez: a partir de agora contam do zero.
        if (p.afiliado?.novidades) void afiliados.marcarVisto().catch(() => undefined)
      })
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível abrir a sua área de afiliado.'))
  }, [meu])

  if (!meu) return null
  // Programa desligado e a pessoa sem área: não há nada a mostrar-lhe.
  if (painel && !painel.programaAtivo && painel.estado === 'BLOQUEADO') return null

  const alternar = () => {
    definirAberta((a) => {
      try {
        localStorage.setItem('pv-afiliado-fechado', a ? '1' : '0')
      } catch {
        /* idem */
      }
      return !a
    })
  }

  return (
    <section className="af-area" aria-labelledby="af-titulo">
      <button type="button" className="af-cabecalho" onClick={alternar} aria-expanded={aberta}>
        <span className="af-emblema" aria-hidden="true">
          <Simbolo nome="moedas" />
        </span>
        <h2 id="af-titulo">Afiliado</h2>
        <span className={`af-seta ${aberta ? 'aberta' : ''}`} aria-hidden="true">
          ⌃
        </span>
      </button>

      {aberta && (
        <div className="af-corpo">
          {erro && <p className="erro">{erro}</p>}
          {!painel && !erro && <p className="af-nota">Carregando...</p>}

          {painel?.estado === 'BLOQUEADO' && (
            <div className="af-bloqueado">
              <span className="af-cadeado" aria-hidden="true">
                <Simbolo nome="cadeado" />
              </span>
              <h3>Torne-se um afiliado</h3>
              <p>
                Para compartilhar seu link de afiliado e começar a ganhar comissões, você precisa comprar seu primeiro conjunto de
                cartões.
              </p>
              <Link className="af-comprar" href={painel.compraPath}>
                <Simbolo nome="carrinho" /> Comprar meu primeiro conjunto
              </Link>
              <p className="af-nota">
                Depois da compra, ganhe {percentagem(painel.regras.comissaoBp)} de cada venda feita pelo seu link.
              </p>
            </div>
          )}

          {painel?.afiliado && (
            <>
              <ResumoDoAfiliado painel={painel} />
              {!painel.afiliado.pix && (
                <Link className="af-aviso-pix" href={`/${projectSlug}/afiliado#pix`}>
                  Cadastre sua chave Pix para receber as comissões →
                </Link>
              )}
              <div className="af-titulo-vendas">
                <h3>Minhas vendas recentes</h3>
                <Link href={`/${projectSlug}/afiliado`}>Ver todas ›</Link>
              </div>
              {painel.afiliado.recentes.length === 0 ? (
                <p className="af-nota">Ainda sem vendas. Compartilhe o seu link: cada compra feita por ele aparece aqui.</p>
              ) : (
                <ul className="af-vendas">
                  {painel.afiliado.recentes.slice(0, 3).map((v) => (
                    <LinhaDeVenda key={v.id} venda={v} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

