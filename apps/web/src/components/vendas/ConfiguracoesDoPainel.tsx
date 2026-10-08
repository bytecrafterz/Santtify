'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErroDeApi } from '@/lib/auth'
import { dataEHora, percentagem, reais } from '@/lib/dinheiro'
import { vendas, type ConfiguracaoDeAfiliados } from '@/lib/vendas'
import { CabecalhoDaPagina, Carregando, useDados } from './comum'
import { SimulacoesDeGanhos } from '../SimulacaoDeGanhos'

/** "37,5" → 3750 pontos-base. Nulo se não for um número. */
function paraBp(texto: string): number | null {
  const n = Number(texto.trim().replace('%', '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** "50,00" → 5000 cêntimos. */
function paraCent(texto: string): number | null {
  const limpo = texto.trim().replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

const bpEmTexto = (bp: number) => (bp / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const centEmTexto = (c: number) => (c / 100).toFixed(2).replace('.', ',')

/**
 * CONFIGURAÇÕES — as regras do programa de afiliados, sem código.
 *
 * Estão aqui com os valores propostos em 28/09 (40%, 30 dias, 30 dias,
 * R$ 50); o cliente muda o que quiser. Tudo o que se muda vale para as vendas
 * SEGUINTES: cada comissão guarda a percentagem e o prazo do dia em que
 * nasceu.
 */
export function ConfiguracoesDoPainel({ projectSlug }: { projectSlug: string }) {
  const cfg = useDados(() => vendas.configuracao(), [])
  const [f, definirF] = useState<Record<string, string | boolean>>({})
  const [aGuardar, definirAGuardar] = useState(false)
  const [mensagem, definirMensagem] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    const c = cfg.dados
    if (!c) return
    definirF({
      ativo: c.ativo,
      comissao: bpEmTexto(c.comissaoBp),
      carencia: String(c.diasDeCarencia),
      atribuicao: String(c.diasDeAtribuicao),
      minimo: centEmTexto(c.minimoParaPagamentoCent),
      destino: c.destino ?? '',
      mensagem: c.mensagemDoWhatsapp,
      regulamento: c.regulamento ?? '',
      taxaPix: bpEmTexto(c.taxaPixBp),
      taxaCartao: bpEmTexto(c.taxaCartaoBp),
      email: c.emailDeAvisos ?? '',
      vagas: String(c.vagas),
      simKits: String(c.simulacaoKits),
    })
  }, [cfg.dados])

  const campo = (nome: string) => ({
    value: String(f[nome] ?? ''),
    onChange: (e: { target: { value: string } }) => definirF((x) => ({ ...x, [nome]: e.target.value })),
  })

  async function guardar() {
    const c = cfg.dados
    if (!c) return
    const comissaoBp = paraBp(String(f.comissao))
    const taxaPixBp = paraBp(String(f.taxaPix))
    const taxaCartaoBp = paraBp(String(f.taxaCartao))
    const minimo = paraCent(String(f.minimo))
    const carencia = Number(f.carencia)
    const atribuicao = Number(f.atribuicao)
    if (comissaoBp === null || comissaoBp < 0 || comissaoBp > 10_000) return definirMensagem({ ok: false, texto: 'A comissão é uma percentagem entre 0 e 100.' })
    if (!Number.isInteger(carencia) || carencia < 0 || carencia > 365) return definirMensagem({ ok: false, texto: 'O prazo de carência é um número de dias entre 0 e 365.' })
    if (!Number.isInteger(atribuicao) || atribuicao < 1 || atribuicao > 365) return definirMensagem({ ok: false, texto: 'A janela de atribuição é um número de dias entre 1 e 365.' })
    if (minimo === null || minimo < 0) return definirMensagem({ ok: false, texto: 'Escreva o mínimo em reais, por exemplo 50,00.' })
    if (taxaPixBp === null || taxaCartaoBp === null) return definirMensagem({ ok: false, texto: 'As taxas são percentagens, por exemplo 0,99.' })
    const vagas = Number(f.vagas)
    const simKits = Number(f.simKits)
    if (!Number.isInteger(vagas) || vagas < 0 || vagas > 100_000) return definirMensagem({ ok: false, texto: 'As vagas são um número inteiro, por exemplo 10.' })
    if (!Number.isInteger(simKits) || simKits < 1 || simKits > 100_000) return definirMensagem({ ok: false, texto: 'Os kits da simulação são um número inteiro, por exemplo 100.' })

    const dados: Partial<ConfiguracaoDeAfiliados> = {
      ativo: Boolean(f.ativo),
      comissaoBp,
      diasDeCarencia: carencia,
      diasDeAtribuicao: atribuicao,
      minimoParaPagamentoCent: minimo,
      destino: String(f.destino).trim() || null,
      mensagemDoWhatsapp: String(f.mensagem),
      regulamento: String(f.regulamento).trim() || null,
      taxaPixBp,
      taxaCartaoBp,
      emailDeAvisos: String(f.email).trim() || null,
      vagas,
      simulacaoKits: simKits,
    }
    // Só o que mudou: o registo de auditoria fica a dizer o que se mexeu.
    const mudou = Object.fromEntries(
      Object.entries(dados).filter(([k, v]) => (c as unknown as Record<string, unknown>)[k] !== v),
    ) as Partial<ConfiguracaoDeAfiliados>
    if (Object.keys(mudou).length === 0) return definirMensagem({ ok: true, texto: 'Nada mudou.' })

    definirAGuardar(true)
    definirMensagem(null)
    try {
      await vendas.guardarConfiguracao(mudou)
      cfg.recarregar()
      definirMensagem({ ok: true, texto: 'Salvo. As novas regras valem para as vendas a partir de agora.' })
    } catch (e) {
      definirMensagem({ ok: false, texto: e instanceof ErroDeApi ? e.message : 'Não foi possível salvar.' })
    } finally {
      definirAGuardar(false)
    }
  }

  const c = cfg.dados
  const exemplo = 'https://santtify.com/af/maria'
  const previa = String(f.mensagem ?? '').includes('{link}')
    ? String(f.mensagem).replaceAll('{link}', exemplo)
    : `${String(f.mensagem ?? '')} ${exemplo}`
  const bpAgora = paraBp(String(f.comissao ?? ''))
  // A prévia da simulação acompanha o que se escreve, antes de salvar.
  const previaDaSimulacao = c
    ? {
        ...c.simulacao,
        kits: Math.max(1, Math.round(Number(f.simKits) || 0)),
        comissaoBp: bpAgora ?? c.comissaoBp,
      }
    : null

  return (
    <>
      <CabecalhoDaPagina titulo="Configurações" subtitulo="As regras do programa de afiliados. Mudam sem mexer em código." />
      {cfg.erro && <p className="erro">{cfg.erro}</p>}
      {!c && cfg.aCarregar && <Carregando />}
      {c && (
        <form
          className="vd-config"
          onSubmit={(e) => {
            e.preventDefault()
            void guardar()
          }}
        >
          <section className="vd-cartao">
            <h2 className="vd-titulo-cartao">Programa de afiliados</h2>
            <label className="vd-interruptor">
              <input type="checkbox" checked={Boolean(f.ativo)} onChange={(e) => definirF((x) => ({ ...x, ativo: e.target.checked }))} />
              <span>
                <strong>Programa ligado</strong>
                <small>
                  Desligado, ninguém novo vê a área de afiliado nem ganha comissão. O que já foi ganho continua lá e ainda pode ser
                  pago.
                </small>
              </span>
            </label>
            <div className="vd-campos">
              <label>
                Comissão por venda (%)
                <input inputMode="decimal" {...campo('comissao')} />
                <small>
                  Sobre o valor pago pelo cliente, já com desconto.
                  {bpAgora !== null && ` Numa venda de R$ 49,00: ${reais(Math.round((4900 * bpAgora) / 10000))}.`}
                </small>
              </label>
              <label>
                Prazo até ficar disponível (dias)
                <input inputMode="numeric" {...campo('carencia')} />
                <small>A comissão fica pendente este tempo; se houver reembolso nele, é cancelada sozinha.</small>
              </label>
              <label>
                Janela da venda (dias)
                <input inputMode="numeric" {...campo('atribuicao')} />
                <small>A venda é do afiliado se a pessoa comprar até este número de dias depois de abrir o link dele.</small>
              </label>
              <label>
                Mínimo para pagamento (R$)
                <input inputMode="decimal" {...campo('minimo')} />
                <small>O financeiro destaca quem já passou deste valor. Pode pagar abaixo dele se quiser.</small>
              </label>
            </div>
          </section>

          {/*
            AS VAGAS E A SIMULAÇÃO (05/10).

            "Inicialmente serão liberadas apenas 10 vagas, e eu preciso ter no
            painel administrativo a opção de aumentar esse número quando quiser.
            Ao atingir o limite definido, novos cadastros ficam automaticamente
            bloqueados." E as duas simulações por baixo de cada perfil: os
            números delas mudam-se aqui, e a prévia mostra-as como aparecem.
          */}
          <section className="vd-cartao">
            <h2 className="vd-titulo-cartao">Vagas e simulação de ganhos</h2>
            <div className="vd-campos">
              <label>
                Vagas de afiliados
                <input inputMode="numeric" {...campo('vagas')} />
                <small>
                  {c.vagasOcupadas} {c.vagasOcupadas === 1 ? 'ocupada' : 'ocupadas'} agora. Ao chegar ao limite, ninguém novo vira
                  afiliado — nem pela compra, nem pelo botão Liberar. Aumente quando quiser abrir mais.
                </small>
              </label>
              <label>
                Kits vendidos na simulação
                <input inputMode="numeric" {...campo('simKits')} />
                <small>Em 30 dias. A comissão usada é a do programa, acima.</small>
              </label>
            </div>
            <p className="vd-nota">
              Os preços e o período da promoção são os dos cartões, e mudam-se em{' '}
              <Link href={`/${projectSlug}/admin/cartoes`}>Cartões personalizados › Preço e promoção</Link>. Como aparece
              por baixo da área de afiliado, no perfil de cada pessoa:
            </p>
            <div className="vd-previa-simulacao">
              {previaDaSimulacao && <SimulacoesDeGanhos simulacao={previaDaSimulacao} />}
            </div>
          </section>

          <section className="vd-cartao">
            <h2 className="vd-titulo-cartao">O link do afiliado</h2>
            <div className="vd-campos">
              <label className="largo">
                Para onde o link leva
                <input placeholder="Vazio = a página dos cartões" {...campo('destino')} />
                <small>
                  Um caminho do site, começado por &quot;/&quot;. Agora leva a: <code>{c.destinoResolvido ?? '—'}</code>. Mudar aqui muda
                  também os links que já foram compartilhados.
                </small>
              </label>
              <label className="largo">
                Mensagem do botão &quot;Compartilhar no WhatsApp&quot;
                <textarea rows={3} {...campo('mensagem')} />
                <small>
                  <code>{'{link}'}</code> é trocado pelo link de cada afiliado. Fica assim: <em>{previa}</em>
                </small>
              </label>
              <label className="largo">
                Regras para os afiliados (opcional)
                <textarea rows={6} placeholder="Aparece na área de cada afiliado, abaixo de &quot;Como funciona&quot;." {...campo('regulamento')} />
              </label>
            </div>
          </section>

          <section className="vd-cartao">
            <h2 className="vd-titulo-cartao">Taxas e avisos</h2>
            <div className="vd-campos">
              <label>
                Taxa estimada do Pix (%)
                <input inputMode="decimal" {...campo('taxaPix')} />
                <small>O Mercado Pago não informa a taxa do Pix no aviso; o painel estima a taxa com esta porcentagem.</small>
              </label>
              <label>
                Taxa estimada do cartão (%)
                <input inputMode="decimal" {...campo('taxaCartao')} />
                <small>Só quando o aviso do cartão não traz a taxa verdadeira — normalmente traz.</small>
              </label>
              <label className="largo">
                E-mail para o lembrete mensal de pagamentos
                <input type="email" placeholder="Vazio = sem lembrete por e-mail" {...campo('email')} />
                <small>No dia 1 de cada mês, a lista de quem tem saldo para receber. O financeiro mostra o mesmo a qualquer hora.</small>
              </label>
            </div>
          </section>

          <div className="vd-guardar">
            {mensagem && <p className={mensagem.ok ? 'vd-ok-texto' : 'erro'}>{mensagem.texto}</p>}
            <button type="submit" className="vd-botao primario" disabled={aGuardar}>
              {aGuardar ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <p className="vd-nota">
            Última alteração: {dataEHora(c.atualizadoEm)}. Comissão atual: {percentagem(c.comissaoBp)}. O preço dos cartões e o
            desconto são alterados em <Link href={`/${projectSlug}/admin/cartoes`}>Cartões personalizados</Link>.
          </p>
        </form>
      )}
    </>
  )
}
