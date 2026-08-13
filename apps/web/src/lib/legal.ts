/**
 * Os dados do responsável e os números que aparecem nas páginas legais.
 *
 * Ficam num lugar só porque texto legal espalhado envelhece torto: muda o
 * e-mail de contato e sobra a versão antiga em três páginas diferentes.
 *
 * ATENÇÃO ao alterar: `RETENCAO_EVENTOS_DIAS` precisa continuar igual ao
 * `EVENT_RETENTION_DAYS` do servidor, e `VERSAO_DA_POLITICA` igual ao
 * `CONSENT_POLICY_VERSION`. Se divergirem, a página promete uma coisa e o
 * sistema faz outra — que é exatamente o que a lei não perdoa.
 */

/** PREENCHER: quem responde legalmente pelos dados. */
export const RESPONSAVEL = {
  nome: 'Rossandro Caxito',
  projeto: 'Jesus Alfabeto Saudável',
  email: 'contato@exemplo.pt',
  pais: 'Portugal',
}

/** Igual ao `CONSENT_POLICY_VERSION` do servidor. */
export const VERSAO_DA_POLITICA = '1.0.0'

/** Igual ao `EVENT_RETENTION_DAYS` do servidor (1095 = 3 anos). */
export const RETENCAO_EVENTOS_DIAS = 1095

export const ATUALIZADO_EM = '13 de agosto de 2026'
