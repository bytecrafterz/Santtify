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

/**
 * Quem responde legalmente pelos dados.
 *
 * O ENDEREÇO VEM DO AMBIENTE, e é por uma razão séria: durante semanas as
 * páginas de privacidade e de termos publicaram `contato@exemplo.pt`, oito
 * vezes, num site com crianças e com metade do público em Portugal. Uma
 * política de privacidade que dá um endereço falso é pior do que não dar
 * nenhum: a lei obriga a haver por onde pedir os dados ou o apagamento deles, e
 * quem escrevesse para ali não falava com ninguém.
 *
 * Mudar isto exige publicar de novo — `NEXT_PUBLIC_*` fica gravado dentro do
 * JavaScript no momento do build. O `publicar.sh` recusa-se a publicar com o
 * endereço de exemplo.
 */
export const RESPONSAVEL = {
  nome: 'Rossandro Caxito',
  projeto: 'Jesus Alfabeto Saudável',
  email: process.env.NEXT_PUBLIC_CONTACTO_LEGAL ?? 'contato@exemplo.pt',
  pais: 'Portugal',
}

/** Igual ao `CONSENT_POLICY_VERSION` do servidor. */
export const VERSAO_DA_POLITICA = '1.0.0'

/** Igual ao `EVENT_RETENTION_DAYS` do servidor (1095 = 3 anos). */
export const RETENCAO_EVENTOS_DIAS = 1095

export const ATUALIZADO_EM = '13 de agosto de 2026'
