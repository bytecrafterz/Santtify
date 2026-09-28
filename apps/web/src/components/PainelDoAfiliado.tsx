'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/ProvedorDeAuth'
import { Voltar } from '@/components/Voltar'
import { ErroDeApi } from '@/lib/auth'
import { percentagem, reais } from '@/lib/dinheiro'
import {
  NOME_DA_CHAVE,
  afiliados,
  type PainelDoAfiliado as Painel,
  type TipoDeChavePix,
  type VendaDoAfiliado,
} from '@/lib/afiliados'
import { LinhaDeVenda, ResumoDoAfiliado } from './AreaDoAfiliado'

const EXEMPLO: Record<TipoDeChavePix, string> = {
  CPF: '000.000.000-00',
  CNPJ: '00.000.000/0000-00',
  EMAIL: 'voce@email.com',
  TELEFONE: '(11) 98765-4321',
  ALEATORIA: '0000aaaa-00aa-00aa-00aa-000000aaaaaa',
}

/**
 * A página inteira do afiliado: o resumo, todas as vendas, a chave Pix e as
 * regras. O perfil mostra o essencial; esta é o "Ver todas".
 */
export function PainelDoAfiliado({ projectSlug }: { projectSlug: string }) {
  const { usuario, carregando } = useAuth()
  const router = useRouter()
  const [painel, definirPainel] = useState<Painel | null>(null)
  const [erro, definirErro] = useState<string | null>(null)
  const [pagina, definirPagina] = useState(1)
  const [lista, definirLista] = useState<{ total: number; porPagina: number; vendas: VendaDoAfiliado[] } | null>(null)

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(`/${projectSlug}/entrar?voltar=` + encodeURIComponent(window.location.pathname))
      return
    }
    afiliados
      .painel()
      .then((p) => {
        definirPainel(p)
        if (p.afiliado) void afiliados.marcarVisto().catch(() => undefined)
      })
      .catch((e) => definirErro(e instanceof ErroDeApi ? e.message : 'Não foi possível abrir a sua área de afiliado.'))
  }, [usuario, carregando, projectSlug, router])

  useEffect(() => {
    if (!painel?.afiliado) return
    afiliados
      .vendas(pagina)
      .then(definirLista)
      .catch(() => definirLista(null))
  }, [painel?.afiliado, pagina])

  // Quem chega pelo "Cadastre sua chave Pix" desce direto ao formulário.
  useEffect(() => {
    if (painel && window.location.hash === '#pix') document.getElementById('pix')?.scrollIntoView({ behavior: 'smooth' })
  }, [painel])

  const perfil = usuario ? `/${projectSlug}/pessoa/${usuario.id}` : `/${projectSlug}`
  const paginas = lista ? Math.max(1, Math.ceil(lista.total / lista.porPagina)) : 1
  const r = painel?.regras

  return (
    <>
      <Voltar href={perfil}>Meu perfil</Voltar>
      <h1 className="af-pagina-titulo">Área do afiliado</h1>
      {erro && <p className="erro">{erro}</p>}
      {!painel && !erro && <p className="vazio">Carregando...</p>}

      {painel?.estado === 'BLOQUEADO' && (
        <div className="af-area">
          <div className="af-corpo">
            <div className="af-bloqueado">
              <h3>Torne-se um afiliado</h3>
              <p>
                {painel.programaAtivo
                  ? 'Para compartilhar seu link de afiliado e começar a ganhar comissões, você precisa comprar seu primeiro conjunto de cartões.'
                  : 'O programa de afiliados não está aceitando novas pessoas neste momento.'}
              </p>
              {painel.programaAtivo && (
                <Link className="af-comprar" href={painel.compraPath}>
                  Comprar meu primeiro conjunto
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {painel?.afiliado && (
        <>
          <div className="af-area">
            <div className="af-corpo">
              <ResumoDoAfiliado painel={painel} />
            </div>
          </div>

          <FormularioPix pix={painel.afiliado.pix} minimoCent={painel.regras.minimoParaPagamentoCent} />

          <section className="af-area">
            <div className="af-corpo">
              <div className="af-titulo-vendas">
                <h3>Todas as minhas vendas</h3>
                {lista && <span>{lista.total}</span>}
              </div>
              {!lista && <p className="af-nota">Carregando...</p>}
              {lista && lista.vendas.length === 0 && (
                <p className="af-nota">Ainda sem vendas. Compartilhe o seu link: cada compra feita por ele aparece aqui.</p>
              )}
              {lista && lista.vendas.length > 0 && (
                <ul className="af-vendas">
                  {lista.vendas.map((v) => (
                    <LinhaDeVenda key={v.id} venda={v} />
                  ))}
                </ul>
              )}
              {paginas > 1 && (
                <nav className="af-paginas" aria-label="Páginas de vendas">
                  <button type="button" disabled={pagina <= 1} onClick={() => definirPagina((p) => p - 1)}>
                    ‹ Anteriores
                  </button>
                  <span>
                    {pagina} de {paginas}
                  </span>
                  <button type="button" disabled={pagina >= paginas} onClick={() => definirPagina((p) => p + 1)}>
                    Seguintes ›
                  </button>
                </nav>
              )}
            </div>
          </section>
        </>
      )}

      {r && (
        <section className="af-area">
          <div className="af-corpo af-regras">
            <h3>Como funciona</h3>
            <ul>
              <li>
                Você ganha <strong>{percentagem(r.comissaoBp)}</strong> de cada compra feita pelo seu link, sobre o valor que o cliente pagou.
              </li>
              <li>
                A venda é sua se a pessoa comprar em até <strong>{r.diasDeAtribuicao} dias</strong> depois de abrir o seu link. Se ela abrir o
                link de outro afiliado depois, vale o último.
              </li>
              <li>
                A comissão fica <strong>pendente por {r.diasDeCarencia} dias</strong> e depois passa sozinha para o saldo disponível.
              </li>
              <li>
                Os pagamentos são feitos por <strong>Pix</strong>, na chave que você cadastrar, a partir de {reais(r.minimoParaPagamentoCent)}.
              </li>
              <li>Compras feitas por você mesmo não geram comissão.</li>
              <li>
                Se uma compra for reembolsada, a comissão dela é cancelada — ou, se já tiver sido paga, descontada do próximo pagamento.
              </li>
            </ul>
            {r.regulamento && <div className="af-regulamento">{r.regulamento}</div>}
          </div>
        </section>
      )}
    </>
  )
}

function FormularioPix({ pix, minimoCent }: { pix: NonNullable<Painel['afiliado']>['pix']; minimoCent: number }) {
  const [tipo, definirTipo] = useState<TipoDeChavePix>(pix?.tipo ?? 'CPF')
  const [chave, definirChave] = useState(pix?.chave ?? '')
  const [titular, definirTitular] = useState(pix?.titular ?? '')
  const [guardada, definirGuardada] = useState(pix)
  const [aGuardar, definirAGuardar] = useState(false)
  const [mensagem, definirMensagem] = useState<{ ok: boolean; texto: string } | null>(null)
  const [aEditar, definirAEditar] = useState(!pix)

  return (
    <section className="af-area" id="pix">
      <div className="af-corpo">
        <h3 className="af-subtitulo">Receber comissões</h3>
        {!aEditar && guardada ? (
          <div className="af-pix-guardada">
            <div>
              <small>{guardada.tipo ? NOME_DA_CHAVE[guardada.tipo] : 'Chave Pix'}</small>
              <strong>{guardada.chave}</strong>
              {guardada.titular && <small>{guardada.titular}</small>}
            </div>
            <button type="button" className="af-copiar" onClick={() => definirAEditar(true)}>
              Alterar
            </button>
          </div>
        ) : (
          <form
            className="af-pix"
            onSubmit={async (e) => {
              e.preventDefault()
              definirAGuardar(true)
              definirMensagem(null)
              try {
                const r = await afiliados.definirPix(tipo, chave, titular)
                definirGuardada(r)
                definirChave(r.chave)
                definirAEditar(false)
                definirMensagem({ ok: true, texto: 'Chave Pix salva.' })
              } catch (erro) {
                definirMensagem({ ok: false, texto: erro instanceof ErroDeApi ? erro.message : 'Não foi possível salvar.' })
              } finally {
                definirAGuardar(false)
              }
            }}
          >
            <label>
              Tipo da chave
              <select value={tipo} onChange={(e) => definirTipo(e.target.value as TipoDeChavePix)}>
                {(Object.keys(NOME_DA_CHAVE) as TipoDeChavePix[]).map((t) => (
                  <option key={t} value={t}>
                    {NOME_DA_CHAVE[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chave Pix
              <input
                value={chave}
                onChange={(e) => definirChave(e.target.value)}
                placeholder={EXEMPLO[tipo]}
                inputMode={tipo === 'CPF' || tipo === 'CNPJ' || tipo === 'TELEFONE' ? 'numeric' : tipo === 'EMAIL' ? 'email' : 'text'}
                autoComplete="off"
                required
              />
            </label>
            <label>
              Nome completo do titular
              <input value={titular} onChange={(e) => definirTitular(e.target.value)} autoComplete="name" required />
            </label>
            <button type="submit" className="af-comprar" disabled={aGuardar}>
              {aGuardar ? 'Salvando...' : 'Salvar chave Pix'}
            </button>
            {guardada && (
              <button type="button" className="af-botao-texto" onClick={() => definirAEditar(false)}>
                Cancelar
              </button>
            )}
          </form>
        )}
        {mensagem && <p className={mensagem.ok ? 'af-ok' : 'erro'}>{mensagem.texto}</p>}
        <p className="af-nota">
          Confira com cuidado: é para esta chave que vão os pagamentos, a partir de {reais(minimoCent)} disponíveis. Só você e a
          administração da Santtify veem a sua chave.
        </p>
      </div>
    </section>
  )
}
