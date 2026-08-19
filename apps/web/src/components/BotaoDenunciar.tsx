'use client'

import { useState } from 'react'
import { social, type AlvoDeDenuncia, type MotivoDeDenuncia } from '@/lib/social'

/**
 * O escudo vermelho: bloquear e denunciar.
 *
 * Os seis motivos são os que o cliente listou em 19/08, pela mesma ordem.
 * Cada um é um botão inteiro e não uma opção de lista, porque quem denuncia
 * está incomodado e a decidir depressa — obrigar a escolher e só depois
 * confirmar acrescenta um passo no pior momento possível.
 *
 * O bloqueio é imediato e independente da decisão do administrador: quem
 * denuncia não deve ter de esperar por uma análise para deixar de ver quem o
 * incomodou. E é só do lado dele — bloquear é "não me mostres", nunca "apaga
 * para todos", senão a decisão de uma pessoa censurava a plataforma inteira.
 */
const MOTIVOS: { valor: MotivoDeDenuncia; rotulo: string; icone: string }[] = [
  { valor: 'IMPROPRIO', rotulo: 'Conteúdo impróprio', icone: '⚠️' },
  { valor: 'SENSUAL', rotulo: 'Conteúdo sensual', icone: '💜' },
  { valor: 'BULLYING', rotulo: 'Bullying ou ofensa', icone: '🚫' },
  { valor: 'SPAM', rotulo: 'Spam', icone: '✉️' },
  { valor: 'DADOS_PESSOAIS', rotulo: 'Exposição de dados pessoais', icone: '🪪' },
  { valor: 'OUTRO', rotulo: 'Outro', icone: '💬' },
]

export function BotaoDenunciar({
  projectId,
  targetType,
  targetId,
  podeBloquear = false,
}: {
  projectId: string
  targetType: AlvoDeDenuncia
  targetId: string
  /** Só faz sentido bloquear um perfil, não uma letra. */
  podeBloquear?: boolean
}) {
  const [aberto, definirAberto] = useState(false)
  const [motivo, definirMotivo] = useState<MotivoDeDenuncia | null>(null)
  const [bloquear, definirBloquear] = useState(podeBloquear)
  const [nota, definirNota] = useState('')
  const [enviando, definirEnviando] = useState(false)
  const [pronto, definirPronto] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)

  function fechar() {
    definirAberto(false)
    definirMotivo(null)
    definirNota('')
    definirErro(null)
  }

  async function enviar() {
    if (!motivo) return
    definirEnviando(true)
    try {
      await social.denunciar({
        projectId,
        targetType,
        targetId,
        reason: motivo,
        note: nota || undefined,
        bloquear: podeBloquear && bloquear,
      })
      definirPronto(true)
      fechar()
    } catch {
      definirErro('Não foi possível enviar agora. Tente de novo.')
    } finally {
      definirEnviando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="escudo"
        title="Bloquear e denunciar"
        aria-label="Bloquear e denunciar"
        onClick={() => definirAberto(true)}
      >
        🛡
      </button>

      {pronto && <span className="nota-ok">Denúncia enviada.</span>}

      {aberto && (
        <div className="fundo-modal" role="dialog" aria-modal="true" aria-label="Bloquear e denunciar">
          <button type="button" className="fundo-clicavel" aria-label="Fechar" onClick={fechar} />

          <div className="folha-denuncia">
            <header>
              <span className="escudo grande" aria-hidden>
                🛡
              </span>
              <div>
                <h2>Bloquear e denunciar</h2>
                <p className="nota">Qual o motivo?</p>
              </div>
              <button type="button" className="fechar-x" aria-label="Fechar" onClick={fechar}>
                ✕
              </button>
            </header>

            <ul className="motivos">
              {MOTIVOS.map((m) => (
                <li key={m.valor}>
                  <button
                    type="button"
                    className={motivo === m.valor ? 'motivo escolhido' : 'motivo'}
                    onClick={() => definirMotivo(m.valor)}
                    aria-pressed={motivo === m.valor}
                  >
                    <span aria-hidden>{m.icone}</span>
                    <span className="rotulo">{m.rotulo}</span>
                    <span aria-hidden>›</span>
                  </button>
                </li>
              ))}
            </ul>

            {motivo === 'OUTRO' && (
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="Conte o que aconteceu"
                value={nota}
                onChange={(ev) => definirNota(ev.target.value)}
              />
            )}

            {podeBloquear && (
              <label className="alternar-bloqueio">
                <input
                  type="checkbox"
                  checked={bloquear}
                  onChange={(ev) => definirBloquear(ev.target.checked)}
                />
                <span>
                  <strong>Bloquear este perfil</strong>
                  <small>O perfil deixa de aparecer para você.</small>
                </span>
              </label>
            )}

            {erro && <p className="erro">{erro}</p>}

            <div className="acoes-denuncia">
              <button type="button" className="secundario" onClick={fechar}>
                Cancelar
              </button>
              <button type="button" onClick={enviar} disabled={!motivo || enviando}>
                {enviando ? 'A enviar...' : 'Enviar denúncia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
