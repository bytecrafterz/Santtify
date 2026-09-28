/**
 * Quem abre um link sem ser uma pessoa.
 *
 * Quando o afiliado cola o link no WhatsApp, o próprio WhatsApp vai buscá-lo
 * para montar a pré-visualização — e o mesmo fazem o Telegram, o Facebook, o
 * Discord. Cada um desses era um "clique" no painel dele, e a taxa de
 * conversão descia sem que uma única pessoa tivesse aberto o link.
 *
 * Os navegadores dentro das aplicações (o do Instagram, o do Facebook) NÃO
 * estão aqui: esses são pessoas a tocar no link, e contam.
 */

/**
 * "Googlebot/2.1", "TelegramBot (like...", "Slackbot-LinkExpanding".
 *
 * Com maiúsculas e minúsculas contadas de propósito: o telemóvel CUBOT diz
 * "CUBOT X20" no agente, e uma busca sem distinção de maiúsculas tratava os
 * donos dele como robôs.
 */
const NOME_DE_ROBO = /(?:bot|Bot)(?:[/;\s)-]|$)/

const ROBOS =
  /crawler|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|discord|skypeuripreview|embedly|preview|vkshare|pinterest|quora link|w3c_validator|headless|lighthouse|bytespider|curl\/|wget\/|python-requests|python-urllib|go-http-client|okhttp|axios\/|node-fetch|java\//i

export function ehRobo(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true
  return NOME_DE_ROBO.test(userAgent) || ROBOS.test(userAgent)
}
