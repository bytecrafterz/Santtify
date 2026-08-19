'use client'

import { useEffect, useState } from 'react'
import { admin, type DenunciaAdmin } from '@/lib/admin'

const MOTIVO: Record<string, string> = {
  IMPROPRIO: 'Conteúdo impróprio',
  SENSUAL: 'Conteúdo sensual',
  BULLYING: 'Bullying ou ofensa',
  SPAM: 'Spam',
  DADOS_PESSOAIS: 'Exposição de dados pessoais',
  OUTRO: 'Outro',
}

const ALVO: Record<string, string> = {
  CONTENT: 'letra',
  BLOCK: 'faixa',
  COMMENT: 'comentário',
  POST: 'publicação',
  PROFILE: 'perfil',
}

/**
 * A fila de denúncias do administrador.
 *
 * As pendentes vêm primeiro, e é só isso que a ordenação faz: uma fila de
 * segurança serve para agir, e o que já foi decidido interessa como histórico,
 * não como trabalho por fazer.
 *
 * Tratada e descartada são registos diferentes de propósito. "Descartei porque
 * não era nada" e "vi e resolvi" contam histórias distintas sobre a plataforma,
 * e daqui a um ano a diferença entre as duas é o que diz se a moderação está a
 * funcionar ou a ser ignorada.
 */
export function FilaDeDenuncias({ projectSlug }: { projectSlug: string }) {
  const [denuncias, definirDenuncias] = useState<DenunciaAdmin[] | null>(null)
  const [ocupado, definirOcupado] = useState<string | null>(null)

  useEffect(() => {
    void admin
      .denuncias(projectSlug)
      .then((r) => definirDenuncias(r.reports))
      .catch(() => definirDenuncias([]))
  }, [projectSlug])

  async function decidir(d: DenunciaAdmin, status: 'REVIEWED' | 'DISMISSED') {
    definirOcupado(d.id)
    try {
      await admin.decidirDenuncia(d.id, status)
      definirDenuncias((lista) =>
        (lista ?? []).map((x) => (x.id === d.id ? { ...x, status } : x)),
      )
    } finally {
      definirOcupado(null)
    }
  }

  if (denuncias === null) return <p className="vazio">Carregando denúncias...</p>

  const pendentes = denuncias.filter((d) => d.status === 'PENDING')

  return (
    <section>
      <h2>
        Denúncias
        {pendentes.length > 0 && <span className="etiqueta-faixa">{pendentes.length} por ver</span>}
      </h2>

      {denuncias.length === 0 ? (
        <p className="vazio">Nenhuma denúncia até agora.</p>
      ) : (
        <ul className="lista">
          {denuncias.map((d) => (
            <li className="bloco moderacao-item" key={d.id}>
              <p className="moderacao-quem">
                {d.reporter?.displayName ?? 'Alguém sem conta'} · denunciou um{' '}
                {ALVO[d.targetType] ?? d.targetType}
                {d.status !== 'PENDING' && (
                  <em className="etiqueta-bloqueado">
                    {d.status === 'REVIEWED' ? 'tratada' : 'descartada'}
                  </em>
                )}
              </p>
              <p className="bloco-texto">
                <strong>{MOTIVO[d.reason] ?? d.reason}</strong>
                {d.note && <> — {d.note}</>}
              </p>
              {d.status === 'PENDING' && (
                <div className="moderacao-acoes">
                  <button
                    type="button"
                    disabled={ocupado === d.id}
                    onClick={() => decidir(d, 'REVIEWED')}
                  >
                    Tratei isto
                  </button>
                  <button
                    type="button"
                    className="secundario"
                    disabled={ocupado === d.id}
                    onClick={() => decidir(d, 'DISMISSED')}
                  >
                    Não era nada
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
